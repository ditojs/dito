import {
  test, expect, createModelHelpers,
  getMultiselect
} from '../fixtures.js'
import { SelectWidget } from '../models/SelectWidget.js'

const { seed, saveAndFetch } = createModelHelpers(SelectWidget, 'select-widgets')

test(
  'multiselectMultiple: remove tag + add option',
  async ({ page, url }) => {
    const widgetId = await seed({
      multiselectMultiple: ['alpha', 'beta']
    })

    await page.goto(
      `${url}/admin/select/${widgetId}`
    )
    await expect(
      page.locator('.multiselect').first()
    ).toBeVisible({ timeout: 15_000 })

    const ms = getMultiselect(
      page, 'Multiselect Multiple'
    )

    await expect(
      ms.locator('.multiselect__tag')
    ).toHaveCount(2)
    await ms.locator(
      '.multiselect__tag-icon'
    ).first().click()
    await expect(
      ms.locator('.multiselect__tag')
    ).toHaveCount(1)

    await ms.click()
    await ms.locator(
      '.multiselect__option'
    ).filter({ hasText: 'Gamma' }).click()
    await expect(
      ms.locator('.multiselect__tag')
    ).toHaveCount(2)

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(
      widget.multiselectMultiple
    ).toEqual(
      expect.arrayContaining(['beta', 'gamma'])
    )
  }
)

test(
  'multiselectSearchable: search and select',
  async ({ page, url }) => {
    const widgetId = await seed({
      multiselectSearchable: ['alpha']
    })

    await page.goto(
      `${url}/admin/select/${widgetId}`
    )
    await expect(
      page.locator('.multiselect').first()
    ).toBeVisible({ timeout: 15_000 })

    const ms = getMultiselect(
      page, 'Multiselect Searchable'
    )

    await ms.click()
    const input = ms.locator(
      '.multiselect__input'
    )
    await input.fill('gam')
    await ms.locator(
      '.multiselect__option'
    ).first().click()
    await expect(
      ms.locator('.multiselect__tag')
    ).toHaveCount(2)

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(
      widget.multiselectSearchable
    ).toEqual(
      expect.arrayContaining(['alpha', 'gamma'])
    )
  }
)

test(
  'multiselectTaggable: create new tag',
  async ({ page, url }) => {
    const widgetId = await seed({
      multiselectTaggable: ['alpha']
    })

    await page.goto(
      `${url}/admin/select/${widgetId}`
    )
    await expect(
      page.locator('.multiselect').first()
    ).toBeVisible({ timeout: 15_000 })

    const ms = getMultiselect(
      page, 'Multiselect Taggable'
    )

    await ms.click()
    const input = ms.locator(
      '.multiselect__input'
    )
    await input.fill('delta')
    await page.keyboard.press('Enter')
    await expect(
      ms.locator('.multiselect__tag')
    ).toHaveCount(2)

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(
      widget.multiselectTaggable
    ).toEqual(
      expect.arrayContaining(['alpha', 'delta'])
    )
  }
)
