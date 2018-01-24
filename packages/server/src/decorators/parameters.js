import { isArray } from '@ditojs/utils'

export function parameters(...args) {
  return (target, key, descriptor) => {
    descriptor.value.parameters = isArray(args[0]) ? args[0] : args
  }
}
