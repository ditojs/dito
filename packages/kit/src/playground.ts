import { text } from 'node:stream/consumers'
import { startServices } from '@ditojs/server/node'
import type { Service } from '@ditojs/server'
import type { App } from './createApp.ts'

interface PlaygroundOptions {
  // Start before the code runs, and stop in reverse order after it.
  services?: Service[]
  // Added to the names that the code has in scope.
  scope?: Record<string, unknown>
}

// Runs the code of the standard input against the app's database, as the body
// of an async function, then closes the app. The code has the entities by
// name, the `orm` and an entity manager `em` in scope, and what `scope` adds:
//
//   echo "console.log(await em.count(Book))" | node scripts/playground.js
export async function runPlayground(
  app: Pick<App, 'orm' | 'close'>,
  { services = [], scope = {} }: PlaygroundOptions = {}
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
  // The app closes last, as services stop in reverse order.
  const stopServices = await startServices([
    { stop: () => app.close() },
    ...services
  ])
  try {
    const run = new AsyncFunction(
      ...Object.keys(names),
      await text(process.stdin)
    )
    await run(...Object.values(names))
  } finally {
    await stopServices()
  }
}
