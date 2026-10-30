// Optional peers load on first use, with a clear error when the app didn't
// install them.
export function lazyPeer<T>(module: string, feature: string) {
  let promise: Promise<T> | null = null
  return () =>
    (promise ??= import(module).catch(error => {
      promise = null
      throw error.code === 'ERR_MODULE_NOT_FOUND'
        ? new Error(`Unable to use ${feature} without '${module}'.`)
        : error
    }))
}
