import { z } from 'zod'
import { defineAction } from '@ditojs/server'
import { assignRecord } from '@ditojs/mikro'
import { defineScenario } from '../../utils/fixture-app.js'
import { Page } from './models/Page.js'

export { expect } from '@playwright/test'
export { db } from '../../utils/fixture-app.js'

export const test = defineScenario({
  dirname: import.meta.dirname,
  entities: [Page],
  controllers: {
    Page: {
      actions: {
        // Stores the order of the pages that the order button sends.
        'post order': defineAction({
          body: z.array(
            z.looseObject({ id: z.number(), order: z.number().nullable() })
          ),
          handler: async ({ body, em }) => {
            const pages = []
            for (const { id, order } of body) {
              const page = await em.findOneOrFail(Page, id)
              pages.push(await assignRecord(em, page, { order }))
            }
            return pages
          }
        }),
        // The child pages of a page, which their list loads through a
        // resource of its own.
        'get :id/child-pages': ({ params: { id }, list }) =>
          list({
            where: { parentPage: Number(id) },
            orderBy: { order: 'asc' }
          })
      }
    }
  }
})
