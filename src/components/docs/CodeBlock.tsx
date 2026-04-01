'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export type CodeLang = 'cURL' | 'Node.js' | 'Python' | 'PHP';

interface CodeTab {
  lang: CodeLang;
  code: string;
}

interface CodeBlockProps {
  tabs: CodeTab[];
  /** If only one snippet, no tabs shown */
  defaultLang?: CodeLang;
}

// Minimal token coloring using regex — no external dep needed
function highlight(code: string, lang: CodeLang): string {
  // Escape HTML first
  let s = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  if (lang === 'cURL') {
    // strings
    s = s.replace(/('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g, '<span class="tok-str">$1</span>');
    // flags like -H -X -d
    s = s.replace(/(^|\s)(-[A-Za-z]+)/gm, '$1<span class="tok-flag">$2</span>');
    // url
    s = s.replace(/(https?:\/\/[^\s'"]+)/g, '<span class="tok-url">$1</span>');
    // command
    s = s.replace(/^(curl)/m, '<span class="tok-kw">$1</span>');
  } else if (lang === 'Node.js') {
    // strings
    s = s.replace(/(`(?:[^`\\]|\\.)*`|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g, '<span class="tok-str">$1</span>');
    // keywords
    s = s.replace(/\b(const|let|var|async|await|function|return|if|else|new|import|from|require|throw|try|catch)\b/g, '<span class="tok-kw">$1</span>');
    // numbers
    s = s.replace(/\b(\d+\.?\d*)\b/g, '<span class="tok-num">$1</span>');
    // comments
    s = s.replace(/(\/\/[^\n]*)/g, '<span class="tok-comment">$1</span>');
    // method calls
    s = s.replace(/\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g, '.<span class="tok-fn">$1</span>(');
  } else if (lang === 'Python') {
    s = s.replace(/('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|"""[\s\S]*?""")/g, '<span class="tok-str">$1</span>');
    s = s.replace(/\b(def|async|await|return|import|from|if|else|elif|for|in|True|False|None|with|as|raise|try|except)\b/g, '<span class="tok-kw">$1</span>');
    s = s.replace(/\b(\d+\.?\d*)\b/g, '<span class="tok-num">$1</span>');
    s = s.replace(/(#[^\n]*)/g, '<span class="tok-comment">$1</span>');
  } else if (lang === 'PHP') {
    s = s.replace(/('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g, '<span class="tok-str">$1</span>');
    s = s.replace(/\b(function|return|if|else|echo|new|require|use|namespace|public|private|protected|static|array|foreach|as|throw|try|catch)\b/g, '<span class="tok-kw">$1</span>');
    s = s.replace(/(\$[a-zA-Z_][a-zA-Z0-9_]*)/g, '<span class="tok-var">$1</span>');
    s = s.replace(/\b(\d+\.?\d*)\b/g, '<span class="tok-num">$1</span>');
    s = s.replace(/(\/\/[^\n]*|#[^\n]*)/g, '<span class="tok-comment">$1</span>');
  } else {
    // JSON / generic
    s = s.replace(/("(?:[^"\\]|\\.)*")(\s*:)/g, '<span class="tok-key">$1</span>$2');
    s = s.replace(/:\s*("(?:[^"\\]|\\.)*")/g, ': <span class="tok-str">$1</span>');
    s = s.replace(/\b(true|false|null)\b/g, '<span class="tok-bool">$1</span>');
    s = s.replace(/\b(\d+\.?\d*)\b/g, '<span class="tok-num">$1</span>');
  }

  return s;
}

export function CodeBlock({ tabs, defaultLang }: CodeBlockProps) {
  const [activeLang, setActiveLang] = useState<CodeLang>(defaultLang ?? tabs[0]?.lang);
  const [copied, setCopied] = useState(false);

  const activeTab = tabs.find((t) => t.lang === activeLang) ?? tabs[0];

  const handleCopy = async () => {
    await navigator.clipboard.writeText(activeTab.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl overflow-hidden border border-[#2a2f3e] bg-[#0d1117] text-sm shadow-lg">
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-[#2a2f3e] px-4 py-2 bg-[#161b22]">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.lang}
              onClick={() => setActiveLang(tab.lang)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                activeLang === tab.lang
                  ? 'bg-primary/20 text-primary'
                  : 'text-[#8b949e] hover:text-[#c9d1d9]'
              }`}
            >
              {tab.lang}
            </button>
          ))}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-[#8b949e] hover:text-[#c9d1d9] transition-colors"
        >
          {copied ? (
            <><Check className="h-3.5 w-3.5 text-green-400" /><span className="text-green-400">Copied</span></>
          ) : (
            <><Copy className="h-3.5 w-3.5" />Copy</>
          )}
        </button>
      </div>

      {/* Code */}
      <div className="overflow-x-auto">
        <pre className="p-5 leading-relaxed text-[#c9d1d9] font-mono text-xs">
          <code
            dangerouslySetInnerHTML={{
              __html: highlight(activeTab.code, activeLang),
            }}
          />
        </pre>
      </div>

      <style jsx global>{`
        .tok-kw      { color: #ff7b72; }
        .tok-str     { color: #a5d6ff; }
        .tok-num     { color: #79c0ff; }
        .tok-bool    { color: #79c0ff; }
        .tok-key     { color: #7ee787; }
        .tok-fn      { color: #d2a8ff; }
        .tok-var     { color: #ffa657; }
        .tok-flag    { color: #ffa657; }
        .tok-url     { color: #a5d6ff; text-decoration: underline; }
        .tok-comment { color: #8b949e; font-style: italic; }
      `}</style>
    </div>
  );
}
