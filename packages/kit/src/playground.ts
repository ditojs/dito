import { text } from 'node:stream/consumers'
import type { App } from './createApp.ts'

interface PlaygroundOptions {
  // Added to the names that the code has in scope.
  scope?: Record<string, unknown>
}

// Starts the app's services, without its jobs and server, runs the code of the
// standard input as the body of an async function, then closes the app. The
// code has the entities by name, the `orm`, an entity manager `em` and the
// `services` in scope, and what `scope` adds:
//
//   echo "console.log(await em.count(Book))" | node scripts/playground.js
export async function runPlayground(
  app: Pick<App, 'orm' | 'services' | 'startServices' | 'close'>,
  { scope = {} }: PlaygroundOptions = {}
) {
  const { orm, services } = app
  const entities = [...orm.getMetadata().getAll().values()]
    .filter(({ pivotTable }) => !pivotTable)
    .map(({ className, class: entity }) => [className, entity])
  const names = {
    ...Object.fromEntries(entities),
    orm,
    em: orm.em.fork(),
    services,
    ...scope
  }
  const AsyncFunction = (async () => {}).constructor as FunctionConstructor
  await app.startServices()
  try {
    const run = new AsyncFunction(
      ...Object.keys(names),
      await text(process.stdin)
    )
    await run(...Object.values(names))
  } finally {
    await app.close()
  }
}
