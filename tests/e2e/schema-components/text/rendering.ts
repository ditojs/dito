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
  'textReadonly: input has readonly attribute',
  async ({ page, url }) => {
    const widgetId = await seed({
      textReadonly: 'read-only value'
    })
    await page.goto(`${url}/admin/text/${widgetId}`)
    await expect(
      getInput(page, 'textReadonly')
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      getInput(page, 'textReadonly')
    ).toHaveAttribute('readonly', '')
  }
)

test(
  'textDisabled: input is disabled',
  async ({ page, url }) => {
    const widgetId = await seed({
      textDisabled: 'locked'
    })
    await page.goto(`${url}/admin/text/${widgetId}`)
    await expect(
      getInput(page, 'textDisabled')
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      getInput(page, 'textDisabled')
    ).toBeDisabled()
  }
)

test(
  'textClearable: clear button appears on hover',
  async ({ page, url }) => {
    const widgetId = await seed({
      textClearable: 'clearable value'
    })
    await page.goto(`${url}/admin/text/${widgetId}`)
    const container = getContainer(
      page, 'textClearable'
    )
    await expect(
      getInput(page, 'textClearable')
    ).toBeVisible({ timeout: 15_000 })
    await container.hover()
    await expect(
      container.locator('.dito-affixes__clear')
    ).toBeVisible()
  }
)

test(
  'textPlaceholder: placeholder attribute present',
  async ({ page, url }) => {
    const widgetId = await seed({
      textPlaceholder: null
    })
    await page.goto(`${url}/admin/text/${widgetId}`)
    await expect(
      getInput(page, 'textPlaceholder')
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      getInput(page, 'textPlaceholder')
    ).toHaveAttribute('placeholder', 'hint text')
  }
)

test(
  'textInfo: info element visible',
  async ({ page, url }) => {
    const widgetId = await seed({
      textInfo: 'info value'
    })
    await page.goto(`${url}/admin/text/${widgetId}`)
    await expect(
      getInput(page, 'textInfo')
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      getContainer(page, 'textInfo')
        .locator('.dito-info')
    ).toBeVisible()
  }
)

test(
  'textWidthFill: has fill class',
  async ({ page, url }) => {
    const widgetId = await seed({
      textWidthFill: 'fill'
    })
    await page.goto(`${url}/admin/text/${widgetId}`)
    await expect(
      getInput(page, 'textWidthFill')
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      getContainer(page, 'textWidthFill')
        .locator('.dito-component')
    ).toHaveClass(/dito-component--fill/)
  }
)

test(
  'textWidthAuto: does not have fill class',
  async ({ page, url }) => {
    const widgetId = await seed({
      textWidthAuto: 'auto'
    })
    await page.goto(`${url}/admin/text/${widgetId}`)
    await expect(
      getInput(page, 'textWidthAuto')
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      getContainer(page, 'textWidthAuto')
        .locator('.dito-component')
    ).not.toHaveClass(/dito-component--fill/)
  }
)

test(
  'textWidthHalf: --basis CSS var ~50%',
  async ({ page, url }) => {
    const widgetId = await seed({
      textWidthHalf: 'half'
    })
    await page.goto(`${url}/admin/text/${widgetId}`)
    await expect(
      getInput(page, 'textWidthHalf')
    ).toBeVisible({ timeout: 15_000 })
    const container = getContainer(
      page, 'textWidthHalf'
    )
    const basis = await container.evaluate(
      el => getComputedStyle(el)
        .getPropertyValue('--basis').trim()
    )
    expect(basis).toBe('50%')
  }
)

test(
  'textWidthThird: --basis CSS var ~33%',
  async ({ page, url }) => {
    const widgetId = await seed({
      textWidthThird: 'third'
    })
    await page.goto(`${url}/admin/text/${widgetId}`)
    await expect(
      getInput(page, 'textWidthThird')
    ).toBeVisible({ timeout: 15_000 })
    const container = getContainer(
      page, 'textWidthThird'
    )
    const basis = await container.evaluate(
      el => getComputedStyle(el)
        .getPropertyValue('--basis').trim()
    )
    expect(parseFloat(basis)).toBeCloseTo(33.33, 0)
  }
)

test(
  'textLabelFalse: no .dito-label rendered',
  async ({ page, url }) => {
    const widgetId = await seed({
      textLabelFalse: 'no label'
    })
    await page.goto(`${url}/admin/text/${widgetId}`)
    await expect(
      getInput(page, 'textLabelFalse')
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      getContainer(page, 'textLabelFalse')
        .locator('.dito-label')
    ).toHaveCount(0)
  }
)

test(
  'textPrefix: $ text visible',
  async ({ page, url }) => {
    const widgetId = await seed({
      textPrefix: '42'
    })
    await page.goto(`${url}/admin/text/${widgetId}`)
    await expect(
      getInput(page, 'textPrefix')
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      getContainer(page, 'textPrefix')
        .locator('.dito-affix--text')
    ).toContainText('$')
  }
)

test(
  'textSuffix: kg text visible',
  async ({ page, url }) => {
    const widgetId = await seed({
      textSuffix: '75'
    })
    await page.goto(`${url}/admin/text/${widgetId}`)
    await expect(
      getInput(page, 'textSuffix')
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      getContainer(page, 'textSuffix')
        .locator('.dito-affix--text')
    ).toContainText('kg')
  }
)

test(
  'textDefault: navigates to create and checks default value',
  async ({ page, url }) => {
    await page.goto(`${url}/admin/text/create`)
    await expect(
      getInput(page, 'textDefault')
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      getInput(page, 'textDefault')
    ).toHaveValue('fallback')
  }
)

test(
  'textCompute: value updates reactively from source',
  async ({ page, url }) => {
    const widgetId = await seed({
      textComputeSource: '',
      textCompute: ''
    })
    await page.goto(`${url}/admin/text/${widgetId}`)
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
  'textFormat: displayed value is uppercased',
  async ({ page, url }) => {
    const widgetId = await seed({
      textFormat: 'hello'
    })
    await page.goto(`${url}/admin/text/${widgetId}`)
    await expect(
      getInput(page, 'textFormat')
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      getInput(page, 'textFormat')
    ).toHaveValue('HELLO')
  }
)

test(
  'textParse: typed value is lowercased on blur',
  async ({ page, url }) => {
    const widgetId = await seed({
      textParse: ''
    })
    await page.goto(`${url}/admin/text/${widgetId}`)
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
  'textProcess: field renders and accepts input',
  async ({ page, url }) => {
    const widgetId = await seed({
      textProcess: 'processable'
    })
    await page.goto(`${url}/admin/text/${widgetId}`)
    await expect(
      getInput(page, 'textProcess')
    ).toBeVisible({ timeout: 15_000 })
    await getInput(
      page, 'textProcess'
    ).fill('  trimmed  ')
    await expect(
      getInput(page, 'textProcess')
    ).toHaveValue('  trimmed  ')
  }
)

test(
  'textBasic: renders text input with value',
  async ({ page, url }) => {
    const widgetId = await seed({
      textBasic: 'hello'
    })
    await page.goto(`${url}/admin/text/${widgetId}`)
    await expect(
      getInput(page, 'textBasic')
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      getInput(page, 'textBasic')
    ).toHaveValue('hello')
  }
)

test(
  'textEmail: input type is email',
  async ({ page, url }) => {
    const widgetId = await seed({
      textEmail: 'test@example.com'
    })
    await page.goto(`${url}/admin/text/${widgetId}`)
    await expect(
      getInput(page, 'textEmail')
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      getInput(page, 'textEmail')
    ).toHaveAttribute('type', 'email')
  }
)

test(
  'textUrl: input type is url',
  async ({ page, url }) => {
    const widgetId = await seed({
      textUrl: 'https://example.com'
    })
    await page.goto(`${url}/admin/text/${widgetId}`)
    await expect(
      getInput(page, 'textUrl')
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      getInput(page, 'textUrl')
    ).toHaveAttribute('type', 'url')
  }
)

test(
  'textHostname: input type is text',
  async ({ page, url }) => {
    const widgetId = await seed({
      textHostname: 'example'
    })
    await page.goto(`${url}/admin/text/${widgetId}`)
    await expect(
      getInput(page, 'textHostname')
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      getInput(page, 'textHostname')
    ).toHaveAttribute('type', 'text')
  }
)

test(
  'textDomain: input type is text',
  async ({ page, url }) => {
    const widgetId = await seed({
      textDomain: 'example.com'
    })
    await page.goto(`${url}/admin/text/${widgetId}`)
    await expect(
      getInput(page, 'textDomain')
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      getInput(page, 'textDomain')
    ).toHaveAttribute('type', 'text')
  }
)

test(
  'textTel: input type is tel',
  async ({ page, url }) => {
    const widgetId = await seed({
      textTel: '555-1234'
    })
    await page.goto(`${url}/admin/text/${widgetId}`)
    await expect(
      getInput(page, 'textTel')
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      getInput(page, 'textTel')
    ).toHaveAttribute('type', 'tel')
  }
)

test(
  'textPassword: input type is password',
  async ({ page, url }) => {
    const widgetId = await seed({
      textPassword: 'secret'
    })
    await page.goto(`${url}/admin/text/${widgetId}`)
    await expect(
      getInput(page, 'textPassword')
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      getInput(page, 'textPassword')
    ).toHaveAttribute('type', 'password')
  }
)

test(
  'textCreditcard: input type is text',
  async ({ page, url }) => {
    const widgetId = await seed({
      textCreditcard: '4111111111111111'
    })
    await page.goto(`${url}/admin/text/${widgetId}`)
    await expect(
      getInput(page, 'textCreditcard')
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      getInput(page, 'textCreditcard')
    ).toHaveAttribute('type', 'text')
  }
)

test(
  'textRequired: error shown when saving without value',
  async ({ page, url }) => {
    const widgetId = await seed({
      textRequired: 'initial'
    })
    await page.goto(`${url}/admin/text/${widgetId}`)
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
  }
)

test(
  'textTrim: value is trimmed on save',
  async ({ page, url }) => {
    const widgetId = await seed({
      textTrim: ''
    })
    await page.goto(`${url}/admin/text/${widgetId}`)
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
