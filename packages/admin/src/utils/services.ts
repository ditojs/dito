import { nextTick } from 'vue'
import { equals, format as formatValue, isString } from '@ditojs/utils'
import defaultVerbs from '../verbs.js'
import { getResource, getMemberResource } from './resource.js'
import { getRequestCacheKey } from './request.js'
import type { AdminContext } from './AdminContext.ts'
import type { DataContext } from './DataContext.ts'
import type { ResourceContext } from './ResourceContext.ts'
import type { RouteContext } from './RouteContext.ts'
import type { SourceContext } from './SourceContext.ts'
import type { HTTPMethod } from '../../types/index.d.ts'
import type { Resource } from './types.ts'

export interface Services {
  readonly adminContext: AdminContext
  readonly dataContext: DataContext | null
  readonly routeContext: RouteContext | null
  readonly sourceContext: SourceContext | null
  readonly resourceContext: ResourceContext | null
}

// Requests only need the admin, and the resource that relative ones continue:
export type RequestServices = Pick<Services, 'adminContext' | 'resourceContext'>

export interface RequestOptions {
  method?: HTTPMethod
  url?: string
  resource?: Resource
  query?: Record<string, any>
  data?: any
  signal?: AbortSignal
  internal?: boolean
  // Cache for the admin session, or while the component's route is shown:
  cache?: 'global' | 'local'
}

export interface DownloadOptions {
  url: string
  filename?: string
  query?: Record<string, any>
}

export function getRootData({ dataContext }: Services) {
  return dataContext?.model.rootData ?? null
}

// Forms and sources have their own verbs, e.g. `apply` in nested data:
export function getVerbs({
  sourceContext,
  routeContext
}: Services): Record<string, string> {
  return (sourceContext ?? routeContext)?.verbs ?? defaultVerbs
}

// Wait until the data model wrote its derived values and finished its loads,
// with the header's spinner but without disabling the view:
export async function waitUntilDataModelSettled({
  adminContext,
  dataContext
}: Services) {
  await nextTick()
  const model = dataContext?.model
  if (model?.hasPendingLoads) {
    await adminContext.loadingTracker.track(() => model.waitUntilSettled())
  }
}

export function getResourceUrl(
  { adminContext, resourceContext }: RequestServices,
  resource: Resource
): string | null {
  // Resources without a parent continue the nearest form's or source's:
  const url = adminContext.api.resources.any(
    getResource(resource, {
      parent: resourceContext?.getResource({
        method: resource.method,
        child: resource
      }) ?? null
    })
  )
  return url
    ? adminContext.api.getApiUrl({ url, query: resource.query })
    : null
}

export async function sendRequest(
  services: RequestServices,
  { method, url, resource, query, data, signal, internal }: RequestOptions
) {
  const { api, session } = services.adminContext
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
  // Fetch the own user again when it changed:
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
      ? services.adminContext.session.loadCache
      : cache === 'local'
        ? (services.routeContext?.loadCache ?? null)
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
  // NOTE: Cache the promise, not its result:
  const res = sendRequest(services, options)
    .then(response => response.data)
    .catch(error => {
      // Failed requests aren't cached, so they can be retried:
      if (loadCache?.[cacheKey] === res) {
        delete loadCache[cacheKey]
      }
      // Convert the data of error responses, e.g. Dito.js errors, to errors:
      const data = error.response?.data
      throw data ? Object.assign(new Error(data.message), data) : error
    })
  if (loadCache) {
    loadCache[cacheKey] = res
  }
  return res
}

export function format(
  { adminContext }: Services,
  value: any,
  {
    locale = adminContext.api.locale,
    defaults = adminContext.api.formats,
    ...options
  }: Record<string, any> = {}
) {
  return formatValue(value, { locale, defaults, ...options })
}

export function download(
  { adminContext }: Services,
  options: string | DownloadOptions
) {
  if (isString(options)) {
    options = { url: options }
  }
  // See: https://stackoverflow.com/a/49917066/1163708
  const a = document.createElement('a')
  a.href = options.url?.startsWith('blob:')
    ? options.url
    : adminContext.api.getApiUrl(options)
  a.download = options.filename ?? ''
  const { body } = document
  body.appendChild(a)
  a.click()
  body.removeChild(a)
}
