import {
  test, expect, createModelHelpers
} from '../fixtures.js'
import { TextareaWidget } from '../models/TextareaWidget.js'

const { seed, saveAndFetch } = createModelHelpers(
  TextareaWidget, 'textarea-widgets'
)

test(
  'markupMarksSubset: apply bold and italic',
  async ({ page, url }) => {
    const widgetId = await seed({
      markupMarksSubset: '<p>marks subset</p>'
    })

    await page.goto(
      `${url}/admin/textarea/${widgetId}`
    )
    const markup = page.locator(
      '.dito-markup#markupMarksSubset'
    )
    await expect(markup).toBeVisible(
      { timeout: 15_000 }
    )
    const editor = markup.locator('.ProseMirror')
    await editor.click()
    await page.keyboard.press('Meta+a')
    await page.keyboard.press('Meta+b')
    await page.keyboard.press('Meta+i')
    await expect(
      editor.locator('strong')
    ).toBeVisible()
    await expect(
      editor.locator('em')
    ).toBeVisible()

    // --- Save and verify ---

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(
      widget.markupMarksSubset
    ).toContain('<strong>')
    expect(
      widget.markupMarksSubset
    ).toContain('<em>')
  }
)

test(
  'markupNodesSubset: apply heading and bullet list',
  async ({ page, url }) => {
    const widgetId = await seed({
      markupNodesSubset: '<p>nodes subset</p>'
    })

    await page.goto(
      `${url}/admin/textarea/${widgetId}`
    )
    const markup = page.locator(
      '.dito-markup#markupNodesSubset'
    )
    await expect(markup).toBeVisible(
      { timeout: 15_000 }
    )
    const editor = markup.locator('.ProseMirror')

    await editor.click()
    await page.keyboard.press('Meta+a')
    const h1Btn = markup.locator(
      'button:has(.dito-icon--heading-1)'
    )
    await h1Btn.click()
    await expect(
      editor.locator('h1')
    ).toBeVisible()

    await editor.click()
    await page.keyboard.press('Meta+a')
    const listBtn = markup.locator(
      'button:has(.dito-icon--bullet-list)'
    )
    await listBtn.click()
    await expect(
      editor.locator('ul')
    ).toBeVisible()

    // --- Save and verify ---

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(
      widget.markupNodesSubset
    ).toContain('<ul>')
  }
)

test(
  'markupNodesAll: apply ordered list then blockquote',
  async ({ page, url }) => {
    const widgetId = await seed({
      markupNodesAll: '<p>nodes all</p>'
    })

    await page.goto(
      `${url}/admin/textarea/${widgetId}`
    )
    const markup = page.locator(
      '.dito-markup#markupNodesAll'
    )
    await expect(markup).toBeVisible(
      { timeout: 15_000 }
    )
    const editor = markup.locator('.ProseMirror')
    const olBtn = markup.locator(
      'button:has(.dito-icon--ordered-list)'
    )
    const bqBtn = markup.locator(
      'button:has(.dito-icon--blockquote)'
    )

    await editor.click()
    await page.keyboard.press('Meta+a')
    await olBtn.click()
    await expect(
      editor.locator('ol')
    ).toBeVisible()

    // Toggle ol off, then apply blockquote
    await page.keyboard.press('Meta+a')
    await olBtn.click()
    await page.keyboard.press('Meta+a')
    await bqBtn.click()
    await expect(
      editor.locator('blockquote')
    ).toBeVisible()

    // --- Save and verify ---

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(
      widget.markupNodesAll
    ).toContain('<blockquote>')
  }
)

test(
  'markupToolsHistory: undo button reverts change',
  async ({ page, url }) => {
    const widgetId = await seed({
      markupToolsHistory: '<p>tools history</p>'
    })

    await page.goto(
      `${url}/admin/textarea/${widgetId}`
    )
    const markup = page.locator(
      '.dito-markup#markupToolsHistory'
    )
    await expect(markup).toBeVisible(
      { timeout: 15_000 }
    )
    const editor = markup.locator('.ProseMirror')
    await editor.click()
    await page.keyboard.press('Meta+a')
    await page.keyboard.type('replaced')
    await expect(editor).toContainText('replaced')

    const undoBtn = markup.locator(
      'button:has(.dito-icon--undo)'
    )
    await undoBtn.click()
    await expect(editor).toContainText(
      'tools history'
    )

    // --- Save and verify ---

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(
      widget.markupToolsHistory
    ).toContain('tools history')
    expect(
      widget.markupToolsHistory
    ).not.toContain('replaced')
  }
)

test(
  'markupHardBreak: Enter inserts hard break',
  async ({ page, url }) => {
    const widgetId = await seed({
      markupHardBreak: '<p>hard break content</p>'
    })

    await page.goto(
      `${url}/admin/textarea/${widgetId}`
    )
    const markup = page.locator(
      '.dito-markup#markupHardBreak'
    )
    await expect(markup).toBeVisible(
      { timeout: 15_000 }
    )
    const editor = markup.locator('.ProseMirror')
    await editor.click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('new line')
    await expect(
      editor.locator('br')
    ).toHaveCount(1)

    // --- Save and verify ---

    const widget = await saveAndFetch(
      page, widgetId
    )
    expect(
      widget.markupHardBreak
    ).toContain('<br')
    expect(
      widget.markupHardBreak
    ).toContain('new line')
  }
)
