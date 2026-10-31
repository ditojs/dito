// Type checks of `action()` inside `defineController()`, which `tsc` runs.
import { z } from 'zod'
import { action, defineController } from '../src/index.ts'
defineController({
  path: 'x',
  collection: {
    'post a': action({
      body: z.object({ t: z.string() }),
      handler: ctx => {
        const t: string = ctx.body.t
        const q: Record<string, string> = ctx.query
        return t + q.x
      }
    }),
    'get b': action({
      query: z.object({ n: z.number() }),
      handler: ctx => ctx.query.n.toFixed()
    })
  }
})
