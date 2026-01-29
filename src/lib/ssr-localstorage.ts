const createStorageShim = (): Storage => {
  const noop = () => {}
  return {
    getItem: () => null,
    setItem: noop,
    removeItem: noop,
    clear: noop,
    key: () => null,
    length: 0,
  }
}

if (typeof window === "undefined") {
  const storage = (globalThis as typeof globalThis & { localStorage?: Storage }).localStorage
  if (!storage || typeof storage.getItem !== "function") {
    Object.defineProperty(globalThis, "localStorage", {
      value: createStorageShim(),
      configurable: true,
    })
  }
}
