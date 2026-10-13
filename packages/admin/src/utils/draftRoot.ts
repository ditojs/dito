import { readonly, toRaw } from 'vue'
import { isFunction, parseDataPath } from '@ditojs/utils'

// Create the root for the model of a nested form: the parent's data, live and
// read-only, with `draft` in place of the item at `dataPath`.
export function createDraftRoot<T extends object>(
  root: T,
  dataPath: string | string[],
  draft: object
): T {
  const [key, ...rest] = parseDataPath(dataPath)
  if (key === undefined) return draft as T
  const next = createDraftRoot((root as any)[key], rest, draft)
  // `readonly()` can't redirect a key, so we delegate all other keys to it,
  // warnings on writes included:
  return new Proxy(root, {
    get(target, property, receiver) {
      if (property === key) return next
      const value = Reflect.get(readonly(target), property)
      // Run methods on this proxy, so they see `next`. Vue's instrumented
      // array methods would run on the raw array instead:
      return isFunction(value)
        ? Reflect.get(toRaw(target), property, receiver)
        : value
    },

    set(target, property, value) {
      return Reflect.set(readonly(target), property, value)
    },

    deleteProperty(target, property) {
      return Reflect.deleteProperty(readonly(target), property)
    }
  })
}
