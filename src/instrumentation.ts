// Runs before Next.js starts handling requests (server-only)
export function register() {
  console.info('[instrumentation] registering storage shims')
  if (typeof window !== 'undefined') {
    // Browser already provides storage APIs
    return
  }

  type StorageLike = {
    readonly length: number
    clear(): void
    getItem(key: string): string | null
    key(index: number): string | null
    removeItem(key: string): void
    setItem(key: string, value: string): void
  }

  const createStorageMock = (): StorageLike => {
    const store = new Map<string, string>()
    return {
      get length() {
        return store.size
      },
      clear() {
        store.clear()
      },
      getItem(key: string) {
        return store.has(key) ? store.get(key)! : null
      },
      key(index: number) {
        return Array.from(store.keys())[index] ?? null
      },
      removeItem(key: string) {
        store.delete(key)
      },
      setItem(key: string, value: string) {
        store.set(key, value)
      },
    }
  }

  const defineStorage = (name: 'localStorage' | 'sessionStorage') => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name)
    if (descriptor && !descriptor.get && descriptor.value) {
      return // Already defined with a concrete value
    }

    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: false,
      value: createStorageMock(),
    })
  }

  defineStorage('localStorage')
  defineStorage('sessionStorage')
}
