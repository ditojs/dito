// The admin's path without a trailing slash, such as `/admin`, and an empty
// string at the root.
export function normalizeBase(base: string) {
  return `/${base}`.replace(/\/+/g, '/').replace(/\/$/, '')
}
