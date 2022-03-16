import * as index from './index.js'

describe('index', () => {
  it('exports all symbols', () => {
    expect(index).toMatchSnapshot()
  })
})
