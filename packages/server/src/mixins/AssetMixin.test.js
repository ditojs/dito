import { Application } from '../app/Application.js'
import { AssetModel } from '../models/AssetModel.js'

class Asset extends AssetModel {}

const app = new Application({
  config: { log: { silent: true } },
  models: { Asset }
})

beforeAll(() => app.setupModels())

describe('AssetMixin#$parseJson()', () => {
  it('parses the time-stamp attributes to dates', () => {
    const asset = Asset.fromJson({
      key: 'image.png',
      storage: 'files',
      createdAt: '2026-05-14T10:00:00.000Z',
      updatedAt: '2026-05-15T10:00:00.000Z'
    })
    expect(asset.createdAt).toBeInstanceOf(Date)
    expect(asset.createdAt.toISOString()).toBe('2026-05-14T10:00:00.000Z')
    expect(asset.updatedAt).toBeInstanceOf(Date)
    expect(asset.updatedAt.toISOString()).toBe('2026-05-15T10:00:00.000Z')
  })
})
