// tests/utils/authenticator.ts
import crypto from 'node:crypto'
import { isoCBOR } from '@simplewebauthn/server/helpers'

// A software authenticator with a P-256 key, which answers the options of
// `@simplewebauthn/server` like a browser with a passkey does, with 'none'
// attestation.
export function createAuthenticator({
  origin,
  rpId
}: {
  origin: string
  rpId: string
}) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'P-256'
  })
  const id = crypto.randomBytes(16)
  const { x, y } = publicKey.export({ format: 'jwk' })
  // The COSE key of ES256 (-7) on P-256 (1):
  const cosePublicKey = isoCBOR.encode(
    new Map<number, number | Uint8Array>([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, Buffer.from(x!, 'base64url')],
      [-3, Buffer.from(y!, 'base64url')]
    ])
  )
  const rpIdHash = sha256(rpId)

  // User present (0x01) and verified (0x04), with attested data (0x40):
  const getAuthenticatorData = (attestedData: Buffer | null = null) => {
    const counterBytes = Buffer.alloc(4)
    counterBytes.writeUInt32BE(authenticator.counter)
    return Buffer.concat([
      rpIdHash,
      Buffer.from([attestedData ? 0x45 : 0x05]),
      counterBytes,
      ...(attestedData ? [attestedData] : [])
    ])
  }

  const getClientData = (type: string, challenge: string) =>
    Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }))

  const authenticator = {
    id: id.toString('base64url'),
    // The signature counter, which tests can set back to clone authenticators:
    counter: 0,

    register({ challenge }: { challenge: string }) {
      const idLength = Buffer.alloc(2)
      idLength.writeUInt16BE(id.length)
      const authenticatorData = getAuthenticatorData(
        Buffer.concat([
          Buffer.alloc(16), // The AAGUID.
          idLength,
          id,
          cosePublicKey
        ])
      )
      const attestationObject = Buffer.from(
        isoCBOR.encode(
          new Map<string, any>([
            ['fmt', 'none'],
            ['attStmt', new Map()],
            ['authData', authenticatorData]
          ])
        )
      )
      const clientData = getClientData('webauthn.create', challenge)
      return {
        id: id.toString('base64url'),
        rawId: id.toString('base64url'),
        type: 'public-key',
        response: {
          clientDataJSON: clientData.toString('base64url'),
          attestationObject: attestationObject.toString('base64url'),
          transports: ['internal']
        },
        clientExtensionResults: {}
      }
    },

    authenticate({ challenge }: { challenge: string }) {
      authenticator.counter++
      const authenticatorData = getAuthenticatorData()
      const clientData = getClientData('webauthn.get', challenge)
      const signature = crypto.sign(
        'sha256',
        Buffer.concat([authenticatorData, sha256(clientData)]),
        privateKey
      )
      return {
        id: id.toString('base64url'),
        rawId: id.toString('base64url'),
        type: 'public-key',
        response: {
          clientDataJSON: clientData.toString('base64url'),
          authenticatorData: authenticatorData.toString('base64url'),
          signature: signature.toString('base64url')
        },
        clientExtensionResults: {}
      }
    }
  }
  return authenticator
}

function sha256(data: string | Buffer) {
  return crypto.createHash('sha256').update(data).digest()
}
