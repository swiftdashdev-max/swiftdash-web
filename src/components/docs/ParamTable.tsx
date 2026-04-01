interface Param {
  name: string;
  type: string;
  required?: boolean;
  description: string;
}

interface ParamTableProps {
  params: Param[];
  title?: string;
}

export function ParamTable({ params, title }: ParamTableProps) {
  return (
    <div className="my-4">
      {title && (
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          {title}
        </p>
      )}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-40">Name</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-28">Type</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-20">Required</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {params.map((p) => (
              <tr key={p.name} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <code className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                    {p.name}
                  </code>
                </td>
                <td className="px-4 py-3">
                  <code className="text-xs font-mono text-muted-foreground">{p.type}</code>
                </td>
                <td className="px-4 py-3">
                  {p.required ? (
                    <span className="text-xs text-orange-500 font-medium">Required</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Optional</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground leading-relaxed">
                  {p.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
