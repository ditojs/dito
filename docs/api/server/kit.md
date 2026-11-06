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

| Option     | Type                                | Description                                                                                             |
| ---------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `entities` | `object`                            | A list or a module of entities.                                                                         |
| `database` | MikroORM's `Options`                | Goes through [`defineMikroConfig()`](mikro.md#definemikroconfig).                                       |
| `server`   | `{ port, host, closeTimeout }`      | The options of [`serve()`](hono.md#serve).                                                              |
| `http`     | `CreateHonoOptions`                 | The options of [`createHono()`](hono.md#createhono).                                                    |
| `logger`   | pino's `LoggerOptions`              | Logs have no `pid` and `hostname` unless `base` sets them.                                              |
| `secrets`  | `string[]`                          | Sign the cookies of the sessions. The first one signs, and all of them verify.                          |
| `storages` | `Record<string, StorageDefinition>` | See [`createStorages()`](storage.md#createstorages). A disk storage with a `url` is served at its path. |
| `assets`   | `{ deleteUnusedAfter }`             | See [`createAssets()`](storage.md#createassets).                                                        |

### App

| Member                    | Description                                                           |
| ------------------------- | --------------------------------------------------------------------- |
| `hono`                    | The Hono app, for the app's own middleware and routes.                |
| `orm`                     | The `MikroORM` of the entities.                                       |
| `adapter`                 | See [`createMikroAdapter()`](mikro.md#createmikroadapter).            |
| `logger`                  | The logger of the current request, else the app's.                    |
| `storages`                | The storages by name.                                                 |
| `assets`                  | See [`createAssets()`](storage.md#createassets).                      |
| `createSessions(options)` | [Sessions](auth.md#createsessions) on the app's database and secrets. |
| `routeApi(path, options)` | Routes a [`createApi()`](api.md#createapi) on the app's database.     |
| `start({ services })`     | Calls [`serve()`](hono.md#serve), and resolves to the Node server.    |
| `close()`                 | Stops the server and the services if they run, then closes the ORM.   |

## runPlayground()

```ts
runPlayground(app: App, scope?: Record<string, unknown>): Promise<void>
```

Runs the standard input as the body of an async function, then closes the app.
The code has these variables:

- the entities by name;
- `orm`;
- `em`, an entity manager;
- the keys of `scope`.
