import { nextTick } from 'vue'
import { format as formatValue, isString } from '@ditojs/utils'
import defaultVerbs from '../verbs.js'
import { getResource, getMemberResource } from './resource.js'
import { getRequestCacheKey } from './request.js'
import type { AdminContext } from './AdminContext.ts'
import type { DataContext } from './DataContext.ts'
import type { ResourceContext } from './ResourceContext.ts'
import type { RouteContext } from './RouteContext.ts'
import type { SourceContext } from './SourceContext.ts'
import type { HttpMethod, SchemaContext } from '../../types/index.d.ts'
import type { Resource } from './types.ts'

export interface Services {
  readonly adminContext: AdminContext
  readonly dataContext: DataContext | null
  readonly routeContext: RouteContext | null
  readonly sourceContext: SourceContext | null
  readonly resourceContext: ResourceContext | null
  // Aborts the requests of the component when it unmounts:
  readonly signal: AbortSignal
}

// Requests only need the admin, and the resource that relative ones continue:
export type RequestServices = Pick<Services, 'adminContext' | 'resourceContext'>

export interface RequestOptions {
  method?: HttpMethod
  url?: string
  resource?: Resource
  query?: Record<string, any>
  data?: any
  signal?: AbortSignal
  internal?: boolean
  // Cache for the admin session, or while the component's route or dialog is
  // shown:
  cache?: 'global' | 'local'
  // End without settling when the component unmounts:
  abortOnUnmount?: boolean
}

// The last overload of `download()` takes the options:
export type DownloadOptions = Parameters<SchemaContext['download']>[0]

export function getRootData({ dataContext }: Services) {
  return dataContext?.model.rootData ?? null
}

// Forms and sources have their own verbs, e.g. `apply` in nested data:
export function getVerbs({
  sourceContext,
  dataContext,
  routeContext
}: Services): Record<string, string> {
  return (
    sourceContext?.verbs ??
    dataContext?.verbs ??
    routeContext?.verbs ??
    defaultVerbs
  )
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
  const { adminContext } = services
  const { api, session } = adminContext
  url ||= (resource && getResourceUrl(services, resource)) || undefined
  if (!url) {
    throw new Error('Unable to send request: There is no URL or resource.')
  }
  method ||= resource?.method
  const checkUser = !internal && api.isApiUrl(url)
  if (checkUser) {
    await session.ensureUser()
  }
  const send = () => api.request({ method, url, query, data, signal })
  const response = await send().catch(async error => {
    // Security changes answer `confirmationRequired` without a recent login,
    // so we confirm the access and send them again. Cancelled confirmations
    // end the request quietly, like aborted ones:
    if (checkUser && error.response?.data?.confirmationRequired) {
      if (await session.confirmAccess()) {
        return send()
      } else {
        throw new DOMException('The confirmation was cancelled.', 'AbortError')
      }
    } else {
      throw error
    }
  })
  // Fetch the own user again when it changed, through its member or `self`:
  if (checkUser && method === 'patch') {
    const { users } = api
    const userUrls = [
      getMemberResource(adminContext.user!.id, users)!,
      users.self!
    ].map(resource =>
      getResourceUrl({ adminContext, resourceContext: null }, resource)
    )
    if (userUrls.includes(url)) {
      await session.fetchUser()
    }
  }
  return response
}

export function request(
  services: Services,
  { cache, abortOnUnmount, ...options }: RequestOptions
): Promise<any> {
  if (cache && abortOnUnmount) {
    throw new Error(
      'Unable to abort cached requests on unmount, as other components ' +
      'share them.'
    )
  }
  const loadCache: Record<string, Promise<any>> | null =
    cache === 'global'
      ? services.adminContext.session.loadCache
      : cache === 'local'
        ? (services.dataContext?.loadCache ?? null)
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
  const signals = [options.signal, abortOnUnmount && services.signal]
  // NOTE: Cache the promise, not its result:
  const res = sendRequest(services, {
    ...options,
    signal: AbortSignal.any(signals.filter(Boolean) as AbortSignal[])
  })
    .then(response => response.data)
    .catch(error => {
      // Nothing waits for the requests of unmounted components, so their
      // promises don't settle, and their callers' code doesn't run on:
      if (abortOnUnmount && services.signal.aborted) {
        return new Promise(() => {})
      }
      // Failed requests aren't cached, so they can be retried:
      if (loadCache?.[cacheKey] === res) {
        delete loadCache[cacheKey]
      }
      // Convert the data of error responses, e.g. Dito.js errors, to errors
      // with the status of the response:
      const data = error.response?.data
      throw data
        ? Object.assign(new Error(data.message), data, {
            status: error.response.status
          })
        : error
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

export function downloadBlob(services: Services, blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  try {
    download(services, { filename, url })
  } finally {
    // Some browsers don't start the download synchronously:
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
