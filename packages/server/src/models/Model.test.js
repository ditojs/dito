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

describe('Model.getProperty: type inference for $ref/discriminator schemas', () => {
  function getProperty({ name, properties, definitions = {} }) {
    return Model.getProperty.call(
      { definition: { properties }, jsonSchema: { definitions } },
      name
    )
  }

  it('returns the property unchanged when it has an explicit type', () => {
    expect(
      getProperty({
        name: 'name',
        properties: { name: { type: 'string' } }
      })
    ).toEqual({ type: 'string' })
  })

  it('infers type: object from a discriminator on a $ref schema', () => {
    const property = getProperty({
      name: 'content',
      properties: { content: { $ref: '#StoryContent' } },
      definitions: {
        '#StoryContent': {
          discriminator: { propertyName: 'type' },
          oneOf: [
            { type: 'object', properties: { type: { const: 'a' } } },
            { type: 'object', properties: { type: { const: 'b' } } }
          ]
        }
      }
    })
    expect(property.type).toBe('object')
    expect(property.discriminator).toEqual({ propertyName: 'type' })
  })

  it('infers a shared type from a homogeneous oneOf', () => {
    const property = getProperty({
      name: 'content',
      properties: {
        content: { oneOf: [{ type: 'object' }, { type: 'object' }] }
      }
    })
    expect(property.type).toBe('object')
  })

  it('infers a shared type from a homogeneous anyOf', () => {
    const property = getProperty({
      name: 'content',
      properties: {
        content: { anyOf: [{ type: 'array' }, { type: 'array' }] }
      }
    })
    expect(property.type).toBe('array')
  })

  it('leaves type undefined when oneOf branches disagree', () => {
    const property = getProperty({
      name: 'content',
      properties: {
        content: { oneOf: [{ type: 'object' }, { type: 'string' }] }
      }
    })
    expect(property.type).toBeUndefined()
  })

  it('returns null for an unknown property', () => {
    expect(getProperty({ name: 'missing', properties: {} })).toBeNull()
  })
})

describe('Model.getPropertyOrRelationAtDataPath: traversal through inferred types', () => {
  function lookup({ dataPath, properties, definitions = {} }) {
    const host = {
      definition: { properties },
      jsonSchema: { definitions },
      getRelations: () => ({}),
      getProperty(name) {
        return Model.getProperty.call(this, name)
      }
    }
    return Model.getPropertyOrRelationAtDataPath.call(host, dataPath)
  }

  it('exposes object type for a discriminator-rooted nested wildcard path', () => {
    // Reproduces the original loadDataPath() crash on
    // `content.article.items[**].file`: before the fix, `content` had
    // no resolved `type`, so loadDataPath rejected the nested path.
    const result = lookup({
      dataPath: 'content.article.items[**].file',
      properties: { content: { $ref: '#StoryContent' } },
      definitions: {
        '#StoryContent': {
          discriminator: { propertyName: 'type' },
          oneOf: [{ type: 'object' }]
        }
      }
    })
    expect(result.property.type).toBe('object')
    expect(result.nestedDataPath).toBe('article/items/**/file')
    expect(result.dataPath).toBe('content')
  })

  it('returns no nestedDataPath for a leaf property lookup', () => {
    const result = lookup({
      dataPath: 'name',
      properties: { name: { type: 'string' } }
    })
    expect(result.property).toEqual({ type: 'string' })
    expect(result.nestedDataPath).toBe('')
  })
})
