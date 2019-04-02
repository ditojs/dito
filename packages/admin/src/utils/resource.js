import { isObject, isString } from '@ditojs/utils'

export function hasResource(resource) {
  return !!getResource(resource)
}

export function getResource(resource) {
  return isObject(resource) ? resource
    : isString(resource) ? { path: resource }
    : null
}

export function getNestedResource(resource, parent, method) {
  resource = getResource(resource)
  if (resource) {
    const { path, ...rest } = resource
    resource = path === '..'
      ? { // Merge with parent
        ...parent,
        ...rest
      }
      : { // Nest inside parent
        ...resource,
        parent
      }
    if (method) {
      // Use passed method as default, but allow resource to override it.
      resource.method = method
    }
  }
  return resource
}
