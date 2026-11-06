# Kit

```js
import { createApp, runPlayground } from '@ditojs/kit'
```

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

| Member                         | Description                                                                                                                               |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `hono`                         | The Hono app, for the app's own middleware and routes.                                                                                    |
| `orm`                          | The `MikroORM` of the entities.                                                                                                           |
| `adapter`                      | See [`createMikroAdapter()`](mikro.md#createmikroadapter).                                                                                |
| `logger`                       | The logger of the current request, else the app's.                                                                                        |
| `storages`                     | The storages by name.                                                                                                                     |
| `assets`                       | See [`createAssets()`](storage.md#createassets).                                                                                          |
| `createUsers(entity, options)` | [Users](auth.md#createusers) of an entity on the app's database and secrets.                                                              |
| `routeApi(path, options)`      | Routes a [`createApi()`](api.md#createapi) on the app's database.                                                                         |
| `start({ services })`          | Starts the jobs, calls [`serve()`](hono.md#serve), and resolves to the Node server. A failed start stops what started and closes the ORM. |
| `close()`                      | Stops the server, the services and the jobs if they run, then closes the ORM.                                                             |

### Jobs

| Option     | Type                        | Description                                                                                           |
| ---------- | --------------------------- | ----------------------------------------------------------------------------------------------------- |
| `sessions` | `number \| string \| false` | How often to delete the expired sessions.                                                             |
| `assets`   | `number \| string \| false` | How often to run [`assets.runJobs()`](storage.md#asset-jobs). The logger gets the result of each run. |

The intervals are in milliseconds, or durations such as `'1h'`. `false` turns a
job off. `sessions` defaults to `'1h'` once `app.createUsers()` was called, and
`assets` doesn't run by default.

- The jobs start with `app.start()`, before the services, and stop after them.
- The first run comes one interval after the start.
- A job that still runs skips its next run, and `app.close()` waits for it.
- A job that fails logs its error, and runs again after the next interval.

## runPlayground()

```ts
runPlayground(
  app: App,
  options?: { services?: Service[], scope?: Record<string, unknown> }
): Promise<void>
```

Starts the `services`, and runs the standard input as the body of an async
function. Then it stops the services in reverse order and closes the app last,
also when the code or a start fails. The code has these variables:

- the entities by name;
- `orm`;
- `em`, an entity manager;
- the keys of `scope`.
