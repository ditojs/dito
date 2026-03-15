import {
  test, expect, createModelHelpers
} from '../fixtures.js'
import { SourceWidget } from '../models/SourceWidget.js'

const { seed, saveAndFetch } = createModelHelpers(
  SourceWidget, 'source-widgets'
)

// --- Single form (list with `form`) ---

test(
  'listForm: create item via form, fill fields, save',
  async ({ page, url }) => {
    const widgetId = await seed({
      listForm: []
    })

    await page.goto(
      `${url}/admin/source/${widgetId}`
    )
    const list = page.locator(
      '.dito-list#listForm'
    )
    await expect(list).toBeVisible(
      { timeout: 15_000 }
    )

    // Click create — should expand inlined form
    await list.locator('tfoot button').click()
    const inlined = list.locator(
      '.dito-schema-inlined'
    )
    await expect(inlined).toBeVisible()

    // Fill form fields
    await inlined.locator(
      'input[id$="title"]'
    ).fill('Test Title')
    await inlined.locator(
      'textarea[id$="description"]'
    ).fill('Test Description')

    const { listForm} = await saveAndFetch(
      page, widgetId
    )
    expect(listForm).toHaveLength(1)
    const item = listForm![0]!;
    expect(item.title).toBe(
      'Test Title'
    )
    expect(item.description).toBe(
      'Test Description'
    )
  }
)

test(
  'listForm: seed items, edit, delete, save',
  async ({ page, url }) => {
    const widgetId = await seed({
      listForm: [
        { title: 'First', description: 'Desc 1' },
        { title: 'Second', description: 'Desc 2' }
      ]
    })

    await page.goto(
      `${url}/admin/source/${widgetId}`
    )
    const list = page.locator(
      '.dito-list#listForm'
    )
    await expect(list).toBeVisible(
      { timeout: 15_000 }
    )

    // Should show 2 items
    await expect(
      list.locator('tbody tr')
    ).toHaveCount(2)

    // Click first row to expand its inlined form
    await list.locator('tbody tr').first().click()
    const inlined = list.locator(
      '.dito-schema-inlined'
    ).first()
    await expect(inlined).toBeVisible()

    // Edit the title
    const titleInput = inlined.locator(
      'input[id$="title"]'
    )
    await titleInput.fill('Updated First')

    // Delete second item
    page.once('dialog', d => d.accept())
    await list.locator(
      '.dito-button--remove'
    ).last().click()
    await expect(
      list.locator('tbody tr')
    ).toHaveCount(1)

    const { listForm } = await saveAndFetch(
      page, widgetId
    )
    expect(listForm).toHaveLength(1)
    expect(listForm![0].title).toBe(
      'Updated First'
    )
  }
)

// --- Multiple forms (list with `forms`) ---

test(
  'listForms: create button shows type dropdown',
  async ({ page, url }) => {
    const widgetId = await seed({
      listForms: []
    })

    await page.goto(
      `${url}/admin/source/${widgetId}`
    )
    const list = page.locator(
      '.dito-list#listForms'
    )
    await expect(list).toBeVisible(
      { timeout: 15_000 }
    )

    // Create button should show pulldown
    const createBtn = list.locator(
      'tfoot button'
    )
    await createBtn.click()
    const pulldown = list.locator(
      '.dito-pulldown'
    )
    await expect(pulldown).toBeVisible()

    // Should have 2 options: Link and Note
    const items = pulldown.locator(
      '.dito-pulldown__item'
    )
    await expect(items).toHaveCount(2)
    await expect(
      items.first()
    ).toContainText('Link')
    await expect(
      items.last()
    ).toContainText('Note')
  }
)

test(
  'listForms: create link item, fill, save',
  async ({ page, url }) => {
    const widgetId = await seed({
      listForms: []
    })

    await page.goto(
      `${url}/admin/source/${widgetId}`
    )
    const list = page.locator(
      '.dito-list#listForms'
    )
    await expect(list).toBeVisible(
      { timeout: 15_000 }
    )

    // Open pulldown and select Link
    await list.locator('tfoot button').click()
    await list.locator(
      '.dito-pulldown__item'
    ).filter({ hasText: 'Link' }).click()

    // Inlined form should appear with link fields
    const inlined = list.locator(
      '.dito-schema-inlined'
    )
    await expect(inlined).toBeVisible()
    await inlined.locator(
      'input[id$="title"]'
    ).fill('My Link')
    await inlined.locator(
      'input[id$="url"]'
    ).fill('https://example.com')

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.listForms!).toHaveLength(1)
    expect(widget.listForms![0].type).toBe('link')
    expect(widget.listForms![0].title).toBe(
      'My Link'
    )
    expect(widget.listForms![0].url).toBe(
      'https://example.com'
    )
  }
)

test(
  'listForms: create note item, fill, save',
  async ({ page, url }) => {
    const widgetId = await seed({
      listForms: []
    })

    await page.goto(
      `${url}/admin/source/${widgetId}`
    )
    const list = page.locator(
      '.dito-list#listForms'
    )
    await expect(list).toBeVisible(
      { timeout: 15_000 }
    )

    // Open pulldown and select Note
    await list.locator('tfoot button').click()
    await list.locator(
      '.dito-pulldown__item'
    ).filter({ hasText: 'Note' }).click()

    const inlined = list.locator(
      '.dito-schema-inlined'
    )
    await expect(inlined).toBeVisible()
    await inlined.locator(
      'textarea[id$="body"]'
    ).fill('A quick note')

    const { listForms} = await saveAndFetch(
      page, widgetId
    )
    expect(listForms).toHaveLength(1)
    const item = listForms![0]!;
    expect(item.type).toBe('note')
    expect(item.body).toBe(
      'A quick note'
    )
  }
)

test(
  'listForms: seed mixed types, verify forms render',
  async ({ page, url }) => {
    const widgetId = await seed({
      listForms: [
        {
          type: 'link',
          title: 'Example',
          url: 'https://example.com'
        },
        {
          type: 'note',
          body: 'Hello'
        }
      ]
    })

    await page.goto(
      `${url}/admin/source/${widgetId}`
    )
    const list = page.locator(
      '.dito-list#listForms'
    )
    await expect(list).toBeVisible(
      { timeout: 15_000 }
    )

    // Should show 2 items
    await expect(
      list.locator('tbody tr')
    ).toHaveCount(2)

    // Click first item (link) — should show
    // title and url fields
    await list.locator(
      'tbody tr'
    ).first().click()
    const linkForm = list.locator(
      '.dito-schema-inlined'
    ).first()
    await expect(linkForm).toBeVisible()
    await expect(
      linkForm.locator('input[id$="title"]')
    ).toHaveValue('Example')
    await expect(
      linkForm.locator('input[id$="url"]')
    ).toHaveValue('https://example.com')
  }
)
