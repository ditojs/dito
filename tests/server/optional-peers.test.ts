import { registerHooks } from 'node:module'
import { Application, PasskeyService, TotpService } from '@ditojs/server'

describe('Optional peer dependencies', () => {
  // Make Node.js fail to find `module`, as apps that don't install it do. This
  // test file runs in its own process, which hasn't imported it yet:
  const setupWithout = async (
    module: string,
    services: Record<string, any>
  ) => {
    const hooks = registerHooks({
      resolve(specifier, context, nextResolve) {
        if (specifier.includes(`/node_modules/${module}/`)) {
          throw Object.assign(new Error(`Cannot find package '${module}'`), {
            code: 'ERR_MODULE_NOT_FOUND'
          })
        }
        return nextResolve(specifier, context)
      }
    })
    try {
      const app = new Application({
        config: {
          app: { name: 'Example' },
          log: { silent: true },
          services: { passkeys: true, totp: { secret: 'totp-secret' } }
        },
        services
      })
      await app.setupServices()
    } finally {
      hooks.deregister()
    }
  }

  it('are named when missing for passkeys', async () => {
    await expect(
      setupWithout('aaguids', { passkeys: PasskeyService })
    ).rejects.toThrow(`Unable to use 'PasskeyService' without 'aaguids'.`)
  })

  it('are named when missing for TOTP', async () => {
    await expect(
      setupWithout('otpauth', { totp: TotpService })
    ).rejects.toThrow(`Unable to use 'TotpService' without 'otpauth'.`)
  })
})
