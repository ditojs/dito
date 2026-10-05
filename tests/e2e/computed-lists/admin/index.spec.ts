import { test, expect } from '../fixtures.js'
import { Dashboard } from '../models/Dashboard.js'
import { Team } from '../models/Team.js'
import { DitoForm } from '../../../utils/pages.js'

test.describe('computed lists', () => {
  test('settles lists computed from other lists', async ({ page, url }) => {
    // Loops that the data model stops are reported as errors, which fail the
    // test, see `browser-errors.ts`.
    const team = await Team.query().insert({
      name: 'Team',
      members: [{ name: 'Ada' }, { name: 'Grace' }],
      rotas: [
        {
          numDays: 5,
          assignments: [
            { member: 'Ada', days: [1, 3] },
            { member: 'Grace', days: [2, 4] }
          ]
        }
      ]
    })
    await page.goto(`${url}/admin/teams/${team.id}`)
    await page
      .getByRole('region', { name: 'Rotas' })
      .getByRole('button', { name: '1' })
      .click()
    await expect(
      page.getByLabel('Number of Days', { exact: true })
    ).toHaveValue('5')
    await new DitoForm(page).save()
    const { rotas } = (await Team.query().findById(team.id))!
    expect(rotas?.[0].assignments).toEqual([
      { member: 'Ada', days: [1, 3], hours: 0 },
      { member: 'Grace', days: [2, 4], hours: 0 }
    ])
  })

  test('offers the forms of lists computed in collapsed items', async ({
    page,
    url
  }) => {
    const dashboard = await Dashboard.query().insert({
      name: 'Dashboard',
      widgets: [{ title: 'Sales' }]
    })
    await page.goto(`${url}/admin/dashboards/${dashboard.id}`)
    await page
      .getByRole('region', { name: 'Widgets' })
      .getByRole('button', { name: '1' })
      .click()
    await expect(page.getByLabel('Widget Title', { exact: true })).toHaveValue(
      'Sales'
    )
    await expect(page.getByRole('button', { name: 'Add Size' })).toBeVisible()
  })
})
