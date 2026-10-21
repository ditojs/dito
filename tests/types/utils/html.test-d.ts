import { describe, expectTypeOf, it } from 'vitest'
import { html, isHtml, type Html } from '@ditojs/utils'

describe('html', () => {
  it('returns Html from tagged templates and arrays of strings', () => {
    expectTypeOf(html`<b>${'Tom & Jerry'}</b>`).toEqualTypeOf<Html>()
    expectTypeOf(html(['<b>bold</b>'])).toEqualTypeOf<Html>()
    expectTypeOf(html`<b>bold</b>`.value).toBeString()
  })

  it('narrows values with isHtml()', () => {
    const value = {} as string | Html
    if (isHtml(value)) {
      expectTypeOf(value).toEqualTypeOf<Html>()
    }
  })
})
