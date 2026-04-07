import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Subdomains that should NOT be treated as storefront slugs
const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'admin', 'staging', 'dev']);
const ROOT_DOMAIN = 'swiftdashdms.com';

// ── Simple in-memory cache for custom domain lookups ──────────
const domainCache = new Map<string, { slug: string | null; timestamp: number }>();
const CACHE_TTL = 60_000; // 60 seconds

function getSubdomain(host: string): string | null {
  // Remove port if present (e.g., localhost:3000)
  const hostname = host.split(':')[0];

  // Local dev: check for .localhost pattern (e.g., jollibee.localhost)
  if (hostname.endsWith('.localhost')) {
    const sub = hostname.replace('.localhost', '');
    if (sub && !RESERVED_SUBDOMAINS.has(sub)) return sub;
    return null;
  }

  // Production: check for *.swiftdashdms.com
  if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    const sub = hostname.replace(`.${ROOT_DOMAIN}`, '');
    if (sub && !RESERVED_SUBDOMAINS.has(sub)) return sub;
    return null;
  }

  return null;
}

function isCustomDomainCandidate(host: string): boolean {
  const hostname = host.split(':')[0];
  // Not localhost, not swiftdashdms.com, not Vercel previews
  if (hostname === 'localhost') return false;
  if (hostname.endsWith('.localhost')) return false;
  if (hostname === ROOT_DOMAIN || hostname.endsWith(`.${ROOT_DOMAIN}`)) return false;
  if (hostname.endsWith('.vercel.app')) return false;
  // Must have a dot (real domain)
  if (!hostname.includes('.')) return false;
  return true;
}

async function resolveCustomDomain(hostname: string): Promise<string | null> {
  // Check cache first
  const cached = domainCache.get(hostname);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.slug;
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Custom domain: missing SUPABASE env vars');
      return null;
    }

    // Use direct PostgREST fetch — more reliable in Edge middleware than the JS client
    const url = `${supabaseUrl}/rest/v1/business_accounts?select=slug&custom_domain=eq.${encodeURIComponent(hostname)}&storefront_enabled=eq.true&limit=1`;
    const res = await fetch(url, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      console.error('Custom domain lookup failed:', res.status, await res.text());
      domainCache.set(hostname, { slug: null, timestamp: Date.now() });
      return null;
    }

    const rows = await res.json();
    const slug = rows?.[0]?.slug || null;
    // Cache the result (even null to avoid repeated lookups)
    domainCache.set(hostname, { slug, timestamp: Date.now() });
    return slug;
  } catch (err) {
    console.error('Custom domain lookup error:', err);
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') || '';
  const subdomain = getSubdomain(host);

  // ── Subdomain storefront routing ──────────────────────────────
  // If we're on a business subdomain, rewrite to /book/[slug]
  if (subdomain) {
    const url = request.nextUrl.clone();
    const path = url.pathname;

    // Allow _next, static assets and api routes through
    if (
      path.startsWith('/_next') ||
      path.startsWith('/api') ||
      path === '/favicon.ico'
    ) {
      // Fall through to normal handling
    } else if (path.startsWith('/track')) {
      // Let tracking pages pass through normally on subdomains
    } else {
      // Rewrite: welinc.swiftdashdms.com/ → /book/welinc
      url.pathname = `/book/${subdomain}${path === '/' ? '' : path}`;
      return NextResponse.rewrite(url);
    }
  }

  // ── Custom domain storefront routing ──────────────────────────
  // If the host is a custom domain (e.g., book.welinc.com), resolve to slug
  const hostname = host.split(':')[0];
  if (!subdomain && isCustomDomainCandidate(host)) {
    const slug = await resolveCustomDomain(hostname);
    if (slug) {
      const url = request.nextUrl.clone();
      const path = url.pathname;

      if (
        path.startsWith('/_next') ||
        path.startsWith('/api') ||
        path === '/favicon.ico'
      ) {
        // Fall through to normal handling
      } else if (path.startsWith('/track')) {
        // Let tracking pages pass through normally
      } else {
        // Rewrite: book.welinc.com/ → /book/welinc
        url.pathname = `/book/${slug}${path === '/' ? '' : path}`;
        return NextResponse.rewrite(url);
      }
    }
  }

  // ── Normal Supabase auth middleware ────────────────────────────
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
      auth: {
        flowType: 'pkce',
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    }
  )

  // Silently check for user without throwing errors
  try {
    await supabase.auth.getUser()
  } catch (error) {
    // Ignore errors in middleware
    console.error('Auth check error in middleware:', error)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
