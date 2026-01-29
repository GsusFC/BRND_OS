declare global {
  // eslint-disable-next-line no-var
  var localStorage: {
    getItem: (key: string) => string | null
    setItem: (key: string, value: string) => void
    removeItem: (key: string) => void
    clear: () => void
    key: (index: number) => string | null
    length: number
  } | undefined
}

export {}

if (typeof window === "undefined") {
  const storage = globalThis.localStorage
  if (!storage || typeof storage.getItem !== "function") {
    const noop = () => {}
    globalThis.localStorage = {
      getItem: () => null,
      setItem: noop,
      removeItem: noop,
      clear: noop,
      key: () => null,
      length: 0,
    }
  }
}
