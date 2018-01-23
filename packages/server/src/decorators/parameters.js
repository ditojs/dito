import { asArray } from '@ditojs/utils'

export function parameters(parameters) {
  return (target, key, descriptor) => {
    parameters = asArray(parameters)
    descriptor.value.parameters = parameters
  }
}
