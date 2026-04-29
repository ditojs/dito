import { expect, type Locator, type Page } from '@playwright/test'

// Dito multiselect uses role=combobox + role=option in a portal. Option click
// targets `page` (portal root), combobox can be scoped to any container.
export async function fillDitoMultiselect(
  page: Page,
  scope: Locator | Page,
  label: string,
  search: string,
  option?: string
) {
  const combobox = scope.getByRole('combobox', { name: label })
  await combobox.click()
  // Multiselects with `searchable: true` expose a text input inside the
  // combobox — type to narrow the list. The dito default is
  // `searchable: false`: clicking already shows all options, no input
  // exists, so skip the type step.
  const input = combobox.locator('input')
  if (await input.count()) {
    await input.fill(search)
  }
  // Exact so e.g. "Cyrillic" doesn't also match "Latin & Cyrillic".
  await page
    .getByRole('option', { name: option ?? search, exact: true })
    .click()
}

export class DitoList {
  readonly table: Locator

  constructor(
    private readonly page: Page,
    private readonly label: string
  ) {
    this.table = page.getByRole('region', { name: label }).getByRole('table')
  }

  get rows() {
    return this.table.locator('tbody tr')
  }

  getRow(text: string) {
    // Match a body row that contains a cell whose accessible name is
    // exactly `text`. Avoids substring/header-row collisions that
    // `hasText` would cause (e.g. `getRow('A')` substring-matching the
    // header cell "Name").
    return this.rows.filter({
      has: this.page.getByRole('cell', { name: text, exact: true })
    })
  }

  async edit(text: string) {
    await this.getRow(text).getByRole('link', { name: 'Edit' }).click()
  }

  async editFirst() {
    await this.rows.first().getByRole('link', { name: 'Edit' }).click()
  }

  async editAt(index: number) {
    await this.rows.nth(index).getByRole('link', { name: 'Edit' }).click()
  }

  async delete(text: string) {
    const row = this.getRow(text)
    await row.hover()
    // Dito's SourceMixin.deleteItem calls window.confirm. Playwright
    // auto-dismisses dialogs by default, so register a one-shot accept
    // handler before triggering the delete.
    this.page.once('dialog', dialog => dialog.accept())
    const deleted = this.page
      .waitForResponse(
        resp =>
          resp.request().method() === 'DELETE' &&
          /\/api\//.test(resp.url()) &&
          resp.ok(),
        { timeout: 5_000 }
      )
      .catch(() => null)
    await row.getByRole('button', { name: 'Delete' }).click()
    await deleted
  }

  async create() {
    await this.page.getByRole('button', { name: 'Create', exact: true }).click()
  }

  async selectScope(name: string) {
    await this.page.getByRole('button', { name, exact: true }).click()
  }

  async getCell(rowText: string, columnName: string): Promise<Locator> {
    const headers = this.table.locator('thead tr th')
    const count = await headers.count()
    for (let i = 0; i < count; i++) {
      const text = await headers.nth(i).textContent()
      if (text?.trim() === columnName) {
        return this.getRow(rowText).locator('td').nth(i)
      }
    }
    throw new Error(`Column "${columnName}" not found in table "${this.label}"`)
  }
}

export class DitoForm {
  constructor(readonly page: Page) {}

  async fill(label: string, value: string) {
    await this.page.getByLabel(label, { exact: true }).fill(value)
  }

  async select(label: string, option: string) {
    await this.page.getByLabel(label, { exact: true }).selectOption(option)
  }

  async check(label: string) {
    await this.page.getByLabel(label, { exact: true }).check()
  }

  async toggleSwitch(label: string) {
    await this.page.getByLabel(label, { exact: true }).click()
  }

  async setSwitch(label: string, checked: boolean) {
    const input = this.page.getByLabel(label, { exact: true })
    if (checked) {
      await input.check()
    } else {
      await input.uncheck()
    }
  }

  async fillMultiselect(label: string, search: string, option?: string) {
    await fillDitoMultiselect(this.page, this.page, label, search, option)
  }

  async clearMultiselect(label: string) {
    // Clear button is hidden until the wrapper is hovered.
    const wrapper = this.page
      .locator('.dito-multiselect')
      .filter({ has: this.page.getByRole('combobox', { name: label }) })
    await wrapper.hover()
    await wrapper.getByRole('button', { name: 'Clear' }).click()
  }

  async fillDate(label: string, value: string) {
    await this.page.getByLabel(label, { exact: true }).fill(value)
    await this.page.keyboard.press('Escape')
  }

  async clickButton(name: string) {
    await this.page.getByRole('button', { name, exact: true }).click()
  }

  async save() {
    const button = this.page.getByRole('button', { name: 'Save', exact: true })
    const existingNotifications = await this.getNotificationCount()
    await this.submitButton(button)
    // The save response merges server data back into the form, which can
    // (a) overwrite in-progress user state and (b) transiently re-dirty the
    // form when nested lists come back with server-assigned ids. Re-check to
    // outlast the re-dirty tick. A save is settled when one of the following
    // holds:
    //  - the form unmounted (Dito's submit defaults to `closeForm: true`, so
    //    a successful save removes the Save button from the DOM);
    //  - the Save button is present but disabled (form clean, no auto-close);
    //  - a new dito-notification appeared (validation error).
    const assertSettled = () =>
      expect(async () => {
        const stillVisible = await button.isVisible().catch(() => false)
        const isClean = !stillVisible || (await button.isDisabled())
        const notificationCount = await this.getNotificationCount()
        expect(
          isClean || notificationCount > existingNotifications
        ).toBe(true)
      }).toPass({ timeout: 15_000 })
    await assertSettled()
    await assertSettled()
  }

  async create() {
    const button = this.page.getByRole('button', {
      name: 'Create',
      exact: true
    })
    await this.submitButton(button)
  }

  private async submitButton(button: Locator) {
    // Anchor on the PATCH/POST so callers' assertions run *after* the
    // server response.
    const pending = this.page
      .waitForResponse(
        response => {
          const method = response.request().method()
          return (
            (method === 'PATCH' || method === 'POST') &&
            /\/api\//.test(response.url())
          )
        },
        { timeout: 5_000 }
      )
      .catch(() => null)
    // Click with a forgiving timeout: if the form is currently clean (the
    // button is disabled because nothing's pending) the click would
    // otherwise hang waiting for it to enable. Async events can flip the
    // button between an isDisabled() guard and the click, so prefer
    // click-with-timeout.
    await button.click({ timeout: 5_000 }).catch(() => {})
    await pending
  }

  private getNotificationCount() {
    return this.getNotification().count()
  }

  getNotification(options: { error?: boolean; hasText?: string | RegExp } = {}) {
    const locator = this.page.locator(
      options.error ? '.dito-notification.error' : '.dito-notification'
    )
    return options.hasText ? locator.filter({ hasText: options.hasText }) : locator
  }

  async selectTab(name: string) {
    await this.page.getByRole('tab', { name }).click()
  }

  getField(label: string) {
    return this.page.getByLabel(label, { exact: true })
  }
}

export class DitoListView {
  readonly list: DitoList

  constructor(
    readonly page: Page,
    readonly url: string,
    listLabel: string
  ) {
    this.list = new DitoList(page, listLabel)
  }

  async navigate(path = '') {
    await this.page.goto(`${this.url}/admin${path}`)
  }
}

export class DitoNestedList {
  readonly container: Locator

  constructor(
    readonly page: Page,
    readonly label: string
  ) {
    this.container = page.getByRole('region', { name: label })
  }

  get table() {
    return this.container.locator(':scope > table')
  }

  get rows() {
    return this.table.locator(':scope > tbody > tr')
  }

  async add() {
    // Target the table's own Add button, not nested ones (like "Add Cut"
    // inside tree-list items).
    await this.table
      .getByRole('rowgroup')
      .last()
      .getByRole('button', { name: /Create|Add/ })
      .click()
  }

  async addType(typeName: string) {
    await this.add()
    await this.page.getByRole('menuitem', { name: typeName }).click()
  }

  async delete(index: number) {
    const row = this.rows.nth(index)
    const removeBtn = row.getByRole('button', { name: 'Remove' })
    await row.hover()
    await expect(removeBtn).toBeVisible()
    await removeBtn.click()
  }

  // Dito uses SortableJS with forceFallback under webdriver, so we drive
  // the fallback by mousedown on the drag handle, wait for the
  // .dito-draggable__fallback/__chosen class to appear, then move past
  // the target center to trigger the swap.
  async dragRow(fromIndex: number, toIndex: number) {
    const handle = (i: number) =>
      this.rows.nth(i).locator('.dito-button[title="Drag"]')
    const center = async (i: number) => {
      const box = await handle(i).boundingBox()
      if (!box)
        throw new Error(`Missing drag handle bounding box at index ${i}`)
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    }
    const from = await center(fromIndex)
    await this.page.mouse.move(from.x, from.y)
    await this.page.mouse.down()
    await this.page
      .locator('.dito-draggable__fallback, .dito-draggable__chosen')
      .first()
      .waitFor()
    // Re-fetch the target center after the drag started — SortableJS may
    // have shifted elements. Move past the center for a reliable swap.
    const to = await center(toIndex)
    const dy = to.y > from.y ? 10 : -10
    await this.page.mouse.move(to.x, to.y + dy, { steps: 20 })
    await this.page.mouse.up()
  }
}

export class DitoFilterPanel {
  private readonly region: Locator

  constructor(readonly page: Page) {
    this.region = page.getByRole('region', { name: 'Filters' })
  }

  async fillFilter(label: string, value: string) {
    // Filters use a `components: { ... }` wrapping schema, so the rendered
    // `<label for="…">` points at the outer wrapper div, not the input.
    // Match by role + accessible name (resolves through placeholder/title)
    // for a stable target.
    await this.region
      .getByRole('textbox', { name: label, exact: true })
      .fill(value)
    // Filter panel commits queries via the explicit Filter button — typing
    // alone doesn't refresh the list.
    await this.region.getByRole('button', { name: 'Filter', exact: true }).click()
  }
}

export class DitoDialog {
  readonly locator: Locator

  constructor(readonly page: Page) {
    this.locator = page.getByRole('dialog')
  }

  getField(label: string) {
    return this.locator.getByLabel(label, { exact: true })
  }

  getLink(name: string) {
    return this.locator.getByRole('link', { name, exact: true })
  }

  async close() {
    await this.locator.getByRole('button', { name: 'Close' }).click()
  }
}

export class DitoUploadField {
  readonly container: Locator

  constructor(
    readonly page: Page,
    readonly name: string
  ) {
    this.container = page.locator(`.dito-upload:has(input#${name})`)
  }

  get rows() {
    return this.container.locator('tbody tr')
  }

  get addButton() {
    return this.container.locator('tfoot .dito-button--upload')
  }

  getRow(index: number) {
    return this.rows.nth(index)
  }

  async waitUntilVisible(options?: { timeout?: number }) {
    await expect(this.container).toBeVisible(options)
  }

  async upload(filePath: string | string[]): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      resp => resp.url().includes('/upload/') && resp.ok()
    )
    const fileInput = this.container.locator('input[type="file"]').first()
    await fileInput.setInputFiles(filePath)
    await responsePromise
  }
}
