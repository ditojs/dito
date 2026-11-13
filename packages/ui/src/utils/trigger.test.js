import { getSideAndAlign } from './trigger.js'

describe('getSideAndAlign()', () => {
  it('returns the side and the alignment of placements', () => {
    expect(getSideAndAlign('bottom')).toEqual({
      side: 'bottom',
      align: 'start'
    })
    expect(getSideAndAlign('bottom-left')).toEqual({
      side: 'bottom',
      align: 'start'
    })
    expect(getSideAndAlign('bottom-right')).toEqual({
      side: 'bottom',
      align: 'end'
    })
    expect(getSideAndAlign('top-center')).toEqual({
      side: 'top',
      align: 'center'
    })
    expect(getSideAndAlign('right-bottom')).toEqual({
      side: 'right',
      align: 'end'
    })
  })
})
