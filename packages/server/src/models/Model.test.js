import { Model } from './Model.js'

function makeFakeModel(assets) {
  const storage = {
    signAssetFile(file) {
      file.signature = `sig-of-${file.key}`
    }
  }
  return {
    app: {
      getStorage(name) {
        return name === 'test' ? storage : null
      }
    },
    definition: { assets }
  }
}

function signCallback(file, storage) {
  const signed = { ...file }
  storage.signAssetFile(signed)
  return signed
}

describe('Model._mapAssetFiles: asset signing across data paths', () => {
  it('writes the signature back to a literal data path', () => {
    const model = makeFakeModel({ 'image.file': { storage: 'test' } })
    const json = { image: { file: { key: 'foo.png' } } }
    Model._mapAssetFiles.call(model, json, signCallback)
    expect(json.image.file.signature).toBe('sig-of-foo.png')
  })

  it('writes the signature back to every match of a deep wildcard', () => {
    const model = makeFakeModel({ '**.file': { storage: 'test' } })
    const json = {
      content: {
        file: { key: 'a.png' },
        sections: [
          { file: { key: 'b.png' } },
          { file: { key: 'c.png' } }
        ]
      }
    }
    Model._mapAssetFiles.call(model, json, signCallback)
    expect(json.content.file.signature).toBe('sig-of-a.png')
    expect(json.content.sections[0].file.signature).toBe('sig-of-b.png')
    expect(json.content.sections[1].file.signature).toBe('sig-of-c.png')
  })

  it('writes the signature back into wildcard array values', () => {
    const model = makeFakeModel({ '**.files': { storage: 'test' } })
    const json = {
      content: {
        files: [{ key: 'x.png' }, { key: 'y.png' }]
      }
    }
    Model._mapAssetFiles.call(model, json, signCallback)
    expect(json.content.files[0].signature).toBe('sig-of-x.png')
    expect(json.content.files[1].signature).toBe('sig-of-y.png')
  })

  it('is a no-op when the wildcard matches nothing', () => {
    const model = makeFakeModel({ '**.file': { storage: 'test' } })
    const json = { name: 'no-files-here' }
    Model._mapAssetFiles.call(model, json, signCallback)
    expect(json).toEqual({ name: 'no-files-here' })
  })
})
