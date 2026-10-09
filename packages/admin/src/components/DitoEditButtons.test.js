import { mountForm, settle } from '../test/mount.js'

function getChaptersSchema(form = {}) {
  return {
    components: {
      chapters: {
        type: 'list',
        editable: true,
        deletable: true,
        itemLabel: 'title',
        form: {
          type: 'form',
          components: { title: { type: 'text' } },
          ...form
        }
      }
    }
  }
}

describe('DitoEditButtons', () => {
  it('renders edit links that are named by their verb', async () => {
    const { findField } = await mountForm({
      schema: getChaptersSchema(),
      data: { chapters: [{ title: 'Prologue' }] }
    })
    const link = findField('chapters').find('a.dito-button--edit')
    expect(link.attributes('aria-label')).toBe('Edit')
    expect(link.attributes('aria-disabled')).toBeUndefined()
    expect(link.attributes('tabindex')).toBeUndefined()
  })

  it('takes disabled edit links out of the tab order', async () => {
    const { findField } = await mountForm({
      schema: getChaptersSchema({ editable: false }),
      data: { chapters: [{ title: 'Prologue' }] }
    })
    const link = findField('chapters').find('a.dito-button--edit')
    expect(link.classes()).toContain('dito-button--disabled')
    expect(link.attributes('aria-disabled')).toBe('true')
    expect(link.attributes('tabindex')).toBe('-1')
  })

  it(`doesn't navigate through disabled edit links`, async () => {
    const { admin, findField } = await mountForm({
      schema: getChaptersSchema({ editable: false }),
      data: { chapters: [{ title: 'Prologue' }] }
    })
    const path = admin.router.currentRoute.value.fullPath
    const link = findField('chapters').find('a.dito-button--edit')
    expect(link.attributes('href')).toBeDefined()
    await link.trigger('click')
    await settle(admin.root)
    expect(admin.router.currentRoute.value.fullPath).toBe(path)
  })

  it(`renders remove buttons that don't submit the form`, async () => {
    const { findField } = await mountForm({
      schema: getChaptersSchema(),
      data: { chapters: [{ title: 'Prologue' }] }
    })
    const button = findField('chapters').find('.dito-button--remove')
    expect(button.element.tagName).toBe('BUTTON')
    expect(button.attributes('type')).toBe('button')
    expect(button.attributes('aria-label')).toBe('Remove')
  })
})
