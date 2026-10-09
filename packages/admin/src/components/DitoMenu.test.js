import { mountAdmin } from '../test/mount.js'

describe('DitoMenu', () => {
  const views = {
    'books': { type: 'view', label: 'Books', components: {} },
    'books-archive': {
      type: 'view',
      label: 'Archive',
      components: {}
    }
  }

  const getActiveLabels = admin =>
    admin.wrapper
      .findAll('.dito-menu__link--active')
      .map(link => link.text())

  it('marks the item of the current view as active', async () => {
    const admin = await mountAdmin({ views })
    await admin.navigate('/books')
    expect(getActiveLabels(admin)).toEqual(['Books'])
  })

  it(`doesn't mark items that only share a prefix as active`, async () => {
    const admin = await mountAdmin({ views })
    await admin.navigate('/books-archive')
    expect(getActiveLabels(admin)).toEqual(['Archive'])
  })
})
