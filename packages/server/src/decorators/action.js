import { isString } from '@ditojs/utils'

export function action(...args) {
  let verb = args[0]
  const decorator = (target, key, descriptor) => {
    descriptor.value.verb = verb
  }
  if (isString(verb)) {
    // The decorator was called with a verb argument, return the produced func.
    return decorator
  } else {
    // No argument was provided, call the decorator with verb = 'get'
    verb = 'get'
    decorator(...args)
  }
}
