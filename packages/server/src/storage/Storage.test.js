import { Storage } from './Storage.js'

function createStorage(keys = ['test-secret']) {
  const app = { keys }
  return new Storage(app, { name: 'test' })
}

function simulateUpload(storage, key, originalname) {
  return storage.convertStorageFile({
    key,
    originalname,
    mimetype: 'image/png',
    size: 2048
  })
}

describe('Storage: asset key signature verification', () => {
  it('preserves the key through a full upload-then-save cycle', () => {
    const storage = createStorage()
    const uploaded = simulateUpload(storage, 'real-key.png', 'photo.png')
    const fromClient = { ...uploaded }
    storage.convertAssetFile(fromClient, { trusted: false })
    expect(fromClient.key).toBe('real-key.png')
  })

  it('throws when a forged key is submitted', () => {
    const storage = createStorage()
    const file = { key: 'victim-key.png', name: 'photo.png' }
    expect(() => {
      storage.convertAssetFile(file, { trusted: false })
    }).toThrow('Invalid asset signature')
  })

  it('throws when a valid signature is paired with a swapped key', () => {
    const storage = createStorage()
    const uploaded = simulateUpload(storage, 'legit.png', 'legit.png')
    const forged = { ...uploaded, key: 'victim-file.png' }
    expect(() => {
      storage.convertAssetFile(forged, { trusted: false })
    }).toThrow('Invalid asset signature')
  })

  it('does not throw when addFile() converts a server-created file', async () => {
    const storage = createStorage()
    const file = { key: 'imported.png', name: 'import.png' }
    const data = Buffer.from('fake-image-data')
    await storage.addFile(file, data)
    expect(file.key).toBe('imported.png')
  })

  it('strips signature after conversion', () => {
    const storage = createStorage()
    const uploaded = simulateUpload(storage, 'upload.png', 'photo.png')
    const fromClient = { ...uploaded }
    storage.convertAssetFile(fromClient, { trusted: false })
    expect('signature' in fromClient).toBe(false)
  })
})
