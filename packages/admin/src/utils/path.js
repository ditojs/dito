export function resolvePath(path) {
  // For paths staring with `/`, we can use the native `URL()` class to resolve
  // the path, which will also handle `..` and `.` segments:
  return new URL(`file:${path}`).pathname
}
