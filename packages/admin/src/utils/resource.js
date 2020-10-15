import { isObject, isString, pickBy } from '@ditojs/utils'

export function hasResource(schema) {
  return !!getResource(schema.resource)
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
    parent !== undefined &&
    resource.parent === undefined &&
    !resource.path?.startsWith('/')
  ) {
    resource.parent = parent
    if (!resource.path) {
      resource.path = '.'
    }
  }
  return resource
}

export function getMemberResource(id, resource) {
  return id != null && resource?.type === 'collection'
    ? {
      type: 'member',
      ...pickBy(
        resource,
        (value, key) => ['method', 'path', 'parent'].includes(key)
      ),
      id: `${id}`
    }
    : null
}
