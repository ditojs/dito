import {
  test, expect, createModelHelpers,
  getInput, getContainer
} from '../fixtures.js'
import { TextWidget } from '../models/TextWidget.js'

const { seed, saveAndFetch } = createModelHelpers(
  TextWidget,
  'text-widgets',
  { textRequired: 'required value' }
)

test(
  'textBasic: type new text, save, verify',
  async ({ page, url }) => {
    const widgetId = await seed({
      textBasic: 'hello'
    })

    await page.goto(
      `${url}/admin/text/${widgetId}`
    )
    await expect(
      getInput(page, 'textBasic')
    ).toBeVisible({ timeout: 15_000 })

    const input = getInput(page, 'textBasic')
    await input.fill('updated')
    await expect(input).toHaveValue('updated')

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.textBasic).toBe('updated')
  }
)

test(
  'textReadonly: cannot edit (readonly attr, ' +
  'type x, value unchanged)',
  async ({ page, url }) => {
    const widgetId = await seed({
      textReadonly: 'read-only value'
    })

    await page.goto(
      `${url}/admin/text/${widgetId}`
    )
    await expect(
      getInput(page, 'textReadonly')
    ).toBeVisible({ timeout: 15_000 })

    const input = getInput(page, 'textReadonly')
    await expect(input).toHaveAttribute(
      'readonly', ''
    )
    await input.focus()
    await page.keyboard.type('x')
    await expect(input).toHaveValue(
      'read-only value'
    )
  }
)

test(
  'textDisabled: is disabled',
  async ({ page, url }) => {
    const widgetId = await seed({
      textDisabled: 'locked'
    })

    await page.goto(
      `${url}/admin/text/${widgetId}`
    )
    await expect(
      getInput(page, 'textDisabled')
    ).toBeVisible({ timeout: 15_000 })

    await expect(
      getInput(page, 'textDisabled')
    ).toBeDisabled()
  }
)

test(
  'textClearable: click clear → empty, save, ' +
  'verify null',
  async ({ page, url }) => {
    const widgetId = await seed({
      textClearable: 'clearable value'
    })

    await page.goto(
      `${url}/admin/text/${widgetId}`
    )
    await expect(
      getInput(page, 'textClearable')
    ).toBeVisible({ timeout: 15_000 })

    const container = getContainer(
      page, 'textClearable'
    )
    await container.hover()
    await container.locator(
      '.dito-affixes__clear'
    ).click()
    await expect(
      getInput(page, 'textClearable')
    ).toHaveValue('')

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.textClearable).toBeNull()
  }
)

test(
  'textRequired: empty → validation error, ' +
  'then fill required value',
  async ({ page, url }) => {
    const widgetId = await seed({
      textRequired: 'initial'
    })

    await page.goto(
      `${url}/admin/text/${widgetId}`
    )
    await expect(
      getInput(page, 'textRequired')
    ).toBeVisible({ timeout: 15_000 })

    await getInput(page, 'textRequired').fill('')
    await page.locator(
      'button.dito-button[type="submit"]'
    ).first().click()
    await expect(
      page.locator(
        '.dito-container--has-errors'
      ).first()
    ).toBeVisible({ timeout: 5_000 })

    await getInput(
      page, 'textRequired'
    ).fill('required value')

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.textRequired).toBe(
      'required value'
    )
  }
)

test(
  'textCompute: fill textComputeSource with ' +
  '\'reactive\', verify textCompute updates',
  async ({ page, url }) => {
    const widgetId = await seed({
      textComputeSource: '',
      textCompute: ''
    })

    await page.goto(
      `${url}/admin/text/${widgetId}`
    )
    await expect(
      getInput(page, 'textComputeSource')
    ).toBeVisible({ timeout: 15_000 })

    await getInput(
      page, 'textComputeSource'
    ).fill('reactive')
    await getInput(
      page, 'textComputeSource'
    ).blur()
    await expect(
      getInput(page, 'textCompute')
    ).toHaveValue('reactive')
  }
)

test(
  'textFormat: seed \'hello\', displayed as ' +
  '\'HELLO\'',
  async ({ page, url }) => {
    const widgetId = await seed({
      textFormat: 'hello'
    })

    await page.goto(
      `${url}/admin/text/${widgetId}`
    )
    await expect(
      getInput(page, 'textFormat')
    ).toBeVisible({ timeout: 15_000 })

    await expect(
      getInput(page, 'textFormat')
    ).toHaveValue('HELLO')
  }
)

test(
  'textParse: type HELLO → lowercase on blur, ' +
  'save, verify \'hello\'',
  async ({ page, url }) => {
    const widgetId = await seed({
      textParse: ''
    })

    await page.goto(
      `${url}/admin/text/${widgetId}`
    )
    await expect(
      getInput(page, 'textParse')
    ).toBeVisible({ timeout: 15_000 })

    const input = getInput(page, 'textParse')
    await input.fill('HELLO')
    await input.blur()
    await expect(input).toHaveValue('hello')

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.textParse).toBe('hello')
  }
)

test(
  'textProcess: type with whitespace, save, ' +
  'verify trimmed',
  async ({ page, url }) => {
    const widgetId = await seed({
      textProcess: ''
    })

    await page.goto(
      `${url}/admin/text/${widgetId}`
    )
    await expect(
      getInput(page, 'textProcess')
    ).toBeVisible({ timeout: 15_000 })

    await getInput(
      page, 'textProcess'
    ).fill('  trimmed  ')

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.textProcess).toBe('trimmed')
  }
)

test(
  'textEmail: type new email, save, verify',
  async ({ page, url }) => {
    const widgetId = await seed({
      textEmail: 'old@example.com'
    })

    await page.goto(
      `${url}/admin/text/${widgetId}`
    )
    await expect(
      getInput(page, 'textEmail')
    ).toBeVisible({ timeout: 15_000 })

    const input = getInput(page, 'textEmail')
    await input.fill('new@test.com')
    await expect(input).toHaveValue('new@test.com')

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.textEmail).toBe('new@test.com')
  }
)

test(
  'textUrl: type new URL, save, verify',
  async ({ page, url }) => {
    const widgetId = await seed({
      textUrl: 'https://example.com'
    })

    await page.goto(
      `${url}/admin/text/${widgetId}`
    )
    await expect(
      getInput(page, 'textUrl')
    ).toBeVisible({ timeout: 15_000 })

    const input = getInput(page, 'textUrl')
    await input.fill('https://new.example.com')
    await expect(input).toHaveValue(
      'https://new.example.com'
    )

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.textUrl).toBe(
      'https://new.example.com'
    )
  }
)

test(
  'textPassword: type masked (check ' +
  'type=password), save, verify',
  async ({ page, url }) => {
    const widgetId = await seed({
      textPassword: 'secret'
    })

    await page.goto(
      `${url}/admin/text/${widgetId}`
    )
    await expect(
      getInput(page, 'textPassword')
    ).toBeVisible({ timeout: 15_000 })

    const input = getInput(page, 'textPassword')
    await expect(input).toHaveAttribute(
      'type', 'password'
    )
    await input.fill('new-secret')
    await expect(input).toHaveValue('new-secret')

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.textPassword).toBe('new-secret')
  }
)

test(
  'textTrim: type padded → trimmed on blur, ' +
  'save, verify',
  async ({ page, url }) => {
    const widgetId = await seed({
      textTrim: ''
    })

    await page.goto(
      `${url}/admin/text/${widgetId}`
    )
    await expect(
      getInput(page, 'textTrim')
    ).toBeVisible({ timeout: 15_000 })

    const input = getInput(page, 'textTrim')
    await input.fill('  hello  ')
    await input.blur()

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(widget.textTrim).toBe('hello')
  }
)
