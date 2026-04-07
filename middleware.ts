import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Subdomains that should NOT be treated as storefront slugs
const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'admin', 'staging', 'dev']);
const ROOT_DOMAIN = 'swiftdashdms.com';

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
