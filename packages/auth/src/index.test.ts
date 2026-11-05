import { fileURLToPath } from 'node:url'
import { getResolvedUrls } from '../../../tests/utils/imports.ts'

describe('main entry', () => {
  it('loads neither passkeys nor TOTP', () => {
    const entry = fileURLToPath(new URL('./index.ts', import.meta.url))
    const urls = getResolvedUrls(`await import(${JSON.stringify(entry)})`)
    expect(urls).toContainEqual(expect.stringMatching(/\/src\/sessions\.ts$/))
    for (const pattern of [
      /\/src\/(passkeys|totp)\.ts$/,
      /\/(@simplewebauthn|otpauth|aaguids)\//
    ]) {
      expect(urls.filter(url => pattern.test(url))).toEqual([])
    }
  })
})
