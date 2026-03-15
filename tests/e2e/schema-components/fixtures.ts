import path from 'path'
import type { Page } from '@playwright/test'
import {
  test as base,
  expect
} from '@playwright/test'
import {
  AdminController,
  ModelController,
  Model
} from '@ditojs/server'
import {
  createTestApp,
  getAppUrl,
  stubSession
} from '../../utils/app.js'
import {
  createTestDatabase
} from '../../utils/database.js'
import { waitForUrl } from '../../utils/net.js'
import { TextWidget } from './models/TextWidget.js'
import { NumberWidget } from './models/NumberWidget.js'
import { SliderWidget } from './models/SliderWidget.js'
import {
  TextareaWidget
} from './models/TextareaWidget.js'
import {
  BooleanWidget
} from './models/BooleanWidget.js'
import { SelectWidget } from './models/SelectWidget.js'
import { DateWidget } from './models/DateWidget.js'
import { SourceWidget } from './models/SourceWidget.js'
import { LayoutWidget } from './models/LayoutWidget.js'
import { DataWidget } from './models/DataWidget.js'

export { expect }
export {
  getInput,
  getContainer
} from '../../utils/admin.js'

function createController(
  modelClass: typeof Model,
  name: string
) {
  const controller = {
    [name]: class extends ModelController {
      override modelClass = modelClass
      collection = {
        allow: ['get', 'post'] as const
      }
      member = {
        allow: ['get', 'patch', 'delete'] as const
      }
    }
  }
  return controller[name]
}

// Worker-scoped fixture: one app per worker,
// shared across all spec files in that worker.
export const test = base.extend<
  { url: string },
  { workerUrl: string }
>({
  workerUrl: [async ({}, use) => {
    const app = createTestApp({
      models: {
        TextWidget,
        NumberWidget,
        SliderWidget,
        TextareaWidget,
        BooleanWidget,
        SelectWidget,
        DateWidget,
        SourceWidget,
        LayoutWidget,
        DataWidget
      },
      admin: {
        root: path.resolve(
          import.meta.dirname, 'app'
        ),
        api: { url: '/api/' }
      },
      controllers: {
        admin: AdminController,
        api: {
          TextWidgets: createController(
            TextWidget, 'TextWidgets'
          ),
          NumberWidgets: createController(
            NumberWidget, 'NumberWidgets'
          ),
          SliderWidgets: createController(
            SliderWidget, 'SliderWidgets'
          ),
          TextareaWidgets: createController(
            TextareaWidget, 'TextareaWidgets'
          ),
          BooleanWidgets: createController(
            BooleanWidget, 'BooleanWidgets'
          ),
          SelectWidgets: createController(
            SelectWidget, 'SelectWidgets'
          ),
          DateWidgets: createController(
            DateWidget, 'DateWidgets'
          ),
          SourceWidgets: createController(
            SourceWidget, 'SourceWidgets'
          ),
          LayoutWidgets: createController(
            LayoutWidget, 'LayoutWidgets'
          ),
          DataWidgets: createController(
            DataWidget, 'DataWidgets'
          )
        }
      }
    })
    stubSession(app)
    await createTestDatabase(app)
    await app.start()
    const url = getAppUrl(app)
    await waitForUrl(`${url}/admin/`)
    await use(url)
    await app.stop()
    await app.knex?.destroy()
  }, { scope: 'worker' }],

  url: async ({ workerUrl }, use) => {
    await use(workerUrl)
  }
})

export function createModelHelpers<
  M extends typeof Model
>(
  ModelClass: M,
  resource: string,
  defaults: Record<string, unknown> = {}
) {
  async function seed(
    data: Record<string, unknown> = {}
  ) {
    const instance = await ModelClass.query()
      .insert({ ...defaults, ...data })
    return instance.$id() as number
  }

  async function saveAndFetch(
    page: Page,
    id: number
  ): Promise<InstanceType<M>> {
    const saved = page.waitForResponse(resp =>
      resp.url().includes(
        `/api/${resource}/${id}`
      ) &&
      resp.request().method() === 'PATCH' &&
      resp.ok()
    )
    await page.locator(
      'button.dito-button[type="submit"]'
    ).first().click()
    await saved
    const instance = await ModelClass.query()
      .findById(id)
    if (!instance) {
      throw new Error(
        `${ModelClass.name} ${id} not found`
      )
    }
    return instance as InstanceType<M>
  }

  return { seed, saveAndFetch }
}

export function getMultiselect(
  page: Page,
  label: string
) {
  return page.locator('.dito-container').filter({
    has: page.locator('.dito-label', {
      hasText: label
    })
  }).locator('.multiselect')
}

test.describe.configure({ mode: 'serial' })
