import { text } from 'node:stream/consumers'
import type { App } from './createApp.ts'

// Runs the code of the standard input against the app's database, as the body
// of an async function, then closes the app. The code has the entities by
// name, the `orm` and an entity manager `em` in scope, and what `scope` adds,
// such as the app's services:
//
//   echo "console.log(await em.count(Book))" | node scripts/playground.js
export async function runPlayground(
  app: Pick<App, 'orm' | 'close'>,
  scope: Record<string, unknown> = {}
) {
  const { orm } = app
  const entities = [...orm.getMetadata().getAll().values()]
    .filter(({ pivotTable }) => !pivotTable)
    .map(({ className, class: entity }) => [className, entity])
  const names = {
    ...Object.fromEntries(entities),
    orm,
    em: orm.em.fork(),
    ...scope
  }
  const AsyncFunction = (async () => {}).constructor as FunctionConstructor
  const run = new AsyncFunction(
    ...Object.keys(names),
    await text(process.stdin)
  )
  try {
    await run(...Object.values(names))
  } finally {
    await app.close()
  }
}
