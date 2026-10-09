import { expect, type Page } from '@playwright/test'

// Confirmations are dialogs of the admin, not native ones, see `confirm()` in
// `packages/admin/src/utils/dialogs.js`: They are answered through their
// buttons, Cancel or the submit button that names the verb, e.g. 'Delete'.

export function getConfirmDialog(page: Page) {
  return page.getByRole('dialog')
}

async function answerConfirmDialog(
  page: Page,
  isConfirmed: boolean,
  message?: string
) {
  const dialog = getConfirmDialog(page)
  if (message) {
    await expect(dialog).toContainText(message)
  }
  await (

      isConfirmed
        ? dialog.locator('button[type="submit"]')
        : dialog.getByRole('button', { name: 'Cancel', exact: true })

  ).click()
  await expect(dialog).toHaveCount(0)
}

/** Confirms the open confirmation, after checking its `message` if given. */
export function acceptConfirmDialog(page: Page, message?: string) {
  return answerConfirmDialog(page, true, message)
}

/** Cancels the open confirmation, after checking its `message` if given. */
export function dismissConfirmDialog(page: Page, message?: string) {
  return answerConfirmDialog(page, false, message)
}

/**
 * Confirms all confirmations that show while `callback` runs, for steps that
 * only ask under some conditions, e.g. when leaving a form that is dirty.
 */
export async function acceptConfirmDialogsDuring<T>(
  page: Page,
  callback: () => Promise<T>
): Promise<T> {
  const dialog = getConfirmDialog(page)
  await page.addLocatorHandler(dialog, () =>
    dialog.locator('button[type="submit"]').click()
  )
  try {
    return await callback()
  } finally {
    await page.removeLocatorHandler(dialog)
  }
}
