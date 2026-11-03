import { test, expect, setColumns } from '../fixtures.js'
import { getCase } from '../cases/index.js'
import { list } from '../../../utils/drivers/structure.js'

// List markup beyond value round-trips, using the cases' views.

test.describe('list', () => {
  test('renders item header labels without for', async ({ page, url }) => {
    // Header labels label the whole item, not an input. Their data path
    // would point nowhere, or to an input with `wrapPrimitives`.
    const entry = getCase('list', 'shows stored items')
    await setColumns({ [entry.name]: [{ name: 'One' }] })
    await page.goto(`${url}/admin/${entry.path}`)
    const labels = list
      .getElement(page, entry)
      .locator('.dito-schema-header label')
    await expect(labels).toHaveCount(1)
    await expect(labels).not.toHaveAttribute('for')
  })
})
