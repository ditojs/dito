import { execFileSync } from 'node:child_process'

// Runs `code` as a module in a new Node process and lists the URLs that it
// resolves, to check which modules an entry loads.
export function getResolvedUrls(code: string) {
  const script = `
    import { registerHooks } from 'node:module'
    const urls = []
    registerHooks({
      resolve(specifier, context, next) {
        const result = next(specifier, context)
        urls.push(result.url)
        return result
      }
    })
    ${code}
    console.log(JSON.stringify(urls))
  `
  const output = execFileSync(
    process.execPath,
    ['--input-type=module', '-e', script],
    { encoding: 'utf8' }
  )
  return JSON.parse(output) as string[]
}
