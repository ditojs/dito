import * as index from './index'

describe('index', () => {
  it('exports all symbols', () => {
    expect(index).toMatchSnapshot()
  })
})
