// The parts of `@ditojs/build` that `defineAdminViteConfig()` uses. The
// package has no types of its own.
declare module '@ditojs/build' {
  export function getPostCssConfig(): { plugins: unknown[] }
}
