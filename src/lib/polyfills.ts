/**
 * Polyfills for development server SSR issues
 * This fixes localStorage errors during Next.js dev server SSR
 */

if (typeof global !== 'undefined' && typeof global.localStorage === 'undefined') {
  // Create a simple localStorage mock for SSR
  global.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  } as Storage;
}

if (typeof global !== 'undefined' && typeof global.sessionStorage === 'undefined') {
  global.sessionStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  } as Storage;
}

export {};
