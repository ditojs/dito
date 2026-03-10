/// <reference types="node" />

// Type definitions for Dito.js server
// Project: <https://github.com/ditojs/dito/>

// Export the entire Dito.js namespace.

import { ObjectCannedACL, S3ClientConfig } from '@aws-sdk/client-s3'
import { DateFormat } from '@ditojs/utils'
import { Options as KoaCorsOptions } from '@koa/cors'
import * as Ajv from 'ajv/dist/2020.js'
import { AsyncLocalStorage } from 'async_hooks'
import * as dbErrors from 'db-errors'
import * as EventEmitter2 from 'eventemitter2'
import helmet from 'helmet'
import { Knex } from 'knex'
import * as Koa from 'koa'
import { Options as KoaBodyParserOptions } from 'koa-bodyparser'
import { CompressOptions } from 'koa-compress'
import koaMount from 'koa-mount'
import koaResponseTime from 'koa-response-time'
import koaSession from 'koa-session'
import multer from '@koa/multer'
import multerS3 from 'multer-s3'
import * as objection from 'objection'
import { KnexSnakeCaseMappersFactory } from 'objection'
import { Logger as PinoLogger, LoggerOptions as PinoLoggerOptions } from 'pino'
import { PrettyOptions } from 'pino-pretty'
import {
  Class,
  ConditionalKeys,
  Constructor,
  SetOptional,
  SetReturnType
} from 'type-fest'
import { UserConfig } from 'vite'

export type Page<$Model extends Model = Model> = {
  total: number
  results: $Model[]
}

/** Result of compiling action parameter definitions. */
export type CompiledParametersValidator = {
  list: Array<{ name: string | null } & Schema>
  schema: Schema | null
  asObject: boolean
  dataName: string
  validate: ((data: unknown) => boolean | PromiseLike<boolean>) | null
  hasModelRefs: boolean
}

export type ApplicationConfig = {
  /** @defaultValue `production` */
  env?: 'production' | 'development'
  /** The server configuration */
  server?: {
    /** The ip address or hostname used to serve requests */
    host?: string
    /** The port to listen on for connections */
    port?: string
  }
  /** Logging options */
  log?: {
    /**
     * Enable logging requests to console by passing `true` or pick between
     * 'console' for logging to console and 'file' for logging to file
     *
     * @defaultValue `false`
     */
    requests?: boolean | 'console' | 'file'
    /**
     * Whether to output route (Controller) logs
     *
     * @defaultValue `false`
     */
    routes?: boolean
    /**
     * Whether to log relation mappings
     *
     * @defaultValue `false`
     */
    relations?: boolean
    /**
     * Whether to log the json schema generated out of the model property
     * definitions
     *
     * @defaultValue `false`
     */
    schema?: boolean
    /**
     * Whether to log sql queries
     *
     * @defaultValue `false`
     */
    sql?: boolean
    /** Whether to turn off all logging */
    silent?: boolean
    errors?:
      | boolean
      | {
          /** Whether to log sql errors */
          sql?: boolean
          /** Whether to log the error stack */
          stack?: boolean
          json?: boolean
        }
  }
  api?: ApiConfig
  app?: {
    /**
     * Whether to normalize paths from camel case to kebab case.
     *
     * @defaultValue `false`
     * @see {@link https://github.com/ditojs/dito/blob/master/docs/controllers.md#path-normalization|Path Normalization}
     */
    normalizePaths?: boolean
    /**
     * Whether proxy header fields will be trusted.
     *
     * @defaultValue `false`
     */
    proxy?: Koa['proxy']
    /**
     * Whether to include X-Response-Time header in responses
     *
     * @defaultValue `true`
     */
    responseTime?: boolean | Parameters<typeof koaResponseTime>[0]
    /**
     * Whether to use koa-helmet middleware which provides important security
     * headers to make your app more secure by default.
     *
     * @defaultValue `true`
     * @see https://github.com/venables/koa-helmet
     * @see https://github.com/helmetjs/helmet
     */
    helmet?: boolean | Parameters<typeof helmet>[0]
    logger?: {
      prettyPrint?: PrettyOptions
    } & PinoLoggerOptions
    /**
     * Configure body parser.
     *
     * @see https://github.com/koajs/bodyparser#options
     */
    bodyParser?: KoaBodyParserOptions
    /**
     * Enable or configure Cross-Origin Resource Sharing (CORS)
     *
     * @defaultValue `true`
     * @see https://github.com/koajs/cors#corsoptions
     */
    cors?: boolean | KoaCorsOptions
    /**
     * Enable or configure server response compression
     *
     * @defaultValue `true`
     * @see https://github.com/koajs/compress#options
     */
    compress?: boolean | CompressOptions
    /**
     * Enable ETag headers in server responses
     *
     * @defaultValue `true`
     */
    etag?: boolean
    /**
     * @defaultValue `false`
     * @see https://github.com/koajs/session
     */
    session?: boolean | (koaSession.opts & { modelClass: string })
    /**
     * Enable passport authentication middleware
     *
     * @defaultValue `false`
     */
    passport?: boolean
    /**
     * Set signed cookie keys.
     *
     * @see https://github.com/koajs/koa/blob/master/docs/api/index.md#appkeys
     */
    keys?: Koa['keys']
  }
  admin?: AdminConfig
  knex?: Knex.Config<any> & {
    /** @defaultValue `false` */
    normalizeDbNames?: boolean | Parameters<KnexSnakeCaseMappersFactory>
    // See https://github.com/brianc/node-pg-types/blob/master/index.d.ts#L67
    typeParsers?: Record<number, <I extends string | Buffer>(value: I) => any>
  }
  /**
   * Service configurations keyed by service name. Pass
   * `false` as a value to disable a service.
   */
  services?: Record<string, Record<string, unknown> | false>
  storages?: StorageConfigs
  /** Logger configuration at the application level. */
  logger?: {
    prettyPrint?: PrettyOptions
  } & PinoLoggerOptions
  assets?: {
    /**
     * Threshold after which unused assets that haven't
     * seen changes for given timeframe are removed.
     *
     * @example '1 hr 20 mins'
     * @defaultValue `'24h'`
     * @see https://www.npmjs.com/package/parse-duration
     */
    cleanupTimeThreshold?: string | number
    /**
     * Threshold after which dangling assets (uploaded
     * but never persisted) are removed. Cannot be set to
     * 0 as the file would be deleted immediately after
     * upload.
     *
     * @defaultValue `'24h'`
     * @see https://www.npmjs.com/package/parse-duration
     */
    danglingTimeThreshold?: string | number
  }
}

export type MulterS3File = {
  bucket: string
  key: string
  acl: string
  contentType: string
  contentDisposition: null
  storageClass: string
  serverSideEncryption: null
  metadata: Record<string, string>
  location: string
  etag: string
}

export type StorageConfigs = { [key: string]: StorageConfig }

type CommonStorageConfig = {
  /**
   * The concurrency at which assets are added to storage.
   *
   * @default `8`
   */
  concurrency?: number
  /**
   * The base URL at which assets are accessible.
   */
  url?: string
  allowedImports?: string[]
}

export type S3StorageConfig = CommonStorageConfig & {
  type: 's3'
  bucket: string
  acl?: ObjectCannedACL | string
  s3: S3ClientConfig
} & Omit<
    Parameters<typeof multerS3>[0],
    's3' | 'key' | 'contentType' | 'metadata'
  >

export type DiskStorageConfig = CommonStorageConfig & {
  type: 'disk'
  /**
   * The path to the directory where assets are stored on.
   */
  path: string
}

export type StorageConfig = S3StorageConfig | DiskStorageConfig

export interface AdminConfig {
  api?: ApiConfig
  /** Path to the admin's src directory. Mandatory when in development mode. */
  root?: string
  /**
   * Path to the dist/src/admin directory. Mandatory when in production mode.
   */
  dist?: string
  /** @default Application  */
  mode?: 'production' | 'development'
  /** Settings accessible on the browser side as `global.dito.settings`. */
  settings?: Record<string, any>
}

export interface ApiResource {
  type: string
  path?: string
  parent?: ApiResource
}

export interface ApiConfig {
  /** The base url to use for api requests. */
  url?: string
  /** @defaultValue 'en-US'  */
  locale?: string
  dateFormat?: DateFormat
  /**
   * Whether to display admin notifications.
   *
   * @default `true`
   */
  notifications?:
    | boolean
    | {
        /**
         * The amount of milliseconds multiplied with the amount of characters
         * displayed in the notification, plus 40 (40 + title + message).
         *
         * @defaultValue `20`
         */
        durationFactor: number
      }
  cors?: {
    /**
     * Whether cross-site `Access-Control` requests are made using credentials.
     */
    credentials: boolean
  }
  /**
   * Setting normalizePaths to `true` sets `api.normalizePath` to hyphenate
   * camelized strings and `api.denormalizePath` to do the opposite. If you
   * prefer to use another path normalization algorithm, they can be defined the
   * api settings passed to the DitoAdmin constructor.
   *
   * @defaultValue Application.config.app.normalizePaths
   */
  normalizePaths?: boolean
  /** Auth resources */
  users?: {
    path?: string
    login?: {
      /** @defaultValue `'login'` */
      path?: string
      /** @defaultValue `'post'` */
      method?: HTTPMethod
    }
    logout?: {
      /** @defaultValue `'logout'` */
      path?: string
      /** @defaultValue `'post'` */
      method?: HTTPMethod
    }
    session?: {
      /** @defaultValue `'session'` */
      path?: string
      /** @defaultValue `'get'` */
      method?: HTTPMethod
    }
  }
  /** Optionally override resource path handlers. */
  resources?: Record<string, (resource: ApiResource | string) => string>

  /**
   * Optionally override / extend headers sent with API
   * requests.
   */
  headers?: Record<string, string>
}

export interface ApplicationControllers {
  [k: string]:
    | Class<ModelController>
    | Class<Controller>
    | ApplicationControllers
}

export type Models = Record<string, Class<Model>>

interface AsyncRequestLocals {
  transaction: objection.Transaction
  logger: PinoLogger
}

export class Application<$Models extends Models = Models> {
  constructor(options: {
    basePath?: string
    config?: ApplicationConfig
    validator?: Validator
    router?: {
      add(
        method: string,
        path: string,
        handler: Function
      ): this
      find(
        method: string,
        path: string
      ): {
        status: number
        handler?: Function
        params?: Record<string, string>
        allowed: string[]
      }
      getAllowedMethods(
        path?: string | null,
        exclude?: string | null
      ): string[]
      normalizePath(path: string): string
    }
    /**
     * Subscribe to application events. Event names: `'before:start'`,
     * `'after:start'`, `'before:stop'`, `'after:stop'`, `'error'`
     */
    events?: Record<
      string,
      (this: Application<$Models>, ...args: any[]) => void
    >
    models?: $Models
    controllers?: ApplicationControllers
    /** Service classes or instances to register. */
    services?: Services
    middleware?: Koa.Middleware
  })

  /** The base path for resolving relative paths. */
  basePath: string
  /** The merged application configuration. */
  config: ApplicationConfig
  /** The Knex instance for database access. */
  knex: Knex
  /** The HTTP server instance, or `null` if not started. */
  server: import('http').Server | null
  /** Whether the application is currently running. */
  isRunning: boolean
  /** The schema validator instance. */
  validator: Validator
  /** Registered storage instances by name. */
  storages: Record<string, Storage>
  /** Registered service instances by name. */
  services: Record<string, Service>
  /** Registered controller instances by name. */
  controllers: Record<string, Controller>
  models: $Models

  setup(): Promise<void>
  /** Calls `start()` and exits the process on failure. */
  execute(): Promise<void>
  start(): Promise<void>
  stop(timeout?: number): Promise<void>

  /** Configures the pino logger instance. */
  setupLogger(): void
  /** Configures the Knex database connection. */
  setupKnex(): void
  /**
   * Configures all Koa middleware (logger, error
   * handling, CORS, compression, session, passport,
   * etc.).
   */
  setupMiddleware(middleware?: Koa.Middleware): void

  addStorage(
    config: StorageConfig | Storage,
    name?: string
  ): Storage

  addStorages(storages: StorageConfigs): void
  setupStorages(): Promise<void>
  /** Returns a storage by name, or `null` if not found. */
  getStorage(name: string): Storage | null

  addService(
    service: Service | Class<Service>,
    name?: string
  ): void

  addServices(services: Services): void
  setupServices(): Promise<void>
  /** Returns a service by name. */
  getService(name: string): Service | null
  /** Finds a service matching the given predicate. */
  findService(
    callback: (service: Service) => boolean
  ): Service | null

  addModel(model: Class<Model>): void
  addModels(models: Models): void
  setupModels(): Promise<void>
  /**
   * Returns a model class by name. Also looks up
   * `${name}Model` if the name doesn't already end in
   * 'Model'.
   */
  getModel(name: string): Class<Model> | null
  /** Finds a model class matching the given predicate. */
  findModel(
    callback: (model: Class<Model>) => boolean
  ): Class<Model> | null

  addController(
    controller: Controller | Class<Controller>,
    namespace?: string
  ): void

  addControllers(
    controllers: ApplicationControllers,
    namespace?: string
  ): void

  setupControllers(): Promise<void>
  /** Returns a controller by its URL. */
  getController(url: string): Controller | null
  /**
   * Finds a controller matching the given predicate.
   */
  findController(
    callback: (controller: Controller) => boolean
  ): Controller | null

  /** Returns the admin controller, if registered. */
  getAdminController(): AdminController | null

  /** Compiles a JSON schema into a validation function. */
  compileValidator(
    jsonSchema: Schema,
    options?: Record<string, any>
  ): Ajv.ValidateFunction | null

  /**
   * Compiles action parameter definitions into a
   * validation function and metadata.
   */
  compileParametersValidator(
    parameters:
      | Record<string, Schema>
      | Array<{ name?: string } & Schema>,
    options?: Record<string, any>
  ): CompiledParametersValidator

  /** Creates a ValidationError from raw error data. */
  createValidationError(error: {
    type: string
    message?: string
    errors: Ajv.ErrorObject[]
    options?: Record<string, any>
    json?: any
  }): ValidationError

  /** Creates a DatabaseError from a native DB error. */
  createDatabaseError(error: dbErrors.DBError): DatabaseError

  /**
   * Wraps a database identifier through Knex's
   * `wrapIdentifier` (e.g. camelCase to snake_case).
   */
  normalizeIdentifier(identifier: string): string
  /**
   * Reverses a database identifier through Knex's
   * `postProcessResponse` (e.g. snake_case to camelCase).
   */
  denormalizeIdentifier(identifier: string): string
  /** Normalizes a URL path. */
  normalizePath(path: string): string

  /** Formats an error for logging/response. */
  formatError(error: Error | ResponseError): unknown

  /** Logs an error to the application logger. */
  logError(error: Error | ResponseError, ctx?: KoaContext): void
  /** Releases unused assets past the cleanup threshold. */
  releaseUnusedAssets(options?: {
    timeThreshold?: string | number | null
    transaction?: objection.Transaction | null
    concurrency?: number
  }): Promise<Model[] | undefined>

  /**
   * Creates Asset model records for the given files.
   * Returns inserted assets, or `null` if no AssetModel
   * is registered.
   */
  createAssets(
    storage: Storage,
    files: AssetFile[],
    count?: number,
    transaction?: objection.Transaction | null
  ): Promise<Model[] | null>

  /**
   * Handles added, removed, and changed asset files.
   * Imports foreign assets, updates counts, and schedules
   * cleanup. Returns imported files when an AssetModel is
   * registered.
   */
  handleAddedAndRemovedAssets(
    storage: Storage,
    addedFiles: AssetFile[],
    removedFiles: AssetFile[],
    changedFiles: AssetFile[],
    transaction?: objection.Transaction | null
  ): Promise<AssetFile[] | undefined>

  /**
   * Finds and imports missing assets from external
   * sources (data URIs, file:// URLs, or HTTP URLs).
   * Returns the list of imported files.
   */
  addForeignAssets(
    storage: Storage,
    files: AssetFile[],
    transaction?: objection.Transaction | null
  ): Promise<AssetFile[]>

  /**
   * Handles modifications to existing asset files by
   * updating their stored data. Returns the list of
   * modified files.
   */
  handleModifiedAssets(
    storage: Storage,
    files: AssetFile[],
    transaction?: objection.Transaction | null
  ): Promise<AssetFile[]>

  addRoute(
    method: HTTPMethod,
    path: string,
    transacted: boolean,
    middlewares: OrArrayOf<(ctx: KoaContext, next: Function) => void>,
    controller?: Controller | null,
    action?: any
  ): void

  loadAdminViteConfig(): Promise<UserConfig | null>
  getAssetConfig(options?: {
    models?: string[]
    normalizeDbNames?: boolean
  }): Record<string, Record<string, Record<string, any>>>

  defineAdminViteConfig(config?: UserConfig): UserConfig | null
  logger: PinoLogger
  requestStorage: AsyncLocalStorage<AsyncRequestLocals>
  requestLocals: Partial<AsyncRequestLocals>
}

export interface Application
  extends Omit<
      Koa,
      | 'setMaxListeners'
      | 'removeListener'
      | 'removeAllListeners'
      | 'prependOnceListener'
      | 'prependListener'
      | 'once'
      | 'on'
      | 'off'
      | 'listeners'
      | 'addListener'
      | 'listenerCount'
      | 'emit'
      | 'eventNames'
    >,
    EventEmitter {}

export type SchemaType = LiteralUnion<
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'object'
  | 'array'
  | 'null'
  | 'date'
  | 'datetime'
  | 'timestamp'
>

export interface ModelRelation {
  /**
   * The type of relation
   *
   * @see {@link https://github.com/ditojs/dito/blob/master/docs/model-relations.md#relation-types|Relation Types}
   */
  relation: LiteralUnion<
    'belongsTo' | 'hasMany' | 'hasOne' | 'manyToMany' | 'hasOneThrough'
  >
  /**
   * The model and property name from which the relation is to be built, as a
   * string with both identifiers separated by '.', e.g.:
   * 'FromModelClass.fromPropertyName'
   */
  from: string
  /**
   * The model and property name to which the relation is to be built, as a
   * string with both identifiers separated by '.', e.g.:
   * 'ToModelClass.toPropertyName'
   */
  to: string
  /**
   * When set to true the join model class and table is to be built
   * automatically, or allows to specify an existing one manually.
   *
   * @see {@link https://github.com/ditojs/dito/blob/master/docs/model-relations.md#join-models-and-tables|Join Models and Tables}
   */
  through?:
    | boolean
    | {
        /**
         * The model and property name or table and column name of an existing
         * join model class or join table from which the through relation is to
         * be built, as a string with both identifiers separated by '.', e.g.:
         * 'FromModelClass.fromPropertyName'
         */
        from: string
        /**
         * The model and property name or table and column name of an existing
         * join model class or join table to which the through relation is to be
         * built, as a string with both identifiers separated by '.', e.g.:
         * 'toModelClass.toPropertyName'
         */
        to: string
        /**
         * List additional columns to be added to the related model.
         *
         * When working with a join model class or table, extra columns from it
         * can be added to the related model, as if it was define on its own
         * table. They then appear as additional properties on the related
         * model.
         */
        extra?: string[]
      }
  /**
   * Controls whether the relation is the inverse of another relation.
   *
   * This information is only required when working with through relations.
   * Without it, Dito.js wouldn't be able to tell which side of the relation is
   * on the left-hand side, and which is on the right-hand side when
   * automatically creating the join model class and table.
   */
  inverse?: boolean
  /**
   * Optionally, a scope can be defined to be applied when loading the
   * relation's models. The scope needs to be defined in the related model
   * class' scopes definitions.
   */
  scope?: string
  /**
   * Optionally, a filter to apply when loading the relation's models.
   * Accepts a Dito.js filter name/object (resolved via the related model's
   * filters), or a callback/find-filter object as an alias for `modify`.
   */
  filter?:
    | string
    | { [name: string]: unknown[] }
    | ((query: QueryBuilder) => void)
    | Record<string, unknown>
  /**
   * Controls whether the auto-inserted foreign key property should be marked as
   * nullable. This only makes sense on a 'belongsTo' relation, where the model
   * class holds the foreign key, and only when the foreign key isn't already
   * explicitly defined in the Model Properties.
   */
  nullable?: boolean
  /**
   * Controls whether the relation owns the models that it holds, or whether it
   * is simply relating to them, and a relation elsewhere is considered to be
   * their owner.
   */
  owner?: boolean
  /**
   * An optional modify callback or find-filter object to scope the relation
   * query. This is the Objection.js-native way to modify relation queries.
   *
   * As a function: `modify: query => query.where('active', true)`
   * As an object: `modify: { active: true }` (converted to a find-filter)
   */
  modify?:
    | ((query: QueryBuilder) => void)
    | Record<string, unknown>
}

export type ModelProperty<T = any> = Schema<T> & {
  /** Marks the column as the primary key in the database. */
  primary?: boolean
  /**
   * Defines if the property is a foreign key.
   *
   * Finds the information about the related model in the relations definition
   * and adds a reference to the related model table in migrations, by calling
   * the .references(columnName).inTable(tableName) method.
   */
  foreign?: boolean
  /**
   * Adds an index to the database column in the migrations, by calling the
   * .index() method.
   */
  index?: boolean
  /**
   * Marks the column as nullable in the migrations, by calling the .nullable()
   * method.
   */
  nullable?: boolean
  /**
   * Adds a unique constraint to the table for the given column in the
   * migrations, by calling the .unique() method. If a string is provided, all
   * columns with the same string value for unique are grouped together in one
   * unique constraint, by calling .unique([column1, column2, …]).
   */
  unique?: boolean | string
  /**
   * Marks the column for a property of type 'integer' to be
   * unsigned in the migrations, by calling the .unsigned()
   * method.
   */
  unsigned?: boolean
  /**
   * Marks the property as computed.
   *
   * Computed properties are not present as columns in the database itself. They
   * can be created either by an SQL statement (SELECT … AS), or by a getter
   * accessor defined on the model. Computed properties are set when converting
   * to JSON if not present already, and removed again before data is sent to
   * the database.
   */
  computed?: boolean
  /**
   * Marks the property has hidden, so that it does not show up in data
   * converted to JSON.
   *
   * This can be used for sensitive data.
   */
  hidden?: boolean
}

/**
 * A scope function that modifies a query builder in-place
 * to apply filtering or ordering logic. The return value
 * is ignored at runtime.
 *
 * @see {@link https://github.com/ditojs/dito/blob/master/docs/model-scopes.md|Model Scopes}
 */
export type ModelScope<$Model extends Model = Model> = (
  query: QueryBuilder<$Model>,
  applyParentScope: (query: QueryBuilder<$Model>) => QueryBuilder<$Model>
) => QueryBuilder<$Model, any> | void

/**
 * Map of scope names to scope functions. Scopes can be
 * applied via `withScope()` on queries or set as defaults
 * on controllers.
 *
 * @see {@link https://github.com/ditojs/dito/blob/master/docs/model-scopes.md|Model Scopes}
 */
export type ModelScopes<$Model extends Model = Model> = Record<
  string,
  ModelScope<$Model>
>

/**
 * A filter handler function that modifies a query builder
 * based on external parameters (e.g. from URL query strings).
 */
export type ModelFilterFunction<$Model extends Model = Model> = (
  queryBuilder: QueryBuilder<$Model>,
  ...args: any[]
) => void

/**
 * A model filter definition. Can be one of:
 *
 * - A **built-in filter** reference (`{ filter: 'text' }` or
 *   `{ filter: 'date-range' }`) with optional `properties`.
 * - A **custom filter** with a `handler` function, optional
 *   `parameters` schema for validation, and optional
 *   `response` schema.
 * - A bare **handler function** as shorthand.
 *
 * @see {@link https://github.com/ditojs/dito/blob/master/docs/model-filters.md|Model Filters}
 */
export type ModelFilter<$Model extends Model = Model> =
  | {
      filter: LiteralUnion<'text' | 'date-range'>
      properties?: string[]
    }
  | {
      handler: ModelFilterFunction<$Model>
      parameters?: { [key: string]: Schema }
      response?: Schema
      // TODO: validate type
      validate?: any
    }
  | ModelFilterFunction<$Model>

/**
 * Map of filter names to filter definitions.
 *
 * @see {@link https://github.com/ditojs/dito/blob/master/docs/model-filters.md|Model Filters}
 */
export type ModelFilters<$Model extends Model = Model> = Record<
  string,
  ModelFilter<$Model>
>

/**
 * Configuration for a model asset property, linking it to a
 * named storage backend.
 */
export interface ModelAsset {
  /** The name of the storage backend to use. */
  storage: string
  /**
   * Whether to read image dimensions (width/height) on
   * upload.
   */
  readDimensions?: boolean
}

/** Map of property names to their asset configurations. */
export type ModelAssets = Record<string, ModelAsset>

export interface ModelOptions extends objection.ModelOptions {
  graph?: boolean
  async?: boolean
  mutable?: boolean
}

type ModelHookFunction<$Model extends Model> = (
  args: objection.StaticHookArguments<$Model>
) => void

/**
 * Map of lifecycle hook names to handler functions. Hook
 * names follow the pattern `'before:operation'` or
 * `'after:operation'` where operation is `find`, `insert`,
 * `update`, or `delete`.
 *
 * @example
 * ```ts
 * static hooks: ModelHooks<MyModel> = {
 *   'before:insert': ({ items }) => {
 *     for (const item of items) {
 *       item.createdAt = new Date()
 *     }
 *   }
 * }
 * ```
 */
export type ModelHooks<$Model extends Model = Model> = {
  [key in `${'before' | 'after'}:${
    | 'find'
    | 'insert'
    | 'update'
    | 'delete'
  }`]?: ModelHookFunction<$Model>
}

export class Model extends objection.Model {
  constructor(json?: Record<string, any>)

  /** @see {@link https://github.com/ditojs/dito/blob/master/docs/model-properties.md|Model Properties} */
  static properties: ModelProperties

  /** @see {@link https://github.com/ditojs/dito/blob/master/docs/model-relations.md|Model Relations} */
  static relations: ModelRelations

  /** @see {@link https://github.com/ditojs/dito/blob/master/docs/model-scopes.md|Model Scopes} */
  static scopes: ModelScopes<Model>

  /** @see {@link https://github.com/ditojs/dito/blob/master/docs/model-filters.md|Model Filters} */
  static filters: ModelFilters<Model>

  static hooks: ModelHooks<Model>

  static assets: ModelAssets

  /** The merged definition object, assembled from the class hierarchy. */
  static get definition(): {
    properties: ModelProperties
    relations: ModelRelations
    scopes: ModelScopes
    filters: ModelFilters
    hooks: ModelHooks
    assets: ModelAssets
    options: Record<string, any>
    modifiers: Record<
      string,
      (
        builder: objection.QueryBuilder<any, any>,
        ...args: any[]
      ) => void
    >
    schema: Record<string, any>
    [key: string]: any
  }

  /** Derived from class name (removes 'Model' suffix). */
  static get tableName(): string
  /** Returns the primary key column(s). */
  static get idColumn(): string | string[]
  /**
   * Returns the cached converted relation mappings for
   * the model.
   */
  static get relationMappings(): Record<
    string,
    objection.RelationMapping<Model>
  >

  /** Returns the cached converted JSON schema. */
  static get jsonSchema(): Record<string, any>
  /** Aliases `computedAttributes`. */
  static get virtualAttributes(): string[]

  static get jsonAttributes(): string[]
  static get booleanAttributes(): string[]
  static get dateAttributes(): string[]
  static get computedAttributes(): string[]
  static get hiddenAttributes(): string[]

  /** The application instance this model is registered with. */
  static app: Application<Models>
  /** Whether the model has been initialized by the application. */
  static initialized: boolean
  /** The QueryBuilder class used by this model. */
  static QueryBuilder: typeof QueryBuilder
  /** Whether to deep-clone object attributes on read. */
  static cloneObjectAttributes: boolean
  /**
   * Only pick properties defined in jsonSchema
   * for database JSON.
   */
  static pickJsonSchemaProperties: boolean
  /** Whether to use LIMIT 1 in first() queries. */
  static useLimitInFirst: boolean

  /** Called by the application during model registration. */
  static configure(app: Application<Models>): void
  /** Sets up model schema, relations, and scopes. */
  static setup(): void
  /**
   * Async initialization hook. Override in subclasses for
   * setup that requires async operations.
   * @overridable
   */
  static initialize(): void | Promise<void>

  /**
   * Creates a model instance from JSON data. Dito's
   * override adds async validation support: returns a
   * Promise when `options.async` is true.
   * @override
   */
  static fromJson<M extends Model>(
    this: Constructor<M>,
    json: Record<string, any>,
    options?: ModelOptions
  ): M | Promise<M>

  /** Returns the named scope function, if defined. */
  static getScope(name: string): ModelScope | undefined
  /** Returns whether the model has the named scope. */
  static hasScope(name: string): boolean
  /**
   * Creates a reference instance containing only the
   * identifier properties.
   */
  static getReference(
    modelOrId: Model | Id,
    includeProperties?: string[]
  ): Model

  /** Returns whether the given value is a model reference. */
  static isReference(obj: unknown): boolean
  /** Returns the named property definition, if found. */
  static getProperty(name: string): ModelProperty | null
  /** Returns the model's query modifiers. */
  static getModifiers(): Record<
    string,
    (
      builder: objection.QueryBuilder<any, any>,
      ...args: any[]
    ) => void
  >
  /**
   * Returns property names matching the given filter
   * function.
   */
  static getAttributes(
    filter: (property: ModelProperty) => boolean
  ): string[]

  /** Returns relations where this model is the related side. */
  static getRelatedRelations(): objection.Relation[]

  /**
   * Maps property names to column names (identity
   * function — naming is handled at Knex level).
   * @override
   */
  static propertyNameToColumnName(
    propertyName: string
  ): string

  /**
   * Maps column names to property names (identity
   * function — naming is handled at Knex level).
   * @override
   */
  static columnNameToPropertyName(
    columnName: string
  ): string

  /**
   * Handles modifiers not found directly on the model by
   * checking scopes and special prefixes.
   * @override
   */
  static modifierNotFound(
    query: QueryBuilder<Model>,
    modifier: string | Function
  ): void

  /**
   * Creates a NotFoundError with model context.
   * @override
   */
  static createNotFoundError(
    ctx: Record<string, any>,
    error?: Error
  ): NotFoundError

  /**
   * Returns the shared application validator.
   * @override
   */
  static createValidator(): Validator

  /**
   * Creates a typed validation or relation error from
   * raw error data.
   * @override
   */
  static createValidationError(error: {
    type: string
    message?: string
    errors: any[]
    options?: Record<string, any>
    json?: any
  }): ResponseError

  /** Starts a new transaction. */
  static transaction(): Promise<objection.Transaction>
  /** Runs a callback within a transaction. */
  static transaction(
    handler: (trx: objection.Transaction) => Promise<any>
  ): Promise<any>

  static transaction(
    trx: objection.Transaction,
    handler: (trx: objection.Transaction) => Promise<any>
  ): Promise<any>

  static getPropertyOrRelationAtDataPath(
    dataPath: OrArrayOf<string>
  ): {
    property?: ModelProperty | null
    relation?: objection.Relation | null
    wildcard?: string | null
    dataPath?: string | null
    nestedDataPath?: string | null
    name?: string
    expression?: string | null
  }

  /**
   * Creates a query builder for a relation. Unlike
   * Objection.js, Dito automatically aliases the query
   * to the relation name.
   * @override
   */
  static relatedQuery<M extends Model>(
    this: Constructor<M>,
    relationName: string,
    trx?: objection.Transaction
  ): QueryBuilder<M>

  /**
   * Hook called before find queries.
   * @overridable
   */
  static beforeFind(
    args: objection.StaticHookArguments<Model>
  ): Promise<void>

  /**
   * Hook called after find queries.
   * @overridable
   */
  static afterFind(
    args: objection.StaticHookArguments<Model>
  ): Promise<void>

  /**
   * Hook called before insert queries.
   * @overridable
   */
  static beforeInsert(
    args: objection.StaticHookArguments<Model>
  ): Promise<void>

  /**
   * Hook called after insert queries.
   * @overridable
   */
  static afterInsert(
    args: objection.StaticHookArguments<Model>
  ): Promise<void>

  /**
   * Hook called before update queries.
   * @overridable
   */
  static beforeUpdate(
    args: objection.StaticHookArguments<Model>
  ): Promise<void>

  /**
   * Hook called after update queries.
   * @overridable
   */
  static afterUpdate(
    args: objection.StaticHookArguments<Model>
  ): Promise<void>

  /**
   * Hook called before delete queries.
   * @overridable
   */
  static beforeDelete(
    args: objection.StaticHookArguments<Model>
  ): Promise<void>

  /**
   * Hook called after delete queries.
   * @overridable
   */
  static afterDelete(
    args: objection.StaticHookArguments<Model>
  ): Promise<void>

  static count: {
    (column?: objection.ColumnRef, options?: { as: string }): Promise<number>
    (aliasToColumnDict: Record<string, string | string[]>): Promise<number>
    (...columns: objection.ColumnRef[]): Promise<number>
  }

  /**
   * Filters a model graph using a relation expression,
   * removing any data not matching the expression.
   */
  static filterGraph(
    modelGraph: Model | Model[],
    expr: string | objection.RelationExpression<Model>
  ): Model | Model[]

  /**
   * Populates a model graph by loading relations defined
   * in the given expression.
   */
  static populateGraph(
    modelGraph: Model | Model[],
    expr: string | objection.RelationExpression<Model>,
    trx?: objection.Transaction
  ): Promise<Model | Model[]>

  /**
   * Dito.js automatically adds an `id` property if a model
   * property with the `primary: true` setting is not
   * already explicitly defined.
   */
  readonly id: Id

  /**
   * Dito.js automatically adds a `foreignKeyId` property
   * if foreign keys occurring in relations definitions are
   * not explicitly defined in the properties.
   */
  readonly foreignKeyId: Id

  QueryBuilderType: QueryBuilder<this, this[]>

  $app: Application<Models>
  /**
   * Called after model construction. Override in subclasses
   * for custom instance initialization.
   * @overridable
   */
  $initialize(): void
  $is(model: Model | null | undefined): boolean
  /** Returns `true` if all named properties are defined. */
  $has(...properties: string[]): boolean
  /** Runs a callback within a transaction. */
  $transaction(
    handler: (trx: objection.Transaction) => Promise<any>
  ): Promise<any>

  $transaction(
    trx: objection.Transaction,
    handler: (trx: objection.Transaction) => Promise<any>
  ): Promise<any>

  /** Emits an event on this model instance. */
  $emit(event: string, ...args: any[]): Promise<any[]>
  /**
   * Filters a model graph using a relation expression,
   * removing data not matching the expression.
   */
  $filterGraph(
    modelGraph: Model | Model[],
    expr: string | objection.RelationExpression<Model>
  ): Model | Model[]

  /**
   * Populates a model graph by loading relations defined
   * in the given expression.
   */
  $populateGraph(
    modelGraph: Model | Model[],
    expr: string | objection.RelationExpression<Model>,
    trx?: objection.Transaction
  ): Promise<Model | Model[]>

  $update(
    attributes: Partial<ExtractModelProperties<this>>,
    trx?: objection.Transaction
  ): objection.SingleQueryBuilder<objection.QueryBuilderType<this>>

  $patch(
    attributes: Partial<ExtractModelProperties<this>>,
    trx?: objection.Transaction
  ): objection.SingleQueryBuilder<objection.QueryBuilderType<this>>

  $validate<$JSON extends null | {}>(
    json?: $JSON,
    options?: ModelOptions & Record<string, any>
  ): ($JSON | this) | Promise<$JSON | this>

  $validateGraph(
    options: ModelOptions & Record<string, any>
  ): Promise<this>

  /**
   * Sets JSON data on the model instance. Triggers
   * `$initialize()` when appropriate.
   * @override
   */
  $setJson(
    json: Record<string, any>,
    options?: ModelOptions
  ): this

  /**
   * Formats data for database storage. Converts dates to
   * ISO strings, handles boolean conversion for SQLite,
   * and removes computed properties.
   * @override @overridable
   */
  $formatDatabaseJson(
    json: Record<string, any>
  ): Record<string, any>

  /**
   * Parses data from the database. Converts SQLite
   * booleans back and delegates to `$parseJson()` for
   * date and AssetFile handling.
   * @override @overridable
   */
  $parseDatabaseJson(
    json: Record<string, any>
  ): Record<string, any>

  /**
   * Parses general JSON data. Converts date strings to
   * Date objects and handles asset file conversion.
   * @override @overridable
   */
  $parseJson(
    json: Record<string, any>
  ): Record<string, any>

  /**
   * Formats data for API output. Removes hidden
   * attributes from the JSON representation.
   * @override @overridable
   */
  $formatJson(
    json: Record<string, any>
  ): Record<string, any>

  /* -------------------- Start QueryBuilder.mixin(Model) ------------------- */
  static first: StaticQueryBuilderMethod<'first'>
  static find: StaticQueryBuilderMethod<'find'>
  static findOne: StaticQueryBuilderMethod<'findOne'>
  static findById: StaticQueryBuilderMethod<'findById'>

  static withGraph: StaticQueryBuilderMethod<'withGraph'>
  static withGraphFetched: StaticQueryBuilderMethod<'withGraphFetched'>
  static withGraphJoined: StaticQueryBuilderMethod<'withGraphJoined'>
  static clearWithGraph: StaticQueryBuilderMethod<'clearWithGraph'>

  static withScope: StaticQueryBuilderMethod<'withScope'>
  static applyScope: StaticQueryBuilderMethod<'applyScope'>
  static clearWithScope: StaticQueryBuilderMethod<'clearWithScope'>

  static clear: StaticQueryBuilderMethod<'clear'>
  static select: StaticQueryBuilderMethod<'select'>

  static insert: StaticQueryBuilderMethod<'insert'>
  static upsert: StaticQueryBuilderMethod<'upsert'>
  static update: StaticQueryBuilderMethod<'update'>
  static patch: StaticQueryBuilderMethod<'patch'>
  static delete: StaticQueryBuilderMethod<'delete'>

  static updateById: StaticQueryBuilderMethod<'updateById'>
  static patchById: StaticQueryBuilderMethod<'patchById'>
  static deleteById: StaticQueryBuilderMethod<'deleteById'>

  static truncate: StaticQueryBuilderMethod<'truncate'>

  static insertAndFetch: StaticQueryBuilderMethod<'insertAndFetch'>
  static upsertAndFetch: StaticQueryBuilderMethod<'upsertAndFetch'>
  static updateAndFetch: StaticQueryBuilderMethod<'updateAndFetch'>
  static patchAndFetch: StaticQueryBuilderMethod<'patchAndFetch'>
  static patchAndFetchById: StaticQueryBuilderMethod<'patchAndFetchById'>
  static updateAndFetchById: StaticQueryBuilderMethod<'updateAndFetchById'>

  static insertGraph: StaticQueryBuilderMethod<'insertGraph'>
  static upsertGraph: StaticQueryBuilderMethod<'upsertGraph'>
  static insertGraphAndFetch: StaticQueryBuilderMethod<'insertGraphAndFetch'>
  static upsertGraphAndFetch: StaticQueryBuilderMethod<'upsertGraphAndFetch'>

  static insertDitoGraph: StaticQueryBuilderMethod<'insertDitoGraph'>
  static upsertDitoGraph: StaticQueryBuilderMethod<'upsertDitoGraph'>
  static updateDitoGraph: StaticQueryBuilderMethod<'updateDitoGraph'>
  static patchDitoGraph: StaticQueryBuilderMethod<'patchDitoGraph'>

  static insertDitoGraphAndFetch: StaticQueryBuilderMethod<'insertDitoGraphAndFetch'>
  static upsertDitoGraphAndFetch: StaticQueryBuilderMethod<'upsertDitoGraphAndFetch'>
  static updateDitoGraphAndFetch: StaticQueryBuilderMethod<'updateDitoGraphAndFetch'>
  static patchDitoGraphAndFetch: StaticQueryBuilderMethod<'patchDitoGraphAndFetch'>
  static upsertDitoGraphAndFetchById: StaticQueryBuilderMethod<'upsertDitoGraphAndFetchById'>
  static updateDitoGraphAndFetchById: StaticQueryBuilderMethod<'updateDitoGraphAndFetchById'>
  static patchDitoGraphAndFetchById: StaticQueryBuilderMethod<'patchDitoGraphAndFetchById'>

  static where: StaticQueryBuilderMethod<'where'>
  static whereNot: StaticQueryBuilderMethod<'whereNot'>
  static whereRaw: StaticQueryBuilderMethod<'whereRaw'>
  static whereWrapped: StaticQueryBuilderMethod<'whereWrapped'>
  static whereExists: StaticQueryBuilderMethod<'whereExists'>
  static whereNotExists: StaticQueryBuilderMethod<'whereNotExists'>
  static whereIn: StaticQueryBuilderMethod<'whereIn'>
  static whereNotIn: StaticQueryBuilderMethod<'whereNotIn'>
  static whereNull: StaticQueryBuilderMethod<'whereNull'>
  static whereNotNull: StaticQueryBuilderMethod<'whereNotNull'>
  static whereBetween: StaticQueryBuilderMethod<'whereBetween'>
  static whereNotBetween: StaticQueryBuilderMethod<'whereNotBetween'>
  static whereColumn: StaticQueryBuilderMethod<'whereColumn'>
  static whereNotColumn: StaticQueryBuilderMethod<'whereNotColumn'>
  static whereComposite: StaticQueryBuilderMethod<'whereComposite'>
  static whereInComposite: StaticQueryBuilderMethod<'whereInComposite'>
  static whereNotInComposite: StaticQueryBuilderMethod<'whereNotInComposite'>
  static whereJsonHasAny: StaticQueryBuilderMethod<'whereJsonHasAny'>
  static whereJsonHasAll: StaticQueryBuilderMethod<'whereJsonHasAll'>
  static whereJsonIsArray: StaticQueryBuilderMethod<'whereJsonIsArray'>
  static whereJsonNotArray: StaticQueryBuilderMethod<'whereJsonNotArray'>
  static whereJsonIsObject: StaticQueryBuilderMethod<'whereJsonIsObject'>
  static whereJsonNotObject: StaticQueryBuilderMethod<'whereJsonNotObject'>
  static whereJsonSubsetOf: StaticQueryBuilderMethod<'whereJsonSubsetOf'>
  static whereJsonNotSubsetOf: StaticQueryBuilderMethod<'whereJsonNotSubsetOf'>
  static whereJsonSupersetOf: StaticQueryBuilderMethod<'whereJsonSupersetOf'>
  static whereJsonNotSupersetOf: StaticQueryBuilderMethod<'whereJsonNotSupersetOf'>

  static having: StaticQueryBuilderMethod<'having'>
  static havingIn: StaticQueryBuilderMethod<'havingIn'>
  static havingNotIn: StaticQueryBuilderMethod<'havingNotIn'>
  static havingNull: StaticQueryBuilderMethod<'havingNull'>
  static havingNotNull: StaticQueryBuilderMethod<'havingNotNull'>
  static havingExists: StaticQueryBuilderMethod<'havingExists'>
  static havingNotExists: StaticQueryBuilderMethod<'havingNotExists'>
  static havingBetween: StaticQueryBuilderMethod<'havingBetween'>
  static havingNotBetween: StaticQueryBuilderMethod<'havingNotBetween'>
  static havingRaw: StaticQueryBuilderMethod<'havingRaw'>
  static havingWrapped: StaticQueryBuilderMethod<'havingWrapped'>

  // static scope:  QueryBuilder<Model>['scope']
  // static mergeScope:  QueryBuilder<Model>['mergeScope']
  // static clearScope:  QueryBuilder<Model>['clearScope']

  /* --------------------- End QueryBuilder.mixin(Model) -------------------- */
}

type StaticQueryBuilderMethod<
  K extends ConditionalKeys<QueryBuilder<Model>, (...a: any[]) => any>
> = <$Model extends Class<Model>>(
  ...args: Parameters<QueryBuilder<InstanceType<$Model>>[K]>
) => ReturnType<QueryBuilder<InstanceType<$Model>>[K]>

// @eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Model extends EventEmitter {}
export interface Model extends KnexHelper {}

export type ModelClass = Class<Model>

export type ModelRelations = Record<string, ModelRelation>

export type ModelProperties = Record<string, ModelProperty>

/**
 * A controller action definition. Either an options object
 * with `handler`, `method`, `path`, `authorize`, etc., or a
 * bare handler function. The HTTP method and path are
 * derived from the action name key (e.g. `'postImport'`
 * maps to `POST /import`).
 */
export type ControllerAction<$Controller extends Controller = Controller> =
  | ControllerActionOptions<$Controller>
  | ControllerActionHandler<$Controller>

export class Controller {
  app: Application
  /**
   * Optionally provide the controller path. A default is
   * deducted from the normalized class name otherwise.
   */
  path?: string
  /**
   * The controller's name. If not provided, it is
   * automatically deducted from the controller class name.
   * If this name ends in 'Controller', that is stripped
   * off the name, so 'GreetingsController' turns into
   * 'Greetings'.
   */
  name?: string
  /**
   * The controller's namespace, which is prepended to path
   * to generate the absolute controller route. Note that
   * it is rare to provide this manually. Usually Dito.js
   * determines the namespace automatically from the
   * controller object passed to the Dito.js application's
   * constructor and its sub-objects.
   *
   * @see {@link https://github.com/ditojs/dito/blob/master/docs/controllers.md#namespaces Namespaces}
   */
  namespace?: string
  /** The fully resolved URL for this controller. */
  url?: string
  /**
   * Whether actions should be transacted by default.
   * Can be overridden per-action.
   */
  transacted?: boolean
  /** Whether this controller has been initialized. */
  initialized: boolean
  /** The nesting level of this controller. */
  level: number
  /** Whether to log routes during setup. */
  logRoutes: boolean

  /**
   * A list of allowed actions. If provided, only the
   * action names listed here as strings will be mapped to
   * routes, everything else will be omitted.
   */
  allow?: OrReadOnly<ControllerActionName[]>

  /** Authorization */
  authorize?: Authorize
  actions?: ControllerActions<this>

  /** Returns the logger, optionally scoped to a context. */
  getLogger(ctx?: KoaContext): PinoLogger
  /** The controller's logger instance. */
  get logger(): PinoLogger
  /**
   * Returns a member model for the request context.
   * No-op in the base class; override in subclasses.
   */
  getMember(
    ctx?: KoaContext,
    base?: any,
    options?: {
      query?: Record<string, any>
      modify?: (query: QueryBuilder<Model>) => QueryBuilder<Model>
      forUpdate?: boolean
    }
  ): Promise<Model | null>

  setProperty(key: string, value: unknown): void

  /**
   * Called right after the constructor, before `setup()` and `initialize()`.
   * @overridable
   */
  configure(): void
  /* @overridable */
  setup(): void
  /**
   * To be overridden in sub-classes, if the controller needs to initialize.
   * @overridable
   */
  initialize(): Promise<void>
  /**
   * @overridable
   */
  logController(): void
  /**
   * @param str The string to log.
   * @param [indent=0] The amount of levels to indent (in pairs of two spaces).
   *   Default is `0`
   */
  logRoute(str: string, indent?: number): void
  setupRoute<$ControllerAction extends ControllerAction = ControllerAction>(
    method: HTTPMethod,
    url: string,
    transacted: boolean,
    authorize: Authorize,
    action: $ControllerAction,
    handlers: ((ctx: KoaContext, next: Function) => void)[]
  ): void

  setupActions(type: string): any
  setupActionRoute(type: string, action: ControllerAction): void
  setupAssets(): any
  setupAssetRoute(
    dataPath: OrArrayOf<string>,
    config: any,
    authorize: Authorize
  ): void

  /**
   * To be overridden in sub-classes, if the controller needs to install
   * middleware.
   * @overridable
   */
  compose(): Parameters<typeof koaMount>[1]
  /** To be overridden by sub-classes. */
  getPath(type: string, path: string): string
  getUrl(type: string, path: string): string
  inheritValues(type: string): Record<string, unknown> | undefined
  processValues(values: Record<string, unknown>): {
    values: Record<string, unknown>
    allow: string[]
    authorize: Record<string, Authorize>
  }

  emitHook(
    type: string,
    handleResult: boolean,
    ctx: KoaContext,
    ...args: any[]
  ): Promise<any>

  processAuthorize(
    authorize: Authorize
  ): (ctx: KoaContext, member?: Model) => OrPromiseOf<boolean>

  describeAuthorize(authorize: Authorize): string
  handleAuthorization(
    authorization: (
      ctx: KoaContext,
      member?: Model
    ) => OrPromiseOf<boolean>,
    ctx: KoaContext,
    member?: Model
  ): Promise<void>
}

export interface Controller extends EventEmitter {}

/** A named action parameter with a JSON Schema definition. */
export type ActionParameter = Schema & { name: string }

/**
 * Handler function for a model controller action. Receives
 * the Koa context and any resolved action parameters. `this`
 * is bound to the controller instance.
 */
export type ModelControllerActionHandler<
  $ModelController extends ModelController = ModelController
> = (this: $ModelController, ctx: KoaContext, ...args: any[]) => any

/**
 * Handler function for a controller action. Receives the Koa
 * context and any resolved action parameters. `this` is
 * bound to the controller instance.
 */
export type ControllerActionHandler<
  $Controller extends Controller = Controller
> = (this: $Controller, ctx: KoaContext, ...args: any[]) => any

export type ExtractModelProperties<$Model extends Model = Model> = {
  [K in SelectModelPropertyKeys<$Model>]: $Model[K] extends Model
    ? ExtractModelProperties<$Model[K]>
    : $Model[K]
}

export type SelectModelPropertyKeys<$Model extends Model> = {
  [K in keyof $Model]-?: K extends
    | 'QueryBuilderType'
    | 'foreignKeyId'
    | `$${string}`
    ? never
    : $Model[K] extends Function
      ? never
      : K
}[keyof $Model]

/**
 * Authorization configuration for controllers and actions.
 *
 * - `boolean`: `true` requires authentication, `false` is
 *   public.
 * - `'$self'`: Authorized only if the member matches the
 *   authenticated user.
 * - `'$owner'`: Authorized if the member is owned by the
 *   authenticated user (via `Model.$hasOwner()`).
 * - Any other `string`: Checked as a role via
 *   `UserModel.$hasRole()`.
 * - `function`: Dynamically resolves to any of the above.
 * - `Record<HTTPMethod, string | string[]>`: Per-method
 *   role authorization.
 */
export type Authorize =
  | boolean
  | OrArrayOf<LiteralUnion<'$self' | '$owner'>>
  | ((ctx: KoaContext) => OrPromiseOf<Authorize>)
  | Record<HTTPMethod, string | string[]>

export type BaseControllerActionOptions = {
  /**
   * The HTTP method (`'get'`, `'post'`, `'put'`, `'delete'` or `'patch'`) to
   * which the action should listen. By default, the `'get'` method is assigned
   * if none is provided.
   */
  method?: HTTPMethod
  /**
   * The path to which the action is mapped, defined in relation to the route
   * path of its controller. By default, the normalized method name is used as
   * the action's path.
   */
  path?: string
  /**
   * Determines whether or how the request is authorized. This value can either
   * be one of the values as described below, an array of them or a function
   * which returns one or more of them.
   *
   * - Boolean: `true` if the action should be authorized, `false` otherwise.
   * - '$self': The requested member is checked against `ctx.state.user` and the
   *   action is only authorized if it matches the member.
   * - '$owner': The member is asked if it is owned by `ctx.state.user` through
   *   the optional `Model.$hasOwner()` method.
   * - Any string: `ctx.state.user` is checked for this role through the
   *   overridable `UserModel.hasRole()` method.
   */
  authorize?: Authorize
  /**
   * Validates action parameters and maps them to Koa's `ctx.query` object
   * passed to the action handler.
   *
   * @see {@link https://github.com/ditojs/dito/blob/master/docs/model-properties.md Model Properties}
   */
  parameters?: { [key: string]: Schema }
  /**
   * Provides a schema for the value returned from the action handler and
   * optionally maps the value to a key inside a returned object when it
   * contains a `name` property.
   *
   * @see {@link https://github.com/ditojs/dito/blob/master/docs/model-properties.md Model Properties}
   */
  response?: Schema & { name?: string }
  /**
   * The scope(s) to be applied to every query executed through the action.
   *
   * @see {@link https://github.com/ditojs/dito/blob/master/docs/model-scopes.md Model Scopes}
   */
  scope?: string[]
  /**
   * Determines whether queries in the action should be executed within a
   * transaction. Any failure will mean the database will rollback any queries
   * executed to the pre-transaction state.
   */
  transacted?: boolean
}

export type ControllerActionOptions<
  $Controller extends Controller = Controller
> = BaseControllerActionOptions & {
  handler: ControllerActionHandler<$Controller>
}

export type ModelControllerActionOptions<
  $ModelController extends ModelController = ModelController
> = BaseControllerActionOptions & {
  /** The function to be called when the action route is requested. */
  handler: ModelControllerActionHandler<$ModelController>
}

export type MemberActionParameter<$Model extends Model = Model> =
  | Schema
  | {
      from: 'member'

      /** Sets ctx.query. */
      query?: Record<string, any>
      /**
       * Adds a FOR UPDATE in PostgreSQL and MySQL during a select statement.
       * FOR UPDATE causes the rows retrieved by the SELECT statement to be
       * locked as though for update. This prevents them from being locked,
       * modified or deleted by other transactions until the current transaction
       * ends.
       *
       * @default `false`
       * @see {@link http://knexjs.org/#Builder-forUpdate}
       * @see {@link https://www.postgresql.org/docs/12/explicit-locking.html#LOCKING-ROWS}
       */
      forUpdate?: boolean
      /** Modify the member query. */
      modify?: (query: QueryBuilder<$Model>) => QueryBuilder<$Model>
    }

/**
 * A model controller action: either an options object with
 * `handler` or a bare handler function.
 */
export type ModelControllerAction<
  $ModelController extends ModelController = ModelController
> =
  | ModelControllerActionOptions<$ModelController>
  | ModelControllerActionHandler<$ModelController>

/**
 * Map of action names to action definitions for a model
 * controller's collection-level actions (e.g. `getList`,
 * `postCreate`).
 */
export type ModelControllerActions<
  $ModelController extends ModelController = ModelController
> = {
  [name: ControllerActionName]: ModelControllerAction<$ModelController>
  allow?: OrReadOnly<ControllerActionName[]>
  authorize?: Authorize
}

type ModelControllerMemberAction<
  $ModelController extends ModelController = ModelController
> =
  | (Omit<ModelControllerActionOptions<$ModelController>, 'parameters'> & {
      parameters?: {
        [key: string]: MemberActionParameter<
          ModelFromModelController<$ModelController>
        >
      }
    })
  | ModelControllerActionHandler<$ModelController>

/**
 * Map of action names to action definitions for a model
 * controller's member-level actions (e.g. `get`, `patch`,
 * `delete`). Member actions can use `{ from: 'member' }`
 * parameters to receive the resolved member model.
 */
export type ModelControllerMemberActions<
  $ModelController extends ModelController = ModelController
> = {
  [name: ControllerActionName]: ModelControllerMemberAction<$ModelController>
  allow?: OrReadOnly<ControllerActionName[]>
  authorize?: Authorize
}

/**
 * Action name pattern: an HTTP method followed by an
 * optional suffix, e.g. `'getStats'`, `'postImport'`,
 * `'deleteAll'`.
 */
export type ControllerActionName = `${HTTPMethod}${string}`

/**
 * Map of action names to action definitions for a
 * controller. Supports `allow` to whitelist specific
 * actions and `authorize` for group-level authorization.
 */
export type ControllerActions<$Controller extends Controller = Controller> = {
  [name: ControllerActionName]: ControllerAction<$Controller>
  allow?: OrReadOnly<ControllerActionName[]>
  authorize?: Authorize
}

export class UsersController<
  M extends Model = Model
> extends ModelController<M> {
  /**
   * Returns whether the current request is authenticated
   * and the user is an instance of the controller's model.
   */
  isAuthenticated(ctx: KoaContext): boolean
}

export class AdminController extends Controller {
  config: AdminConfig
  mode: 'production' | 'development'
  closed: boolean
  koa: Koa
  getPath(name: string): string
  getDitoObject(): {
    base: string
    api: AdminConfig['api']
    settings: AdminConfig['settings']
  }

  sendDitoObject(ctx: Koa.Context): void
  middleware(): Koa.Middleware
  setupViteServer(): Promise<void>
  defineViteConfig(config?: UserConfig): UserConfig
}
type ModelControllerHookType = 'collection' | 'member'
type ModelControllerHookKeys<
  $Keys extends string,
  $ModelControllerHookType extends string
> = `${
  | 'before'
  | 'after'
  | '*'
}:${
  | $ModelControllerHookType
  | '*'
}:${
  | Exclude<$Keys, 'allow'>
  | ControllerActionName
  | '*'
}`
type ModelControllerHook<
  $ModelController extends ModelController = ModelController
> = (
  ctx: KoaContext,
  result: objection.Page<ModelFromModelController<$ModelController>>
) => any

type HookKeysFromController<$ModelController extends ModelController> =
  | ModelControllerHookKeys<
      Exclude<
        keyof Exclude<$ModelController['collection'], undefined>,
        symbol | number
      >,
      'collection'
    >
  | ModelControllerHookKeys<
      Exclude<
        keyof Exclude<$ModelController['member'], undefined>,
        symbol | number
      >,
      'member'
    >

type HandlerFromHookKey<
  $ModelController extends ModelController,
  K extends HookKeysFromController<$ModelController>
> = K extends `${
  | 'before'
  | 'after'
  | '*'
}:${
  | 'collection'
  | 'member'
  | '*'
}:${string}`
  ? (this: $ModelController, ctx: KoaContext, ...args: any[]) => any
  : never

type ModelControllerHooks<
  $ModelController extends ModelController = ModelController
> = {
  [$Key in HookKeysFromController<$ModelController>]?: HandlerFromHookKey<
    $ModelController,
    $Key
  >
}

/**
 * Scope(s) to apply to all queries in a model controller.
 * A single scope name or an array of scope names.
 */
export type ModelControllerScope = OrArrayOf<string>

/**
 * Abstract base class for controllers that operate on
 * model collections. Provides CRUD action infrastructure,
 * query building, and member resolution.
 */
export class CollectionController<
  $Model extends Model = Model
> extends Controller {
  /**
   * The model class this controller operates on. Set by
   * subclasses during configuration.
   */
  modelClass?: Class<$Model>
  /**
   * Whether to use graph methods for insert/update/patch.
   *
   * @defaultValue `false`
   */
  graph?: boolean
  /** Whether the controller handles relate operations. */
  relate?: boolean
  /**
   * Whether the controller handles unrelate operations.
   */
  unrelate?: boolean
  /** Whether this is a one-to-one relation controller. */
  isOneToOne: boolean
  /** The route parameter name for the member id. */
  idParam: string
  /**
   * The scope(s) to apply to every query executed through
   * this controller.
   */
  scope?: ModelControllerScope
  allowScope?: boolean | OrArrayOf<string>
  allowFilter?: boolean | OrArrayOf<string>
  allowParam?: OrArrayOf<LiteralUnion<keyof QueryParameterOptions>>

  /**
   * The controller's collection actions with built-in CRUD
   * defaults.
   */
  collection?: ModelControllerActions<CollectionController<$Model>>
  /**
   * The controller's member actions with built-in CRUD
   * defaults.
   */
  member?: ModelControllerMemberActions<CollectionController<$Model>>

  /** Creates a query builder for this controller's model. */
  query(trx?: objection.Transaction): QueryBuilder<$Model>
  /**
   * Applies controller-level scopes and configuration to
   * a query builder.
   */
  setupQuery(
    query: QueryBuilder<$Model>,
    base?: any
  ): QueryBuilder<$Model>

  /**
   * Extracts the member id from the request context's
   * route parameters.
   */
  getMemberId(ctx: KoaContext): Id | Id[]
  /**
   * Retrieves the model id from a model instance.
   */
  getModelId(model: $Model): Id | Id[]
  /**
   * Retrieves a member model from the database for the
   * current request context.
   */
  getMember(
    ctx: KoaContext,
    base?: any,
    options?: {
      query?: Record<string, any>
      modify?: (query: QueryBuilder<$Model>) => QueryBuilder<$Model>
      forUpdate?: boolean
    }
  ): Promise<$Model | null>

  /**
   * Executes a controller action within a transaction
   * context.
   */
  execute(
    ctx: KoaContext,
    execute: (
      query: QueryBuilder<$Model>,
      trx?: objection.Transaction
    ) => any
  ): Promise<any>

  /**
   * Extracts model IDs from the request body collection,
   * validating each ID.
   */
  getCollectionIds(ctx: KoaContext): Array<Id | Id[]>
  /**
   * Returns relevant IDs for the current request: from
   * route params for member requests, from body for
   * collection requests.
   */
  getIds(ctx: KoaContext): Array<Id | Id[]>
  /**
   * Returns the request context extended with a memberId
   * property.
   */
  getContextWithMemberId(
    ctx: KoaContext,
    memberId?: Id | Id[]
  ): KoaContext

  /**
   * Validates and coerces a model ID using the model
   * class's reference mechanism.
   */
  validateId(id: any): Id | Id[]

  /**
   * Executes an insert/update/patch action and fetches
   * the result. Supports both normal and DitoGraph modes.
   */
  executeAndFetch(
    action: string,
    ctx: KoaContext,
    modify?: (
      query: QueryBuilder<$Model>,
      trx?: objection.Transaction
    ) => void,
    body?: Record<string, any>
  ): Promise<$Model>

  /**
   * Executes a by-id mutation action and fetches the
   * result. Throws NotFoundError if not found.
   */
  executeAndFetchById(
    action: string,
    ctx: KoaContext,
    modify?: (
      query: QueryBuilder<$Model>,
      trx?: objection.Transaction
    ) => void,
    body?: Record<string, any>
  ): Promise<$Model>
}

/**
 * Controller for a top-level model resource. Extends
 * CollectionController with relation and asset setup.
 */
export class ModelController<
  $Model extends Model = Model
> extends CollectionController<$Model> {
  /**
   * The model class this controller represents. If not
   * provided, the singularized controller name is used
   * to look up the model class in models registered with
   * the application.
   */
  modelClass?: Class<$Model>
  /**
   * The controller's collection actions. Wrap actions in
   * this object to assign them to the collection.
   */
  collection?: ModelControllerActions<ModelController<$Model>>
  /**
   * The controller's member actions. Wrap actions in this
   * object to assign them to the member.
   */
  member?: ModelControllerMemberActions<ModelController<$Model>>
  assets?:
    | boolean
    | {
        allow?: OrArrayOf<string>
        authorize: Record<string, OrArrayOf<string>>
      }

  /**
   * When nothing is returned from a hook, the standard
   * action result is used.
   */
  hooks?: ModelControllerHooks<ModelController<$Model>>
  /** Map of relation name to RelationController instance. */
  relations?: Record<string, RelationController>
}

/**
 * Controller for nested relation resources. Created
 * automatically by ModelController during relation setup.
 */
export class RelationController<
  $Model extends Model = Model
> extends CollectionController<$Model> {
  /** The parent controller that owns this relation. */
  parent: CollectionController

  /** The raw relation definition object. */
  object: Record<string, unknown>

  /** The Objection.js relation instance. */
  relationInstance: objection.Relation

  /** The raw relation definition from the parent. */
  relationDefinition: Record<string, unknown>

  /** Whether this is a one-to-one relation. */
  isOneToOne: boolean
  /** Whether relate operations are supported. */
  relate: boolean
  /** Whether unrelate operations are supported. */
  unrelate: boolean
}

export class Validator extends objection.Validator {
  constructor(options?: {
    options?: {
      /** @defaultValue `false` */
      async?: boolean
      /** @defaultValue `false` */
      patch?: boolean
      /** @defaultValue `false` */
      $data?: boolean
      /** @defaultValue `false` */
      $comment?: boolean
      /** @defaultValue `false` */
      coerceTypes?: boolean
      /** @defaultValue `false` */
      multipleOfPrecision?: boolean
      /** @defaultValue `true` */
      ownProperties?: boolean
      /** @defaultValue `false` */
      removeAdditional?: boolean
      /** @defaultValue `true` */
      uniqueItems?: boolean
      /** @defaultValue `true` */
      useDefaults?: boolean
      /** @defaultValue `false` */
      verbose?: boolean
    }
    keywords?: Record<string, Keyword>
    formats?: Record<string, Format>
    types?: Record<string, any>
  })

  /**
   * Compiles a JSON schema into a validation function.
   * Supports sync, async, and throwing modes via options.
   */
  compile(
    jsonSchema: Schema,
    options?: Record<string, any>
  ): Ajv.ValidateFunction

  /** Adds a schema to all cached Ajv instances. */
  addSchema(jsonSchema: Schema): void

  /**
   * Returns a cached Ajv instance for the given options,
   * creating one if needed.
   */
  getAjv(options?: Record<string, any>): Ajv.default

  /** Creates a new Ajv instance with the given options. */
  createAjv(options?: Record<string, any>): Ajv.default

  /**
   * Converts Ajv validation errors into an Objection.js
   * style error hash.
   */
  parseErrors(
    errors: Ajv.ErrorObject[],
    options?: Record<string, any>
  ): Record<string, any[]>

  /**
   * Processes a JSON schema for patch or async validation
   * modes.
   */
  processSchema(
    jsonSchema: Schema,
    options?: Record<string, any>
  ): Schema

  /** Returns a registered keyword definition by name. */
  getKeyword(name: string): Keyword | undefined

  /** Returns a registered format definition by name. */
  getFormat(name: string): Format | undefined

  /** Prefixes error instance paths with a given prefix. */
  prefixInstancePaths(
    errors: Ajv.ErrorObject[],
    prefix: string
  ): Ajv.ErrorObject[]
}

// NOTE: Because EventEmitter overrides a number of EventEmitter2 methods with
// changed signatures, we are unable to extend it.
export class EventEmitter {
  static mixin: (target: any) => void
  constructor(options?: EventEmitter2.ConstructorOptions)
  emit(
    event: EventEmitter2.event | EventEmitter2.eventNS,
    ...values: any[]
  ): Promise<any[]>

  on(
    event: EventEmitter2.event | EventEmitter2.eventNS,
    listener: EventEmitter2.ListenerFn
  ): this

  on(
    event: string[],
    listener: EventEmitter2.ListenerFn
  ): this

  on(
    event: Record<string, EventEmitter2.ListenerFn>
  ): this

  off(
    event: EventEmitter2.event | EventEmitter2.eventNS,
    listener: EventEmitter2.ListenerFn
  ): this

  off(
    event: string[],
    listener: EventEmitter2.ListenerFn
  ): this

  off(
    event: Record<string, EventEmitter2.ListenerFn>
  ): this

  once(
    event: EventEmitter2.event | EventEmitter2.eventNS,
    listener: EventEmitter2.ListenerFn
  ): this

  once(
    event: string[],
    listener: EventEmitter2.ListenerFn
  ): this

  once(
    event: Record<string, EventEmitter2.ListenerFn>
  ): this

  // From EventEmitter2:
  emitAsync(
    event: EventEmitter2.event | EventEmitter2.eventNS,
    ...values: any[]
  ): Promise<any[]>

  addListener(
    event: EventEmitter2.event | EventEmitter2.eventNS,
    listener: EventEmitter2.ListenerFn
  ): this | EventEmitter2.Listener

  prependListener(
    event: EventEmitter2.event | EventEmitter2.eventNS,
    listener: EventEmitter2.ListenerFn,
    options?: boolean | EventEmitter2.OnOptions
  ): this | EventEmitter2.Listener

  prependOnceListener(
    event: EventEmitter2.event | EventEmitter2.eventNS,
    listener: EventEmitter2.ListenerFn,
    options?: boolean | EventEmitter2.OnOptions
  ): this | EventEmitter2.Listener

  many(
    event: EventEmitter2.event | EventEmitter2.eventNS,
    timesToListen: number,
    listener: EventEmitter2.ListenerFn,
    options?: boolean | EventEmitter2.OnOptions
  ): this | EventEmitter2.Listener

  prependMany(
    event: EventEmitter2.event | EventEmitter2.eventNS,
    timesToListen: number,
    listener: EventEmitter2.ListenerFn,
    options?: boolean | EventEmitter2.OnOptions
  ): this | EventEmitter2.Listener

  onAny(listener: EventEmitter2.EventAndListener): this
  prependAny(listener: EventEmitter2.EventAndListener): this
  offAny(listener: EventEmitter2.ListenerFn): this
  removeListener(
    event: EventEmitter2.event | EventEmitter2.eventNS,
    listener: EventEmitter2.ListenerFn
  ): this

  removeAllListeners(event?: EventEmitter2.event | EventEmitter2.eventNS): this
  setMaxListeners(n: number): void
  getMaxListeners(): number
  eventNames(
    nsAsArray?: boolean
  ): (EventEmitter2.event | EventEmitter2.eventNS)[]

  listenerCount(event?: EventEmitter2.event | EventEmitter2.eventNS): number
  listeners(
    event?: EventEmitter2.event | EventEmitter2.eventNS
  ): EventEmitter2.ListenerFn[]

  listenersAny(): EventEmitter2.ListenerFn[]
  waitFor(
    event: EventEmitter2.event | EventEmitter2.eventNS,
    timeout?: number
  ): EventEmitter2.CancelablePromise<any[]>

  waitFor(
    event: EventEmitter2.event | EventEmitter2.eventNS,
    filter?: EventEmitter2.WaitForFilter
  ): EventEmitter2.CancelablePromise<any[]>

  waitFor(
    event: EventEmitter2.event | EventEmitter2.eventNS,
    options?: EventEmitter2.WaitForOptions
  ): EventEmitter2.CancelablePromise<any[]>

  listenTo(
    target: EventEmitter2.GeneralEventEmitter,
    events: EventEmitter2.event | EventEmitter2.eventNS,
    options?: EventEmitter2.ListenToOptions
  ): this

  listenTo(
    target: EventEmitter2.GeneralEventEmitter,
    events: EventEmitter2.event[],
    options?: EventEmitter2.ListenToOptions
  ): this

  listenTo(
    target: EventEmitter2.GeneralEventEmitter,
    events: Object,
    options?: EventEmitter2.ListenToOptions
  ): this

  stopListeningTo(
    target?: EventEmitter2.GeneralEventEmitter,
    event?: EventEmitter2.event | EventEmitter2.eventNS
  ): boolean

  hasListeners(event?: string): boolean
  static once(
    emitter: EventEmitter2.EventEmitter2,
    event: EventEmitter2.event | EventEmitter2.eventNS,
    options?: EventEmitter2.OnceOptions
  ): EventEmitter2.CancelablePromise<any[]>

  static defaultMaxListeners: number
}

/**
 * Options for Dito.js graph operations (`insertDitoGraph`,
 * `upsertDitoGraph`, `updateDitoGraph`, `patchDitoGraph`).
 * Controls how nested relation graphs are persisted.
 */
export interface DitoGraphOptions {
  /**
   * Strategy for fetching existing data before upserting.
   *
   * - `'OnlyNeeded'`: Fetch only data needed to determine
   *   changes.
   * - `'OnlyIdentifiers'`: Fetch only IDs for comparison.
   * - `'Everything'`: Fetch all existing graph data.
   */
  fetchStrategy?: 'OnlyNeeded' | 'OnlyIdentifiers' | 'Everything'
  /**
   * Whether to relate existing models found in the graph
   * instead of inserting new ones.
   */
  relate?: boolean
  /** Whether to allow `#ref` references in the graph. */
  allowRefs?: boolean
  /**
   * Whether to insert models that don't exist in the
   * database yet during an upsert.
   */
  insertMissing?: boolean
  /**
   * Whether to unrelate models removed from the graph
   * (sets the foreign key to `null` instead of deleting).
   */
  unrelate?: boolean
  /**
   * Whether to update existing models found in the graph
   * (as opposed to only inserting new ones).
   */
  update?: boolean
  /**
   * Enables special handling for cyclic graph upserts,
   * where self-referential relations are broken into two
   * phases.
   */
  cyclic?: boolean
}

export type QueryParameterOptions = {
  scope?: OrArrayOf<string>
  filter?: OrArrayOf<string>
  /**
   * A range between two numbers. When expressed as a string, the value is split
   * at the ',' character ignoring any spaces on either side. i.e. `'1,2'` and
   * `'1 , 2'`
   */
  range?: [number, number] | string
  limit?: number
  offset?: number
  order?: OrArrayOf<string>
}
export type QueryParameterOptionKey = keyof QueryParameterOptions

export class Service {
  constructor(app: Application<Models>, name?: string)

  /** The application instance. */
  app: Application<Models>
  /** The camelized service name. */
  name: string
  /** The service configuration. */
  config: Record<string, unknown> | null
  /** Whether this service has been initialized. */
  initialized: boolean

  setup(config: Record<string, unknown>): void

  /**
   * Override in sub-classes if the service needs async
   * initialization.
   * @overridable
   */
  initialize(): Promise<void>

  /** @overridable */
  start(): Promise<void>

  /** @overridable */
  stop(): Promise<void>

  get logger(): PinoLogger
}
export type Services = Record<string, Class<Service> | Service>

export class QueryBuilder<
  M extends Model,
  R = M[]
> extends objection.QueryBuilder<M, R> {
  /** Clones the query with scope/filter state. */
  clone(): QueryBuilder<M, R>
  /**
   * Inherits scopes from a parent query.
   * @override
   */
  childQueryOf(
    query: QueryBuilder<Model>,
    options?: Record<string, any>
  ): this

  /**
   * Creates a find-only copy of this query (clears
   * `runAfter` callbacks).
   * @override
   */
  toFindQuery(): QueryBuilder<M, M[]>

  /**
   * Returns true if the query defines normal selects: select(), column(),
   * columns()
   */
  hasNormalSelects(): boolean
  /**
   * Returns true if the query defines special selects:
   * distinct(), count(), countDistinct(), min(), max(),
   * sum(), sumDistinct(), avg(), avgDistinct()
   */
  hasSpecialSelects(): boolean
  withScope(...scopes: string[]): this
  /**
   * Clear all scopes defined with `withScope()` statements,
   * preserving the default scope.
   */
  clearWithScope(): this
  ignoreScope(...scopes: string[]): this
  applyScope(...scopes: string[]): this
  allowScope(...scopes: string[]): void
  clearAllowScope(): void
  applyFilter(name: string, ...args: unknown[]): this
  applyFilter(filters: { [name: string]: unknown[] }): this
  allowFilter(...filters: string[]): void
  /** Omits properties from the query result. */
  omit(...properties: string[]): void
  withGraph(
    expr: objection.RelationExpression<M>,
    options?: objection.GraphOptions & {
      algorithm?: 'fetch' | 'join'
    }
  ): this

  toSQL(): { sql: string; bindings: unknown[] }
  raw: Knex.RawBuilder
  selectRaw: SetReturnType<Knex.RawBuilder, this>
  pluck(key: string): this
  loadDataPath(
    dataPath: string[] | string,
    options?: objection.GraphOptions & {
      algorithm?: 'fetch' | 'join'
    }
  ): this

  upsert(
    data: PartialModelObject<M>,
    options?: {
      update?: boolean
      fetch?: boolean
    }
  ): this

  find(
    query: QueryParameterOptions,
    allowParam?:
      | QueryParameterOptionKey[]
      | {
          [key in QueryParameterOptionKey]?: boolean
        }
  ): this

  patchById(id: Id, data: PartialModelObject<M>): this
  updateById(id: Id, data: PartialModelObject<M>): this
  upsertAndFetch(data: PartialModelObject<M>): this
  insertDitoGraph(
    data: PartialDitoModelGraph<M>,
    options?: DitoGraphOptions
  ): this

  insertDitoGraphAndFetch(
    data: PartialDitoModelGraph<M>,
    options?: DitoGraphOptions
  ): this

  upsertDitoGraph(
    data: PartialDitoModelGraph<M>,
    options?: DitoGraphOptions
  ): this

  upsertDitoGraphAndFetch(
    data: PartialDitoModelGraph<M>,
    options?: DitoGraphOptions
  ): this

  upsertDitoGraphAndFetchById(
    id: Id,
    data: PartialDitoModelGraph<M>,
    options?: DitoGraphOptions
  ): this

  updateDitoGraph(
    data: PartialDitoModelGraph<M>,
    options?: DitoGraphOptions
  ): this

  updateDitoGraphAndFetch(
    data: PartialDitoModelGraph<M>,
    options?: DitoGraphOptions
  ): this

  updateDitoGraphAndFetchById(
    id: Id,
    data: PartialDitoModelGraph<M>,
    options?: DitoGraphOptions
  ): this

  patchDitoGraph(
    data: PartialDitoModelGraph<M>,
    options?: DitoGraphOptions
  ): this

  patchDitoGraphAndFetch(
    data: PartialDitoModelGraph<M>,
    options?: DitoGraphOptions
  ): this

  patchDitoGraphAndFetchById(
    id: Id,
    data: PartialDitoModelGraph<M>,
    options?: DitoGraphOptions
  ): this

  truncate(options?: { restart?: boolean; cascade?: boolean }): this

  ArrayQueryBuilderType: QueryBuilder<M, M[]>
  SingleQueryBuilderType: QueryBuilder<M, M>
  NumberQueryBuilderType: QueryBuilder<M, number>
  PageQueryBuilderType: QueryBuilder<M, objection.Page<M>>
  MaybeSingleQueryBuilderType: QueryBuilder<M, M | undefined>
}
export interface QueryBuilder<M extends Model, R = M[]> extends KnexHelper {}

/**
 * Registry of built-in query parameter handlers (scope,
 * filter, range, limit, offset, order). Used by
 * `QueryBuilder.find()` to apply URL query parameters.
 */
type QueryParameterHandler = (
  query: QueryBuilder<Model>,
  key: string,
  value: unknown
) => void

export const QueryParameters: {
  register(name: string, handler: QueryParameterHandler): void
  register(
    handlers: Record<string, QueryParameterHandler>
  ): void
  get(name: string): QueryParameterHandler | undefined
  has(name: string): boolean
  getAllowed(): Record<string, boolean>
}

export type QueryFilterDefinition = {
  parameters?: Record<string, Schema>
  handler: (
    query: QueryBuilder<Model>,
    property: string,
    ...args: unknown[]
  ) => void
}

/**
 * Registry of built-in query filters (text, date-range).
 * Provides reusable filter implementations that can be
 * referenced by name in model filter definitions.
 */
export const QueryFilters: {
  register(name: string, definition: QueryFilterDefinition): void
  register(
    definitions: Record<string, QueryFilterDefinition>
  ): void
  get(name: string): QueryFilterDefinition | undefined
  has(name: string): boolean
  getAllowed(): Record<string, boolean>
}

export type PartialModelObject<T extends Model> = {
  [K in objection.NonFunctionPropertyNames<T>]?: objection.Defined<
    T[K]
  > extends Model
    ? T[K]
    : objection.Defined<T[K]> extends Array<infer I>
      ? I extends Model
        ? I[]
        : objection.Expression<T[K]>
      : objection.Expression<T[K]>
}

export type PartialDitoModelGraph<M extends Partial<Model>> = {
  [K in objection.NonFunctionPropertyNames<M>]?: objection.Defined<
    M[K]
  > extends Model
    ? PartialDitoModelGraph<M[K]>
    : objection.Defined<M[K]> extends Array<infer I>
      ? I extends Partial<Model>
        ? PartialDitoModelGraph<I>[]
        : M[K]
      : M[K]
}

/* ------------------------------ Start Errors ----------------------------- */
export class ResponseError extends Error {
  constructor()
  constructor(
    error:
      | {
          /** The http status code. */
          status: number
          /** The error message. */
          message?: string
          /**
           * An optional code to be used to distinguish
           * different error instances.
           */
          code?: string | number
        }
      | Error
      | string,
    defaults?: { message?: string; status?: number },
    overrides?: Record<string, unknown>
  )

  status: number
  code?: string | number
  /** Additional error data. */
  data?: Record<string, unknown>
  toJSON(): Record<string, unknown>
}
export class AssetError extends ResponseError {}
export class AuthenticationError extends ResponseError {}
export class AuthorizationError extends ResponseError {}
export class DatabaseError extends ResponseError {
  constructor(
    error:
      | dbErrors.CheckViolationError
      | dbErrors.NotNullViolationError
      | dbErrors.ConstraintViolationError
      | dbErrors.DataError
      | dbErrors.DBError,
    overrides?: Record<string, unknown>
  )
}
export class GraphError extends ResponseError {}
export class ModelError extends ResponseError {
  constructor(model: Class<Model> | Model, error?: unknown)
}
export class NotFoundError extends ResponseError {}
export class NotImplementedError extends ResponseError {}
export class QueryBuilderError extends ResponseError {}
export class RelationError extends ResponseError {}
export class ValidationError extends ResponseError {}
export class ControllerError extends ResponseError {
  constructor(
    controller:
      | Function
      | { constructor: { name: string } },
    error?: unknown
  )
}
/* ------------------------------- End Errors ------------------------------ */

/* ----------------------------- Start Storage ----------------------------- */
/**
 * Base class for file storage backends. Subclasses handle
 * disk and S3 storage.
 */
export class Storage {
  constructor(app: Application<Models>, config: StorageConfig)
  /** The application instance. */
  app: Application<Models>
  /** The storage configuration. */
  config: StorageConfig
  /** The storage name. */
  name: string
  /** The base URL for accessing stored files. */
  url?: string
  /** The file system path for disk storage. */
  path?: string
  /**
   * Upload concurrency limit.
   *
   * @defaultValue `8`
   */
  concurrency: number
  /** Whether this storage has been initialized. */
  initialized: boolean

  /** Sets up the storage backend. */
  setup(): Promise<void>
  /**
   * Override in sub-classes for async initialization.
   * @overridable
   */
  initialize(): Promise<void>
  /**
   * Returns a multer-compatible storage object for handling
   * uploads, or null if no underlying storage is configured.
   */
  getUploadStorage(
    config: multer.Options
  ): multer.StorageEngine | null

  /** Returns a multer upload handler for this storage. */
  getUploadHandler(
    config: multer.Options
  ): Koa.Middleware | null

  /**
   * Generates a unique storage key from a filename,
   * combining a UUID with the file extension.
   */
  getUniqueKey(name: string): string
  /**
   * Checks whether the given URL is allowed as an import
   * source based on `config.allowedImports`.
   */
  isImportSourceAllowed(url: string): boolean
  /** Adds a file to storage. */
  addFile(file: AssetFile, data: Buffer): Promise<AssetFile>
  /** Removes a file from storage. */
  removeFile(file: AssetFile): Promise<void>
  /** Reads a file's contents from storage. */
  readFile(file: AssetFile): Promise<Buffer>
  /** Lists all keys in the storage. */
  listKeys(): Promise<string[]>
  /** Returns the file system path for a file, if any. */
  getFilePath(file: AssetFile): string | undefined
  /** Returns the public URL for a file, if any. */
  getFileUrl(file: AssetFile): string | undefined

  /**
   * Converts a multer upload object to the internal file
   * format.
   */
  convertStorageFile(
    storageFile: StorageFile
  ): AssetFileObject

  /**
   * Converts an array of multer upload objects to the
   * internal file format.
   */
  convertStorageFiles(
    storageFiles: StorageFile[]
  ): AssetFileObject[]

  /**
   * Converts a plain file object into an AssetFile
   * instance in-place on this storage.
   */
  convertAssetFile(file: AssetFileObject): void

  /** Registers a storage subclass by type name. */
  static register(storageClass: Class<Storage>): void
  /** Retrieves a registered storage class by type name. */
  static get(type: string): Class<Storage> | null
}

/**
 * Represents a file asset with metadata. Created from
 * uploaded files or imported URLs.
 */
export class AssetFile {
  constructor(options: {
    name: string
    data: string | Buffer
    type?: string
    width?: number
    height?: number
  })

  /** Unique storage key (UUID + extension). */
  key: string
  /** The original filename. */
  name: string
  /** The file's MIME type, set from options or detected from data. */
  type: string | undefined
  /** File size in bytes. */
  size: number
  /** Image width, if dimensions were read. */
  width?: number
  /** Image height, if dimensions were read. */
  height?: number
  /** The public URL for this file, set after storage upload. */
  url?: string
  /** The file data buffer. */
  get data(): Buffer | null
  /** The storage instance this file belongs to. */
  get storage(): Storage | null
  /** The file system path, if stored on disk. */
  get path(): string | undefined
  /** Reads the file's contents from storage. */
  read(): Promise<Buffer | null>

  /**
   * Converts a plain object into an AssetFile instance
   * in-place on the given storage.
   */
  static convert(
    object: Record<string, any>,
    storage: Storage
  ): void

  /** Creates a new AssetFile from the given options. */
  static create(options: {
    name: string
    data: string | Buffer
    type?: string
    width?: number
    height?: number
  }): AssetFile

  /**
   * Generates a unique storage key for a filename,
   * combining a UUID with the file extension.
   */
  static getUniqueKey(name: string): string
}

export type StorageFile = multer.File & {
  key: string
  width?: number
  height?: number
}

export type AssetFileObject = {
  // The unique key within the storage (uuid/v4 + file extension)
  key: string
  // The original filename
  name: string
  // The file's mime-type
  type: string
  // The amount of bytes consumed by the file
  size: number
  // The public url of the file
  url: string
  // The width of the image if the storage defines `config.readDimensions`
  width?: number
  // The height of the image if the storage defines `config.readDimensions`
  height?: number
}
/* ------------------------------ End Storage ------------------------------ */

/* ------------------------------ Start Mixins ----------------------------- */

export const AssetMixin: <T extends Constructor<{}>>(
  target: T
) => T &
  Constructor<{
    key: string
    file: AssetFileObject
    storage: string
    count: number
    createdAt: Date
    updatedAt: Date
    $parseJson(
      json: object,
      opt?: ModelOptions
    ): object
  }>

export const AssetModel: ReturnType<typeof AssetMixin<typeof Model>>

export const TimeStampedMixin: <T extends Constructor<{}>>(
  target: T
) => T &
  Constructor<{
    createdAt: Date
    updatedAt: Date
  }>

export const TimeStampedModel: ReturnType<typeof TimeStampedMixin<typeof Model>>

export const SessionMixin: <T extends Constructor<{}>>(
  target: T
) => T &
  Constructor<{
    id: string
    value: Record<string, unknown>
  }>

export const SessionModel: ReturnType<typeof SessionMixin<typeof Model>>

export const UserMixin: <T extends Constructor<{}>>(
  target: T
) => T &
  Constructor<{
    username: string
    password: string
    hash: string
    lastLogin?: Date

    $verifyPassword(password: string): Promise<boolean>

    $hasRole(...roles: string[]): boolean

    $hasOwner(owner: InstanceType<typeof UserModel>): boolean

    $isLoggedIn(ctx: KoaContext): boolean
  }> & {
    options?: {
      usernameProperty?: string
      passwordProperty?: string
      /**
       * This option can be used to specify (eager) scopes to be applied when
       * the user is deserialized from the session.
       */
      sessionScope?: OrArrayOf<string>
    }

    /** Registers the passport strategy for this user class. */
    setup(): void

    /** Authenticates a user via Passport. */
    login(
      ctx: KoaContext,
      options?: Record<string, unknown>
    ): Promise<InstanceType<typeof UserModel>>

    sessionQuery(
      trx: Knex.Transaction
    ): QueryBuilder<InstanceType<typeof UserModel>>
  }

export const UserModel: ReturnType<typeof UserMixin<typeof Model>>

/* ------------------------------ End Mixins ----------------------------- */

export type HTTPMethod =
  | 'get'
  | 'head'
  | 'post'
  | 'put'
  | 'delete'
  | 'patch'
  | 'options'
  | 'trace'
  | 'connect'

export interface KnexHelper {
  getDialect(): string | null

  isPostgreSQL(): boolean

  isMySQL(): boolean

  isSQLite(): boolean

  isMsSQL(): boolean
}

export function convertSchema(
  schema: Schema,
  options?: Record<string, any>,
  parentEntry?: Record<string, any> | null
): Record<string, any>

export function convertRelations(
  ownerModelClass: Class<Model>,
  relations: ModelRelations,
  models: Models
): Record<string, any>

export function convertRelation(
  schema: ModelRelation,
  models: Models
): Record<string, any>

export function getRelationClass(
  relation: string | typeof objection.Relation
): typeof objection.Relation | null

export function isThroughRelationClass(
  relationClass: typeof objection.Relation
): boolean

export function addRelationSchemas(
  modelClass: Class<Model>,
  properties: Record<string, ModelProperty>
): void

export type Keyword =
  | SetOptional<Ajv.MacroKeywordDefinition, 'keyword'>
  | SetOptional<Ajv.CodeKeywordDefinition, 'keyword'>
  | SetOptional<Ajv.FuncKeywordDefinition, 'keyword'>
export type Format = Ajv.ValidateFunction | Ajv.FormatDefinition<string>

/** Built-in AJV keyword definitions. */
export const keywords: {
  specificType: Keyword
  primary: Keyword
  foreign: Keyword
  unique: Keyword
  index: Keyword
  computed: Keyword
  hidden: Keyword
  unsigned: Keyword
  _instanceof: Keyword
  validate: Keyword
  validateAsync: Keyword
  relate: Keyword
  range: Keyword
}

/** Built-in AJV format definitions. */
export const formats: {
  empty: Format
  required: Format
}

/** Built-in schema type definitions. */
export const types: {
  asset: Record<string, any>
  color: Record<string, any>
}
export type Id = string | number
export type KoaContext<$State = any> = Koa.ParameterizedContext<
  $State,
  {
    transaction: objection.Transaction
    session: koaSession.ContextSession & { state: { user: any } }
    logger: PinoLogger
  }
>

type LiteralUnion<T extends U, U = string> = T | (U & Record<never, never>)

type OrArrayOf<T> = T[] | T

type OrReadOnly<T> = Readonly<T> | T

type OrPromiseOf<T> = Promise<T> | T

type ModelFromModelController<$ModelController extends ModelController> =
  InstanceType<Exclude<$ModelController['modelClass'], undefined>>

export type SelectModelProperties<T> = {
  [K in SelectModelKeys<T>]: T[K] extends Model
    ? SelectModelProperties<T[K]>
    : T[K]
}

export type SelectModelKeys<T> = Exclude<
  objection.NonFunctionPropertyNames<T>,
  | 'QueryBuilderType' //
  | 'foreignKeyId'
  | `$${string}`
>

/* ---------------------- Extended from Ajv JSON Schema --------------------- */

/**
 * Dito.js JSON Schema type, extending the AJV JSON Schema type with
 * Dito.js-specific validation keywords (`validate`, `validateAsync`,
 * `instanceof`).
 *
 * Used throughout the framework for model property definitions, action
 * parameters, and response schemas.
 *
 * @template T - The TypeScript type that this schema validates against.
 *
 * @example
 * ```ts
 * const schema: Schema<string> = {
 *   type: 'string',
 *   minLength: 1,
 *   validate: ({ data, app }) => typeof data === 'string'
 * }
 * ```
 */
export type Schema<T = any> = JSONSchemaType<T> & {
  // keywords/_validate.js
  validate?: (params: {
    data: unknown
    parentData: object | unknown[]
    rootData: object | unknown[]
    dataPath: string
    parentIndex?: number
    parentKey?: string
    app: Application<Models>
    validator: Validator
    options: unknown
  }) => boolean | void

  // keywords/_validate.js
  validateAsync?: (params: {
    data: unknown
    parentData: object | unknown[]
    rootData: object | unknown[]
    dataPath: string
    parentIndex?: number
    parentKey?: string
    app: Application<Models>
    validator: Validator
    options: unknown
  }) => Promise<boolean | void>

  // keywords/_instanceof.js
  /**
   * Validates whether the value is an instance of at least one of the passed
   * types.
   */
  instanceof?: OrArrayOf<
    | LiteralUnion<
        | 'Object'
        | 'Array'
        | 'Function'
        | 'String'
        | 'Number'
        | 'Boolean'
        | 'Date'
        | 'RegExp'
        | 'Buffer'
      >
    | Function
    | typeof Object
    | typeof Array
    | typeof Function
    | typeof String
    | typeof Number
    | typeof Boolean
    | typeof Date
    | typeof RegExp
    | typeof Buffer
  >
}

declare type StrictNullChecksWrapper<
  Name extends string,
  Type
> = undefined extends null
  ? `strictNullChecks must be true in tsconfig to use ${Name}`
  : Type
declare type UnionToIntersection<U> = (
  U extends any ? (_: U) => void : never
) extends (_: infer I) => void
  ? I
  : never
declare type SomeJSONSchema = UncheckedJSONSchemaType<Known, true>
declare type UncheckedPartialSchema<T> = Partial<
  UncheckedJSONSchemaType<T, true>
>
declare type PartialSchema<T> = StrictNullChecksWrapper<
  'PartialSchema',
  UncheckedPartialSchema<T>
>
declare type JSONType<
  T extends string,
  IsPartial extends boolean
> = IsPartial extends true ? T | undefined : T
interface NumberKeywords {
  minimum?: number
  maximum?: number
  exclusiveMinimum?: number
  exclusiveMaximum?: number
  multipleOf?: number
  format?: string
  range?: [number, number]
}
interface StringKeywords {
  minLength?: number
  maxLength?: number
  pattern?: string
  format?: LiteralUnion<
    | 'date'
    | 'time'
    | 'uri'
    | 'uri-reference'
    | 'uri-template'
    | 'email'
    | 'hostname'
    | 'ipv4'
    | 'ipv6'
    | 'uuid'
    | 'json-pointer'
    | 'relative-json-pointer'
    | 'datetime'
    | 'timestamp'
  >
}

// The first two unions allow arbitrary unions of types
declare type UncheckedJSONSchemaType<T, IsPartial extends boolean> = (
  | {
      anyOf: readonly UncheckedJSONSchemaType<T, IsPartial>[]
    }
  | {
      oneOf: readonly UncheckedJSONSchemaType<T, IsPartial>[]
    }
  | ({
      type: readonly (T extends number
        ? JSONType<'number' | 'integer', IsPartial>
        : T extends string
          ? JSONType<'string', IsPartial>
          : T extends boolean
            ? JSONType<'boolean', IsPartial>
            : never)[]
    } & UnionToIntersection<
      T extends number
        ? NumberKeywords
        : T extends string
          ? StringKeywords
          : T extends boolean
            ? {}
            : never
    >)
  | ((T extends number
      ? {
          type: JSONType<'number' | 'integer', IsPartial>
        } & NumberKeywords
      : T extends string
        ? {
            type: JSONType<
              'string' | 'text' | 'date' | 'datetime' | 'timestamp',
              IsPartial
            >
          } & StringKeywords
        : T extends Date
          ? {
              type: JSONType<'date' | 'datetime' | 'timestamp', IsPartial>
            }
          : T extends boolean
            ? {
                type: JSONType<'boolean', IsPartial>
              }
            : T extends readonly [any, ...any[]]
              ? {
                  type: JSONType<'array', IsPartial>
                  items: {
                    readonly [K in keyof T]-?: UncheckedJSONSchemaType<
                      T[K],
                      false
                    > &
                      Nullable<T[K]>
                  } & {
                    length: T['length']
                  }
                  minItems: T['length']
                } & (
                  | {
                      maxItems: T['length']
                    }
                  | {
                      additionalItems: false
                    }
                )
              : T extends readonly any[]
                ? {
                    type: JSONType<'array', IsPartial>
                    items: UncheckedJSONSchemaType<T[0], false>
                    contains?: UncheckedPartialSchema<T[0]>
                    minItems?: number
                    maxItems?: number
                    minContains?: number
                    maxContains?: number
                    uniqueItems?: true
                    additionalItems?: never
                  }
                : T extends Record<string, any>
                  ? {
                      type: JSONType<'object', IsPartial>
                      additionalProperties?:
                        | boolean
                        | UncheckedJSONSchemaType<T[string], false>
                      unevaluatedProperties?:
                        | boolean
                        | UncheckedJSONSchemaType<T[string], false>
                      properties?: IsPartial extends true
                        ? Partial<UncheckedPropertiesSchema<T>>
                        : UncheckedPropertiesSchema<T>
                      patternProperties?: Record<
                        string,
                        UncheckedJSONSchemaType<T[string], false>
                      >
                      propertyNames?: Omit<
                        UncheckedJSONSchemaType<string, false>,
                        'type'
                      > & {
                        type?: 'string'
                      }
                      dependencies?: {
                        [K in keyof T]?:
                          | Readonly<(keyof T)[]>
                          | UncheckedPartialSchema<T>
                      }
                      dependentRequired?: {
                        [K in keyof T]?: Readonly<(keyof T)[]>
                      }
                      dependentSchemas?: {
                        [K in keyof T]?: UncheckedPartialSchema<T>
                      }
                      minProperties?: number
                      maxProperties?: number
                    } & (IsPartial extends true
                      ? {
                          required: Readonly<(keyof T)[] | boolean>
                        }
                      : [UncheckedRequiredMembers<T>] extends [never]
                        ? {
                            required?:
                              | Readonly<UncheckedRequiredMembers<T>[]>
                              | boolean
                          }
                        : {
                            required:
                              | Readonly<UncheckedRequiredMembers<T>[]>
                              | boolean
                          })
                  : T extends null
                    ? {
                        type: JSONType<'null', IsPartial>
                        nullable: true
                      }
                    : never) & {
      allOf?: Readonly<UncheckedPartialSchema<T>[]>
      anyOf?: Readonly<UncheckedPartialSchema<T>[]>
      oneOf?: Readonly<UncheckedPartialSchema<T>[]>
      if?: UncheckedPartialSchema<T>
      then?: UncheckedPartialSchema<T>
      else?: UncheckedPartialSchema<T>
      not?: UncheckedPartialSchema<T>
    })
) & {
  [keyword: string]: any
  $id?: string
  $ref?: string
  $defs?: Record<string, UncheckedJSONSchemaType<Known, true>>
  definitions?: Record<string, UncheckedJSONSchemaType<Known, true>>
}

declare type JSONSchemaType<T> = StrictNullChecksWrapper<
  'JSONSchemaType',
  UncheckedJSONSchemaType<T, false>
>
declare type Known =
  | {
      [key: string]: Known
    }
  | [Known, ...Known[]]
  | Known[]
  | number
  | string
  | boolean
  | null
declare type UncheckedPropertiesSchema<T> = {
  [K in keyof T]-?:
    | (UncheckedJSONSchemaType<T[K], false> & Nullable<T[K]>)
    | {
        $ref: string
      }
}
declare type PropertiesSchema<T> = StrictNullChecksWrapper<
  'PropertiesSchema',
  UncheckedPropertiesSchema<T>
>
declare type UncheckedRequiredMembers<T> = {
  [K in keyof T]-?: undefined extends T[K] ? never : K
}[keyof T]
declare type RequiredMembers<T> = StrictNullChecksWrapper<
  'RequiredMembers',
  UncheckedRequiredMembers<T>
>
declare type Nullable<T> = undefined extends T
  ? {
      nullable: true
      const?: null
      enum?: Readonly<(T | null)[]>
      default?: T | null
    }
  : {
      const?: T
      enum?: Readonly<T[]>
      default?: T
    }
