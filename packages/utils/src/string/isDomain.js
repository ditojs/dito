// Best effort approach, allowing Internationalized domain name (with punycode)
const domainRegExp =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i

export function isDomain(str) {
  // Reject characters that `URL` would treat as delimiters or decode, so that
  // only the domain itself is converted to its ASCII (punycode) form.
  if (!str || /[\s/\\?#@:%]/.test(str)) {
    return false
  }
  try {
    return domainRegExp.test(new URL(`http://${str}`).hostname)
  } catch {
    return false
  }
}
