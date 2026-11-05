// Type checks of `defineAction()` in `defineController()`, which `tsc` runs.
import { z } from 'zod'
import { defineAction, defineController } from '../index.ts'
defineController({
  path: 'x',
  actions: {
    'post a': defineAction({
      body: z.object({ t: z.string() }),
      handler: ({ body, query, c }) => {
        const t: string = body.t
        const q: Record<string, string> = query
        const valid: string = c.req.valid('json').t
        return t + q.x + valid
      }
    }),
    'get b': defineAction({
      query: z.object({ n: z.number() }),
      handler: ({ query: { n }, c }) => n.toFixed() + c.req.valid('query').n
    })
  }
})
