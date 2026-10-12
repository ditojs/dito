import { equals, format as formatValue, isString } from '@ditojs/utils'
import appState from '../appState.js'
import { getResource, getMemberResource } from './resource.js'
import { getRequestCacheKey } from './request.js'
import type { AdminContext } from './AdminContext.ts'
import type { ContainerContext } from './ContainerContext.ts'
import type { ResourceContext } from './ResourceContext.ts'
import type { RouteContext } from './RouteContext.ts'
import type { SourceContext } from './SourceContext.ts'
import type { HTTPMethod } from '../../types/index.d.ts'
import type { Resource } from './types.ts'

// The contexts that the callbacks of a component read, as the component sees
// them. Components provide them, and data models for the contexts that they
// create, as the components of their container see them.
export interface Services {
  readonly admin: AdminContext
  readonly container: ContainerContext | null
  readonly route: RouteContext | null
  readonly source: SourceContext | null
  readonly resource: ResourceContext | null
}

export interface RequestOptions {
  method?: HTTPMethod
  url?: string
  resource?: Resource
  query?: Record<string, any>
  data?: any
  signal?: AbortSignal
  internal?: boolean
  // Cache the response for the entire admin session, or for as long as the
  // route that renders the component is shown:
  cache?: 'global' | 'local'
}

export interface DownloadOptions {
  url: string
  filename?: string
  query?: Record<string, any>
}

export function getResourceUrl(
  { admin, resource: resourceContext }: Services,
  resource: Resource
): string | null {
  // Resources without a parent continue the one of the closest form or source
  // with a resource:
  const parent = resourceContext?.resourceOwner
  const url = admin.api.resources.any(
    getResource(resource, {
      parent: (
        parent?.getResource({ method: resource.method, child: resource }) ??
        null
      )
    })
  )
  return url ? admin.api.getApiUrl({ url, query: resource.query }) : null
}

export async function sendRequest(
  services: Services,
  { method, url, resource, query, data, signal, internal }: RequestOptions
) {
  const { api, session } = services.admin
  url ||= (resource && getResourceUrl(services, resource)) || undefined
  if (!url) {
    throw new Error('Unable to send request: There is no URL or resource.')
  }
  method ||= resource?.method
  const checkUser = !internal && api.isApiUrl(url)
  if (checkUser) {
    await session.ensureUser()
  }
  const response = await api.request({ method, url, query, data, signal })
  // Detect change of the own user, and fetch it again if it was changed.
  if (
    checkUser &&
    method === 'patch' &&
    equals(resource, getMemberResource(session.user!.id, api.users))
  ) {
    await session.fetchUser()
  }
  return response
}

export function request(
  services: Services,
  { cache, ...options }: RequestOptions
): Promise<any> {
  // Components outside of routes, e.g. in dialogs, don't cache locally:
  const loadCache: Record<string, Promise<any>> | null =
    cache === 'global'
      ? appState.loadCache
      : cache === 'local'
        ? (services.route?.loadCache ?? null)
        : null
  // Requests to resources are told apart by the URLs that they resolve to:
  const { resource } = options
  const cacheKey = loadCache
    ? getRequestCacheKey({
        ...options,
        method: options.method || resource?.method,
        url: (
          options.url || (resource ? getResourceUrl(services, resource) : null)
        )
      })
    : ''
  if (loadCache && cacheKey in loadCache) {
    return loadCache[cacheKey]
  }
  // NOTE: No await here, res is a promise that we can easily cache.
  // That's fine because promises can be resolved over and over again.
  const res = sendRequest(services, options)
    .then(response => response.data)
    .catch(error => {
      // Failed requests aren't cached, so they can be retried:
      if (loadCache?.[cacheKey] === res) {
        delete loadCache[cacheKey]
      }
      // Convert errors of responses with data, e.g. Dito.js errors, to
      // errors with the message and properties of that data:
      const data = error.response?.data
      throw data ? Object.assign(new Error(data.message), data) : error
    })
  if (loadCache) {
    loadCache[cacheKey] = res
  }
  return res
}

export function format(
  { admin }: Services,
  value: any,
  {
    locale = admin.api.locale,
    defaults = admin.api.formats,
    ...options
  }: Record<string, any> = {}
) {
  return formatValue(value, { locale, defaults, ...options })
}

export function download(
  { admin }: Services,
  options: string | DownloadOptions
) {
  if (isString(options)) {
    options = { url: options }
  }
  // See: https://stackoverflow.com/a/49917066/1163708
  const a = document.createElement('a')
  a.href = options.url?.startsWith('blob:')
    ? options.url
    : admin.api.getApiUrl(options)
  a.download = options.filename ?? ''
  const { body } = document
  body.appendChild(a)
  a.click()
  body.removeChild(a)
}
