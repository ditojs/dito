import { isObject, isString } from '@ditojs/utils'

export function hasResource(resource) {
  return !!getResource(resource)
}

export function getResource(resource, defaults = {}) {
  const { parent, ...defs } = defaults
  resource = isObject(resource) ? { ...defs, ...resource }
    : isString(resource) ? { ...defs, path: resource }
    : null
  // Only set parent if path doesn't start with '/', so relative URLs are
  // dealt with correctly.
  if (
    resource &&
    parent &&
    !resource.parent &&
    parent.path &&
    !/^\//.test(resource.path)
  ) {
    resource.parent = parent
  }
  return resource
}

export function getMemberResource(id, resource) {
  return id != null && resource?.type === 'collection'
    ? {
      ...resource,
      type: 'member',
      id
    }
    : null
}
