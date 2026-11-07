# Kit

```js
import { createApp, runPlayground } from '@ditojs/kit'
```

The kit needs `@ditojs/admin`, and loads only its server entry, which holds no
Vue code.

See [The kit](../../guide/server/kit.md) in the guide.

## createApp()

```ts
createApp(options: CreateAppOptions): App
```

Sets up an app. Only `entities` and `database` are required.

| Option     | Type                                | Description                                                                                                                                                       |
| ---------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entities` | `object`                            | A list or a module of entities.                                                                                                                                   |
| `database` | MikroORM's `Options`                | Goes through [`defineMikroConfig()`](mikro.md#definemikroconfig).                                                                                                 |
| `server`   | `{ port, host, closeTimeout, … }`   | The options of [`serve()`](hono.md#serve) and of [`createHono()`](hono.md#createhono).                                                                            |
| `logger`   | pino's `LoggerOptions`              | Logs have no `pid` and `hostname` unless `base` sets them.                                                                                                        |
| `secrets`  | `string[]`                          | Sign the cookies of the sessions and the password reset links. The first one signs, and all of them verify.                                                       |
| `storages` | `Record<string, StorageDefinition>` | See [`createStorages()`](storage.md#createstorages). A disk storage is served at the path of its `url`. A `url` without a path, such as a host of its own, isn't. |
| `assets`   | `{ deleteUnusedAfter, maxSize }`    | See [`createAssets()`](storage.md#createassets).                                                                                                                  |
| `jobs`     | `JobsOptions`                       | The jobs that run while the app runs, see [Jobs](#jobs).                                                                                                          |

### App

| Member                         | Description                                                                                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hono`                         | The Hono app, for the app's own middleware and routes.                                                                                                     |
| `orm`                          | The `MikroORM` of the entities.                                                                                                                            |
| `adapter`                      | See [`createMikroAdapter()`](mikro.md#createmikroadapter).                                                                                                 |
| `logger`                       | The logger of the current request, else the app's.                                                                                                         |
| `storages`                     | The storages by name.                                                                                                                                      |
| `assets`                       | See [`createAssets()`](storage.md#createassets).                                                                                                           |
| `services`                     | The services by name, such as `app.services.mailer`.                                                                                                       |
| `isRunning`                    | True from after the services start until a shutdown has ended all requests, so that work that outlives them can fail with a clear message.                 |
| `createUsers(entity, options)` | [Users](auth.md#createusers) of an entity on the app's database and secrets.                                                                               |
| `routeApi(path, options)`      | Routes a [`createApi()`](api.md#createapi) on the app's database.                                                                                          |
| `routeAdmin(path, options)`    | Routes [`createAdmin()`](../admin/server.md#createadmin) at `path`, which is its `base`. `close()` stops Vite, also without a start.                       |
| `addService(name, service)`    | Adds a [service](hono.md#serve). Services start in this order and stop in reverse order. A name works once.                                                |
| `startServices()`              | Starts the services alone, for scripts, until `close()`. A failed start stops them and closes the ORM.                                                     |
| `start()`                      | Starts the services and the jobs, calls [`serve()`](hono.md#serve), and resolves to the Node server. A failed start stops what started and closes the ORM. |
| `close()`                      | Stops the server, the jobs and the services if they run, then closes the ORM. An app starts once.                                                          |

### Jobs

The `jobs` option configures the built-in jobs. With `false`, no jobs run at
all, also not those of `app.addJob()`, such as in tests.

| Option     | Type                                  | Description                                                                                                                                                |
| ---------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sessions` | `number \| string \| object \| false` | Deletes the expired sessions. The default is `'1h'` once `app.createUsers()` was called. Without users, it doesn't run.                                    |
| `assets`   | `number \| string \| object \| false` | Runs [`assets.runJobs()`](storage.md#asset-jobs). Off by default. The logger gets a summary of each run and the error of each file that failed to release. |

Each takes a duration, or the form of `app.addJob()` without `run`. `false` turns
it off.

### addJob()

```ts
app.addJob(name: string, definition: JobDefinition): void
```

```js
app.addJob('reminders', { every: '1h', immediate: true, run: sendReminders })
app.addJob('report', { at: '03:00', run: sendReport })
```

| Key         | Type               | Description                                                                           |
| ----------- | ------------------ | ------------------------------------------------------------------------------------- |
| `every`     | `number \| string` | The interval, in milliseconds or as a duration such as `'1h'`.                        |
| `immediate` | `boolean`          | With `every`: run at the start too. Otherwise the first run comes one interval later. |
| `at`        | `string`           | The time of each day, in local time, such as `'03:00'`. Instead of `every`.           |
| `run`       | `function`         | The work of the job, sync or async.                                                   |

- Jobs start after the services, and stop before them.
- A job that still runs skips its next run, and `app.close()` waits for it.
- A job that fails logs its error, and runs again at the next time.
- A name works once, and an invalid `every` or `at` throws.

## runPlayground()

```ts
runPlayground(
  app: App,
  options?: { scope?: Record<string, unknown> }
): Promise<void>
```

Starts the app's services, without its jobs and its server, and runs the
standard input as the body of an async function. Then it closes the app, also
when the code or a start fails. The code has these variables:

- the entities by name;
- `orm`;
- `em`, an entity manager;
- `services`, the services by name;
- the keys of `scope`.
