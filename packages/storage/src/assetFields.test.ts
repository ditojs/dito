import { findAssetFiles } from './assetFields.ts'
import { file } from './test/assets.ts'

describe('findAssetFiles()', () => {
  it('finds files at the column itself, also in arrays', () => {
    expect(findAssetFiles(file('a'), '')).toEqual([
      { file: file('a'), path: '' }
    ])
    expect(findAssetFiles([file('a'), null, file('b')], '')).toEqual([
      { file: file('a'), path: '0' },
      { file: file('b'), path: '2' }
    ])
  })

  it('matches `*` on one segment', () => {
    const value = [{ images: [file('a')] }, { images: file('b') }, {}]
    expect(findAssetFiles(value, '*/images')).toEqual([
      { file: file('a'), path: '0/images/0' },
      { file: file('b'), path: '1/images' }
    ])
  })

  it('matches `**` on any depth, also at the top', () => {
    const value = {
      file: file('a'),
      items: [{ file: file('b') }, { nested: { file: file('c') } }]
    }
    expect(findAssetFiles(value, '**.file').map(found => found.path)).toEqual([
      'file',
      'items/0/file',
      'items/1/nested/file'
    ])
    expect(findAssetFiles(value, 'items[**].file')).toHaveLength(2)
  })

  it('skips values without a string key', () => {
    expect(findAssetFiles({ file: 'a.png' }, 'file')).toEqual([])
    expect(findAssetFiles(null, '*/images')).toEqual([])
  })
})
