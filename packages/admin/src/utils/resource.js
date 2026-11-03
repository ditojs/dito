import { isFunction, isObject, isString, pickBy } from '@ditojs/utils'

// Resource functions only resolve with their context, so check the declaration:
export function hasResource(schema) {
  return !!schema.resource
}

export function getResource(resource, defaults = {}) {
  const { parent, ...defs } = defaults
  if (isFunction(resource)) {
    resource = resource(defaults)
  }
  resource = isObject(resource)
    ? { ...defs, ...resource }
    : isString(resource)
      ? { ...defs, path: resource }
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

// The URL path of a resource relative to `api.url`, joined to the paths of its
// parents. Upload routes are on the collection of the parent resource.
export function getResourcePath(resource) {
  if (!resource) return resource
  const { type, id, path, parent } = resource
  return type === 'member'
    ? `${joinPaths(getResourcePath(parent), path)}/${id}`
    : type === 'upload'
      ? `${joinPaths(getResourcePath(parent.parent), parent.path)}/upload/${
          path
        }`
      : joinPaths(getResourcePath(parent), path)
}

// An empty path is the parent itself, without a trailing slash:
function joinPaths(parentPath, path) {
  return parentPath && path ? `${parentPath}/${path}` : parentPath || path
}
