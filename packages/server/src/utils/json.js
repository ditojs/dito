export function formatJson(json, indented = true) {
  return JSON.stringify(json, null, indented ? 2 : 0)
}
