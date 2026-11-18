// Storage can be unavailable, e.g. in private windows or when it's blocked, and
// then the settings that it holds just aren't remembered:
export function getStoredItem(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function setStoredItem(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {}
}
