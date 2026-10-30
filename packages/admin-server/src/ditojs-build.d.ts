// The parts of `@ditojs/build` that `defineAdminViteConfig()` uses. The
// package has no types of its own.
declare module '@ditojs/build' {
  export function testModuleIdentifier(
    id: string,
    patterns: string | string[]
  ): boolean
  export function getPostCssConfig(): { plugins: unknown[] }
}
