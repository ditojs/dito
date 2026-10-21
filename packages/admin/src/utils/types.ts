import type { ApiConfig } from '../../types/index.d.ts'

// The schemas, data and resources that the admin's modules handle, which they
// don't type further:
export type Schema = Record<string, any>
export type Data = Record<string, any>
export type Resource = Record<string, any>

// The API configuration with the defaults that `DitoAdmin` sets up, and the
// resources of `users` that it derives:
export type Api = Omit<ApiConfig, 'users'> &
  Required<
    Pick<
      ApiConfig,
      | 'locale'
      | 'formats'
      | 'request'
      | 'getApiUrl'
      | 'isApiUrl'
      | 'normalizePath'
      | 'denormalizePath'
      | 'resources'
      | 'headers'
      | 'defaults'
    >
  > & { users: Record<string, Resource> }
