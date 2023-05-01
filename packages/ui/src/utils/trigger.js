import { isString } from '@ditojs/utils'

export function getTarget(component) {
  const target = isString(component.target)
    ? component.$refs[component.target]
    : component.target
  return target?.$el ?? target
}
