/// <reference types="node" />

// Type definitions for Dito.js server
// Project: <https://github.com/ditojs/dito/>

// Export the entire Dito namespace.

import { DateFormat } from '@ditojs/utils'
import * as Ajv from 'ajv'
import * as aws from 'aws-sdk'
import * as dbErrors from 'db-errors'
import * as EventEmitter2 from 'eventemitter2'
import * as Knex from 'knex'
import { KnexSnakeCaseMappersFactory } from 'objection'
import helmet from 'helmet'
import * as Koa from 'koa'
import koaCompress from 'koa-compress'
import koaCors from '@koa/cors'
import koaResponseTime from 'koa-response-time'
import koaLogger from 'koa-logger'
import koaSession from 'koa-session'
import koaPinoLogger from 'koa-pino-logger'
import koaBodyParser from 'koa-bodyparser'
import * as objection from 'objection'
import { SetOptional, Class, SetReturnType, ConditionalKeys } from 'type-fest'

export type Page<$Model extends Model> = {
  total: number
  results: $Model[]
}

export type ApplicationConfig = {
  /**
   * @defaultValue `production`
   */
  env?: 'production' | 'development'
  /**
   * The server configuration
   */
  server?: {
    /**
     * The ip address or hostname used to serve requests
     */
    host?: string
    /**
     * The port to listen on for connections
     */
    port?: string
  }
  /**
   * Logging options
   */
  log?: {
    /**
     * Enable logging requests to console by passing `true` or pick between
     * 'console' for logging to console and 'file' for logging to file
     * @defaultValue `false`
     */
    requests?: boolean | 'console' | 'file'
    /**
     * Whether to output route (Controller) logs
     * @defaultValue `false`
     */
    routes?: boolean
    /**
     * Whether to log relation mappings
     * @defaultValue `false`
     */
    relations?: boolean
    /**
     * Whether to log the json schema generated out of the model property
     * definitions
     * @defaultValue `false`
     */
    schema?: boolean
    /**
     * Whether to log sql queries
     * @defaultValue `false`
     */
    sql?: boolean
    /**
     * Whether to turn off all logging
     */
    silent?: boolean
  }
  api?: ApiConfig
  app?: {
    /**
     * Whether to normalize paths from camel case to kebab case.
     * @see {@link https://github.com/ditojs/dito/blob/master/docs/controllers.md#path-normalization|Path Normalization}
     *
     * @defaultValue `false`
     */
    normalizePaths?: boolean
    /**
     * Whether proxy header fields will be trusted.
     * @defaultValue `false`
     */
    proxy?: Koa['proxy']
    /**
     * Whether to include X-Response-Time header in responses
     * @defaultValue `true`
     */
    responseTime?: boolean | Parameters<typeof koaResponseTime>[0]
    /**
     * Whether to use koa-helmet middleware which provides important security
     * headers to make your app more secure by default.
     * @defaultValue `true`
     * @see https://github.com/venables/koa-helmet
     * @see https://github.com/helmetjs/helmet
     */
    helmet?: boolean | Parameters<typeof helmet>[0]
    logger?:
      | Parameters<typeof koaLogger>[0]
      | Parameters<typeof koaPinoLogger>[0]
    /**
     * Configure body parser.
     * @see https://github.com/koajs/bodyparser#options
     */
    bodyParser?: koaBodyParser.Options
    /**
     * Enable or configure Cross-Origin Resource Sharing (CORS)
     * @defaultValue `true`
     * @see https://github.com/koajs/cors#corsoptions
     */
    cors?: boolean | koaCors.Options
    /**
     * Enable or configure server response compression
     * @defaultValue `true`
     * @see https://github.com/koajs/compress#options
     */
    compress?: boolean | koaCompress.CompressOptions
    /**
     * Enable ETag headers in server responses
     * @defaultValue `true`
     */
    etag?: boolean
    /**
     * @defaultValue `false`
     * @see https://github.com/koajs/session
     */
    session?: boolean | koaSession.opts
    /**
     * Enable passport authentication middleware
     * @defaultValue `false`
     */
    passport?: boolean
    /**
     * Set signed cookie keys.
     * @see https://github.com/koajs/koa/blob/master/docs/api/index.md#appkeys
     */
    keys?: Koa['keys']
  }
  admin?: AdminConfig
  knex?: Knex.Config<any> & {
    /**
     * @defaultValue `false`
     */
    normalizeDbNames?: boolean | Parameters<KnexSnakeCaseMappersFactory>
  }
  /**
   * Service configurations. Pass `false` as a value to disable a service.
   */
  services?: Services
  storages?: StorageConfigs
  assets?: {
    /**
     * @example '1 hr 20 mins'
     * @default `0`
     * @see https://www.npmjs.com/package/parse-duration
     */
    cleanupTimeThreshold?: string | number
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
  metadata: any
  location: string
  etag: string
}

export type StorageConfigs = Record<string, StorageConfig>

export type StorageConfig =
  | {
      type: 's3'
      /**
       * The name of the destination bucket.
       */
      bucket: aws.S3.BucketName
      /**
       *
       * @default 'private'
       */
      acl: LiteralUnion<
        | 'private'
        | 'public-read'
        | 'public-read-write'
        | 'authenticated-read'
        | 'aws-exec-read'
        | 'bucket-owner-read'
        | 'bucket-owner-full-control'
      >
      /**
       * Can be used to specify caching behavior along the request/reply
       * chain.
       *
       * @see http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.9.
       */
      cacheControl?: aws.S3.CacheControl
      /**
       * The type of storage to use for the object.
       *
       * @default 'STANDARD'.
       */
      storageClass?: LiteralUnion<
        | 'STANDARD'
        | 'REDUCED_REDUNDANCY'
        | 'STANDARD_IA'
        | 'ONEZONE_IA'
        | 'INTELLIGENT_TIERING'
        | 'GLACIER'
        | 'DEEP_ARCHIVE'
      >
      /**
       * The server-side encryption algorithm used when storing this object in
       * Amazon S3 (for example, AES256, aws:kms).
       */
      serverSideEncryption?: aws.S3.ServerSideEncryption
      /**
       * If present, specifies the ID of the AWS Key Management Service
       * (AWS KMS) symmetric customer managed customer master key (CMK)
       */
      sseKmsKeyId?: aws.S3.SSEKMSKeyId
      s3: aws.S3.ClientConfiguration
      url?: string
    }
  | {
      type: 'disk'
      path: string
      url?: string
    }

export interface AdminConfig {
  api?: ApiConfig
  build?: {
    /**
     * Path to the admin's src directory. Mandatory when in development
     * mode.
     */
    path: string
    /**
     * @default `false`
     */
    eslint: boolean
  }
  dist?: {
    /**
     * Path to the dist/src/admin directory. Mandatory when in production
     * mode.
     */
    path: string
  }
  /**
   * Whether to use hot reload when in development mode.
   *
   * @default `true`
   */
  hotReload?: boolean
  /**
   * @default Application.config.env or `'production'` when missing
   */
  mode?: 'production' | 'development'
  // TODO: document admin plugins
  plugins?: (string | { id: string; apply: any })[]
  /**
   * Settings accessible on the browser side as `global.dito.settings`.
   */
  settings?: Record<string, any>
}

export interface ApiResource {
  type: string
  path?: string
  parent?: ApiResource
}

export interface ApiConfig {
  /**
   * The base url to use for api requests.
   */
  url?: string
  /**
   * @defaultValue 'en-US'
   */
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
         * @defaultValue `20`
         **/
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
   * prefer to use another path normalization algorithm, they can be defined
   * the api settings passed to the DitoAdmin constructor.
   *
   * @default Defaults to Application.config.app.normalizePaths and then
   * `false` when missing.
   */
  normalizePaths?: boolean
  /**
   * Auth resources
   */
  users?: {
    path?: string
    login?: {
      /**
       * @defaultValue `'login'`
       */
      path?: string
      /**
       * @defaultValue `'post'`
       */
      method?: HTTPVerb
    }
    logout?: {
      /**
       * @defaultValue `'logout'`
       */
      path?: string
      /**
       * @defaultValue `'post'`
       */
      method?: HTTPVerb
    }
    session?: {
      /**
       * @defaultValue `'session'`
       */
      path?: string
      /**
       * @defaultValue `'get'`
       */
      method?: HTTPVerb
    }
  }
  /**
   * Optionally override resource path handlers.
   */
  resources?: Record<string, (resource: ApiResource | string) => string>

  /**
   * Optionally override / extend headers
   * @defaultValue `{
   *   'Content-Type': 'application/json'
   * }`
   */
  headers?: Record<string, string>
}

export type ApplicationControllers = Record<
  string,
  Class<ModelController<Model>> | Class<Controller>
>

export type Models = Record<string, Class<Model>>

export class Application<$Models extends Models> {
  constructor(options: {
    config?: ApplicationConfig
    validator?: Validator
    // TODO: router types
    router?: any
    /**
     * Subscribe to application events. Event names: `'before:start'`,
     * `'after:start'`, `'before:stop'`, `'after:stop'`, `'error'`
     */
    events?: Record<string, (this: Application<$Models>, ...args: []) => void>
    models: $Models
    controllers?: ApplicationControllers
    // TODO: services docs
    services?: Services
  })
  models: $Models
  start(): Promise<void>
  stop(): Promise<void>
  startOrExit(): Promise<void>
  addServices(services: Services): void
  addService(service: Service): void
  addController(controllers: Controller, namespace?: string): void
  addControllers(controllers: ApplicationControllers, namespace?: string): void
  addStorages(storages: StorageConfigs): void
  addStorage(storage: StorageConfig): void
  addModels(models: Models): void
  addModel(model: Class<Model>): void
}
export interface Application<$Models extends Models>
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
   * string with both identifiers separated by '.',
   * e.g.: 'FromModelClass.fromPropertyName'
   */
  from: string
  /**
   * The model and property name to which the relation is to be built, as a
   * string with both identifiers separated by '.',
   * e.g.: 'ToModelClass.toPropertyName'
   */
  to: string
  /**
   * When set to true the join model class and table is to be built automatically,
   * or allows to specify an existing one manually.
   *
   * @see {@link https://github.com/ditojs/dito/blob/master/docs/model-relations.md#join-models-and-tables|Join Models and Tables}
   */
  through?:
    | boolean
    | {
        /**
         * The model and property name or table and column name of an existing
         * join model class or join table from which the through relation is to
         * be built, as a string with both identifiers separated by '.',
         * e.g.: 'FromModelClass.fromPropertyName'
         */
        from: string
        /**
         * The model and property name or table and column name of an existing join
         * model class or join table to which the through relation is to be built,
         * as a string with both identifiers separated by '.',
         * e.g.: 'toModelClass.toPropertyName'
         */
        to: string
        /**
         * List additional columns to be added to the related model.
         *
         * When working with a join model class or table, extra columns from it can
         * be added to the related model, as if it was define on its own table. They
         * then appear as additional properties on the related model.
         */
        extra?: string[]
      }
  /**
   * Controls whether the relation is the inverse of another relation.
   *
   * This information is only required when working with through relations.
   * Without it, Dito.js wouldn't be able to tell which side of the relation is
   * on the left-hand side, and which is on the right-hand side when automatically
   * creating the join model class and table.
   */
  inverse?: boolean
  /**
   * Optionally, a scope can be defined to be applied when loading the
   * relation's models. The scope needs to be defined in the related model
   * class' scopes definitions.
   */
  scope?: string
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
}

/**
 * Primitive type
 * @see https://tools.ietf.org/html/draft-handrews-json-schema-validation-01#section-6.1.1
 */
type SchemaPrimitive = string | number | boolean | null
interface SchemaValueArray
  extends Array<SchemaPrimitive | SchemaValueArray | SchemaValueMap> {}
interface SchemaValueMap {
  [member: string]: SchemaPrimitive | SchemaValueArray | SchemaValueMap
}
export type SchemaValue = SchemaPrimitive | SchemaValueMap | SchemaValueArray
interface SchemaDefinitionMap {
  [member: string]:
    | Schema
    | SchemaType
    | SchemaDefinitionArray
    | SchemaDefinitionMap
}
interface SchemaDefinitionArray
  extends Array<
    Schema | SchemaType | SchemaDefinitionArray | SchemaDefinitionMap
  > {}
export type SchemaDefinition =
  | Schema
  // Shorthand type schema:
  | SchemaType
  // Shorthand array schema:
  | SchemaDefinitionArray
  // Shorthand object schema:
  | SchemaDefinitionMap
export interface Schema {
  $id?: string
  $ref?: string
  $schema?: string
  $comment?: string

  /**
   * @see https://tools.ietf.org/html/draft-handrews-json-schema-validation-01#section-6.1
   */
  type?: OrArrayOf<SchemaType>
  enum?: SchemaValue[]
  const?: SchemaValue

  /**
   * @see https://tools.ietf.org/html/draft-handrews-json-schema-validation-01#section-6.2
   */
  multipleOf?: number
  maximum?: number
  exclusiveMaximum?: number
  minimum?: number
  exclusiveMinimum?: number

  /**
   * @see https://tools.ietf.org/html/draft-handrews-json-schema-validation-01#section-6.3
   */
  maxLength?: number
  minLength?: number
  pattern?: string

  /**
   * @see https://tools.ietf.org/html/draft-handrews-json-schema-validation-01#section-6.4
   */
  items?: OrArrayOf<SchemaDefinition>
  additionalItems?: SchemaDefinition
  maxItems?: number
  minItems?: number
  uniqueItems?: boolean
  contains?: Schema

  /**
   * @see https://tools.ietf.org/html/draft-handrews-json-schema-validation-01#section-6.5
   */
  maxProperties?: number
  minProperties?: number

  required?: boolean | string[]

  properties?: Record<string, SchemaDefinition>
  patternProperties?: Record<string, SchemaDefinition>
  additionalProperties?: boolean | SchemaDefinition
  dependencies?: Record<string, SchemaDefinition | string[]>
  propertyNames?: SchemaDefinition

  /**
   * @see https://tools.ietf.org/html/draft-handrews-json-schema-validation-01#section-6.6
   */
  if?: SchemaDefinition
  then?: SchemaDefinition
  else?: SchemaDefinition

  /**
   * @see https://tools.ietf.org/html/draft-handrews-json-schema-validation-01#section-6.7
   */
  allOf?: SchemaDefinition[]
  anyOf?: SchemaDefinition[]
  oneOf?: SchemaDefinition[]
  not?: SchemaDefinition

  /**
   * The required format of the property.
   *
   * All standard JSON schema formats are supported with the addition of 'datetime'
   * and 'timestamp' which are useful for Dito.js when creating migrations.
   * Additional formats can be registered with a custom validator.
   */
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

  /**
   * @see https://tools.ietf.org/html/draft-handrews-json-schema-validation-01#section-8
   */
  contentMediaType?: string
  contentEncoding?: string

  /**
   * @see https://tools.ietf.org/html/draft-handrews-json-schema-validation-01#section-9
   */
  definitions?: Record<string, SchemaDefinition>

  /**
   * @see https://tools.ietf.org/html/draft-handrews-json-schema-validation-01#section-10
   */
  title?: string
  description?: string
  /**
   * The default value.
   *
   * This impacts both validation as well as migrations: For validation
   * unless when using patch operations, missing properties are replaced
   * with their default values. In migrations, the .defaultTo() method is
   * called for the database column.
   */
  default?: SchemaValue
  readOnly?: boolean
  writeOnly?: boolean
  examples?: SchemaValue

  // keywords/_validate.js
  validate?: (params: {
    data: any
    parentData: object | any[]
    rootData: object | any[]
    dataPath: string
    parentIndex?: number
    parentKey?: string
    app: Application<Models>
    validator: Validator
    options: any
  }) => boolean | void

  // keywords/_validate.js
  validateAsync?: (params: {
    data: any
    parentData: object | any[]
    rootData: object | any[]
    dataPath: string
    parentIndex?: number
    parentKey?: string
    app: Application<Models>
    validator: Validator
    options: any
  }) => Promise<boolean | void>

  /**
   * Validates a property of type 'number' or 'integer' to be in a given
   * range, e.g. a value between 2 and 5: [2, 5]
   */
  range?: [number, number]

  // keywords/_instanceof.js
  /**
   * Validates whether the value is an instance of at least one of the
   * passed types.
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

export interface ModelPropertySchema extends Schema {
  /**
   * Marks the column as the primary key in the database.
   */
  primary?: boolean
  /**
   * Defines if the property is a foreign key.
   *
   * Finds the information about the related model in the relations
   * definition and adds a reference to the related model table in
   * migrations, by calling the .references(columnName).inTable(tableName)
   * method.
   */
  foreign?: boolean
  /**
   * Adds an index to the database column in the migrations, by calling the
   * .index() method.
   */
  index?: boolean
  /**
   * Marks the column as nullable in the migrations, by calling the
   * .nullable() method.
   */
  nullable?: boolean
  /**
   * Adds a unique constraint to the table for the given column in the
   * migrations, by calling the .unique() method. If a string is provided,
   * all columns with the same string value for unique are grouped together
   * in one unique constraint, by calling .unique([column1, column2, …]).
   */
  unique?: boolean | string
  /**
   * Marks the column for a property of type 'integer' to be unsigned in
   * the migrations, by calling the .index() method.calling the .unsigned()
   * method.
   */
  unsigned?: boolean
  /**
   * Marks the property as computed.
   *
   * Computed properties are not present as columns in the database itself.
   * They can be created either by an SQL statement (SELECT … AS), or by a
   * getter accessor defined on the model. Computed properties are set when
   * converting to JSON if not present already, and removed again before
   * data is sent to the database.
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

export type ModelScope<$Model extends Model> = (
  this: $Model,
  query: QueryBuilder<$Model>,
  applyParentScope: (query: QueryBuilder<$Model>) => QueryBuilder<$Model>
) => QueryBuilder<$Model, any> | void

export type ModelScopes<$Model extends Model> = Record<
  string,
  ModelScope<$Model>
>

export type ModelFilterFunction<$Model extends Model> = (
  queryBuilder: QueryBuilder<$Model>,
  ...args: any[]
) => void

export type ModelFilter<$Model extends Model> =
  | ModelFilterFunction<$Model>
  | {
      filter: 'text' | 'date-range'
      properties?: string[]
    }
  | {
      filter: ModelFilterFunction<$Model>
      parameters?: ActionParameter[]
      // TODO: validate type
      validate?: any
    }

export type ModelFilters<$Model extends Model> = Record<
  string,
  ModelFilter<$Model>
>

export interface ModelAsset {
  storage: string
  readImageSize?: boolean
}

export type ModelAssets = Record<string, ModelAsset>

export interface ModelOptions extends objection.ModelOptions {
  graph?: boolean
  async?: boolean
  mutable?: boolean
}

type ModelHookFunction<$Model extends Model> = (
  args: objection.StaticHookArguments<$Model>
) => void
export type ModelHooks<$Model extends Model> = Record<
  `${'before' | 'after'}:${'find' | 'insert' | 'update' | 'delete'}`,
  ModelHookFunction<$Model>
>

export class Model extends objection.Model {
  /**
   * @see {@link https://github.com/ditojs/dito/blob/master/docs/model-properties.md|Model Properties}
   */
  static properties: ModelProperties

  /**
   * @see {@link https://github.com/ditojs/dito/blob/master/docs/model-relations.md|Model Relations}
   */
  static relations: ModelRelations

  /**
   * @see {@link https://github.com/ditojs/dito/blob/master/docs/model-scopes.md|Model Scopes}
   */
  static scopes: ModelScopes<Model>

  /**
   * @see {@link https://github.com/ditojs/dito/blob/master/docs/model-filters.md|Model Filters}
   */
  static filters: ModelFilters<Model>

  static hooks: ModelHooks<Model>

  static assets: ModelAssets

  static getPropertyOrRelationAtDataPath: (dataPath: OrArrayOf<string>) => any

  static count: {
    (column?: objection.ColumnRef, options?: { as: string }): number
    (aliasToColumnDict: Record<string, string | string[]>): number
    (...columns: objection.ColumnRef[]): number
  }

  /**
   * Dito automatically adds an `id` property if a model property with the
   * `primary: true` setting is not already explicitly defined.
   */
  readonly id: Id

  /**
   * Dito automatically adds a `foreignKeyId` property if foreign keys
   * occurring in relations definitions are not explicitly defined in the
   * properties.
   */
  readonly foreignKeyId: Id

  QueryBuilderType: QueryBuilder<this, this[]>

  // Todo: include application settings
  $app: Application<Models>
  $is(model: Model): boolean
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
  ): Promise<$JSON | this>
  $validateGraph(options: ModelOptions & Record<string, any>): Promise<this>

  //   /*-------------------- Start QueryBuilder.mixin(Model) -------------------*/
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
  static pick: StaticQueryBuilderMethod<'pick'>
  static omit: StaticQueryBuilderMethod<'omit'>
  static select: StaticQueryBuilderMethod<'select'>

  static insert: StaticQueryBuilderMethod<'insert'>
  static upsert: StaticQueryBuilderMethod<'upsert'>
  static update: StaticQueryBuilderMethod<'update'>
  static relate: StaticQueryBuilderMethod<'relate'>
  static patch: StaticQueryBuilderMethod<'patch'>

  static truncate: StaticQueryBuilderMethod<'truncate'>
  static delete: StaticQueryBuilderMethod<'delete'>
  static deleteById: StaticQueryBuilderMethod<'deleteById'>

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
  // whereNotInComposite:  QueryBuilder<Model>['whereNotInComposite']
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

  // deprecated methods that are still supported at the moment.
  // TODO: Remove once we move to Objection 3.0

  static eager: StaticQueryBuilderMethod<'eager'>
  static joinEager: StaticQueryBuilderMethod<'joinEager'>
  static naiveEager: StaticQueryBuilderMethod<'naiveEager'>
  static mergeEager: StaticQueryBuilderMethod<'mergeEager'>
  static mergeJoinEager: StaticQueryBuilderMethod<'mergeJoinEager'>
  static mergeNaiveEager: StaticQueryBuilderMethod<'mergeNaiveEager'>
  static clearEager: StaticQueryBuilderMethod<'clearEager'>

  // static scope:  QueryBuilder<Model>['scope']
  // static mergeScope:  QueryBuilder<Model>['mergeScope']
  // static clearScope:  QueryBuilder<Model>['clearScope']

  /*--------------------- End QueryBuilder.mixin(Model) --------------------*/
}

type StaticQueryBuilderMethod<
  K extends ConditionalKeys<QueryBuilder<Model>, (...a: any[]) => any>
> = <$Model extends Class<Model>>(
  ...args: Parameters<QueryBuilder<InstanceType<$Model>>[K]>
) => ReturnType<QueryBuilder<InstanceType<$Model>>[K]>

export interface Model extends EventEmitter {}
export interface Model extends KnexHelper {}

export type ModelClass = Class<Model>

export type ModelRelations = Record<string, ModelRelation>

export type ModelProperty =
  | ModelPropertySchema
  // Shorthand type schema:
  | SchemaType
  // Shorthand array schema:
  | ModelProperty[]
  // Shorthand object schema:
  | {
      type: never
      [k: string]: SchemaDefinition
    }

export type ModelProperties = Record<string, ModelProperty>

export type ControllerAction<$Controller extends Controller> =
  | ControllerActionOptions<$Controller>
  | ControllerActionHandler<$Controller>

export type ControllerActionName =
  | 'find'
  | 'delete'
  | 'insert'
  | 'update'
  | 'patch'
export type AllowedControllerActionName =
  LiteralUnion<ControllerActionName>
export class Controller {
  /**
   * Optionally provide the controller path. A default is deducted from
   * the normalized class name otherwise.
   */
  path?: string
  /**
   * The controller's name. If not provided, it is automatically deducted
   * from the controller class name. If this name ends in 'Controller', that is
   * stripped off the name, so 'GreetingsController' turns into 'Greetings'.
   */
  name?: string
  /**
   * The controller's namespace, which is prepended to path to generate the
   * absolute controller route. Note that it is rare to provide this manually.
   * Usually Dito.js determines the namespace automatically from the controller
   * object passed to the Dito.js application's constructor and its sub-objects.
   *
   * @see {@link https://github.com/ditojs/dito/blob/master/docs/controllers.md#namespaces Namespaces}
   */
  namespace?: string
  /**
   * A list of allowed actions. If provided, only the action names listed here
   * as strings will be mapped to routes, everything else will be omitted.
   */
  allow?: AllowedControllerActionName[]

  /**
   * Authorization
   */
  authorize?: Authorize
  actions?: ControllerActions<this>

  initialize(): void
  setup(isRoot: boolean, setupActionsObject: boolean): void
  // TODO: type reflectActionsObject
  reflectActionsObject(): any
  setupRoute<$ControllerAction extends ControllerAction<any>>(
    verb: HTTPVerb,
    url: string,
    transacted: boolean,
    authorize: Authorize,
    action: $ControllerAction,
    handlers: ((ctx: KoaContext, next: Function) => void)[]
  ): void
  setupActions(type: string): string[]
  setupActionRoute(type: any, action: any): void
  setupAssets(): any
  setupAssetRoute(
    dataPath: OrArrayOf<string>,
    config: any,
    authorize: Authorize
  ): void
  compose(): Koa.Middleware<any, any>
  /**
   * To be overridden by sub-classes.
   */
  getPath(type: string, path: string): string
  getUrl(type: string, path: string): string
  inheritValues(type: string): any
  processValues(values: any): {
    // Create a filtered `values` object that only contains the allowed fields
    values: any
    allow: string[]
    authorize: Authorize
  }
  emitHook(
    type: string,
    handleResult: any,
    ctx: any,
    ...args: any[]
  ): Promise<any>
  processAuthorize(authorize: any): any
  describeAuthorize(authorize: any): string
  handleAuthorization(): Promise<void>
  /**
   *
   * @param str The string to log.
   * @param [indent=0] The amount of levels to indent (in pairs of two spaces).
   */
  log(str: string, indent?: number): void
}
export interface Controller extends EventEmitter {}

export type ActionParameter = Schema & { name: string }

export type ModelControllerActionHandler<
  $ModelController extends ModelController<Model>
> = (this: $ModelController, ctx: KoaContext, ...args: any[]) => any

export type ControllerActionHandler<$Controller extends Controller> = (
  this: $Controller,
  ctx: KoaContext,
  ...args: any[]
) => any

export type ExtractModelProperties<$Model extends Model> = {
  [$Key in SelectModelPropertyKeys<$Model>]: $Model[$Key]
}

export type Extends<$A extends any, $B extends any> = $A extends $B ? 1 : 0

export type SelectModelPropertyKeys<$Model extends Model> = {
  [K in keyof $Model]-?: {
    1: never
    0: K extends 'QueryBuilderType' ? never : K
  }[Extends<$Model[K], Model | Function>]
}[keyof $Model]

export type Authorize =
  | boolean
  | OrArrayOf<LiteralUnion<'$self' | '$owner'>>
  | ((ctx: KoaContext) => OrPromiseOf<Authorize>)

export type BaseControllerActionOptions = {
  /**
   * The HTTP verb (`'get'`, `'post'`, `'put'`, `'delete'` or `'patch'`) to
   * which the action should listen and optionally the path to which it is
   * mapped, defined in relation to the route path of its controller. By
   * default, the normalized method name is used as the action's path, and
   * the `'get'` verb is assigned if none is provided.
   */
  action?: OrArrayOf<LiteralUnion<HTTPVerb>>
  /**
   * Determines whether or how the request is authorized. This value can
   * either be one of the values as described below, an array of them or
   * a function which returns one or more of them.
   *
   * - boolean: `true` if the action should be authorized, `false` otherwise.
   * - '$self': The requested member is checked against `ctx.state.user`
   *   and the action is only authorized if it matches the member.
   * - '$owner': The member is asked if it is owned by `ctx.state.user`
   *   through the optional `Model.$hasOwner()` method.
   * - any string: `ctx.state.user` is checked for this role through
   *   the overridable `UserModel.hasRole()` method.
   */
  authorize?: Authorize
  /**
   * If automatic mapping of Koa.js' `ctx.query` object to method parameters
   * along with their automatic validation is desired, `parameters` can
   * be provided with an array listing each parameter in the same format
   * Dito.js uses for its model property schema, but with added `name` keys
   * for each parameter, in order to do the mapping.
   *
   * @see {@link https://github.com/ditojs/dito/blob/master/docs/model-properties.md Model Properties}
   */
  parameters?:
    | ActionParameter[]
    | [
        ActionParameter[],
        {
          // TODO: validate type
          validate?: any
        }
      ]
  /**
   * Provides a schema for the value returned from the action handler and
   * optionally maps the value to a key inside a returned object when it
   * contains a `name` property.
   *
   * @see {@link https://github.com/ditojs/dito/blob/master/docs/model-properties.md Model Properties}
   */
  returns?: Schema & { name?: string }
  /**
   * The scope(s) to be applied to every query executed through the action.
   *
   * @see {@link https://github.com/ditojs/dito/blob/master/docs/model-scopes.md Model Scopes}
   */
  scope?: string[]
  /**
   * Determines whether queries in the action should be executed within
   * a transaction. Any failure will mean the database will rollback any
   * queries executed to the pre-transaction state.
   */
  transacted?: boolean
}

export type ControllerActionOptions<$Controller extends Controller> =
  BaseControllerActionOptions & {
    handler: ControllerActionHandler<$Controller>
  }

export type ModelControllerActionOptions<
  $ModelController extends ModelController<Model>
> = BaseControllerActionOptions & {
  /**
   * The function to be called when the action route is requested.
   */
  handler: ModelControllerActionHandler<$ModelController>
}

export type MemberActionParameter<M extends Model> =
  | ActionParameter
  | {
      member: boolean

      /**
       * Sets ctx.query.
       */
      query?: Record<string, any>
      /**
       * Adds a FOR UPDATE in PostgreSQL and MySQL during a select statement.
       * FOR UPDATE causes the rows retrieved by the SELECT statement to be locked
       * as though for update. This prevents them from being locked, modified or
       * deleted by other transactions until the current transaction ends.
       *
       * @default `false`
       * @see {@link http://knexjs.org/#Builder-forUpdate}
       * @see {@link https://www.postgresql.org/docs/12/explicit-locking.html#LOCKING-ROWS}
       */
      forUpdate?: boolean
      /**
       * Modify the member query.
       */
      modify?: (query: QueryBuilder<M>) => QueryBuilder<M>
    }

export type ModelControllerActions<
  $ModelController extends ModelController<Model> = ModelController<Model>
> = Record<
  string,
  | ModelControllerActionOptions<$ModelController>
  | ModelControllerActionHandler<$ModelController>
  | AllowedControllerActionName[]
  // NOTE: this is meant only for the 'authorize' key, which due to
  // typescript limitations we cannot type stricly to the key
  | Authorize
>

type ModelControllerMemberAction<
  $ModelController extends ModelController<Model>
> =
  | (
      | (Omit<ModelControllerActionOptions<$ModelController>, 'parameters'> & {
          parameters?:
            | MemberActionParameter<
                modelFromModelController<$ModelController>
              >[]
            | [
                MemberActionParameter<
                  modelFromModelController<$ModelController>
                >[],
                any
              ]
        })
      | ModelControllerActionHandler<$ModelController>
    )
  | AllowedControllerActionName[]

export type ModelControllerMemberActions<
  $ModelController extends ModelController<Model>
> = Record<string, ModelControllerMemberAction<$ModelController>>

export type ControllerActions<$Controller extends Controller> = Record<
  string,
  OrArrayOf<ControllerAction<$Controller>>
>

export class UserModel extends Model {
  static options?: {
    usernameProperty?: string
    passwordProperty?: string
    /**
     * This option can be used to specify (eager) scopes to be applied when
     * the user is deserialized from the session.
     */
    sessionScope?: OrArrayOf<string>
  }
  username: string
  password: string
  hash: string
  lastLogin: Date

  $verifyPassword(password: string): Promise<boolean>

  $hasRole(...roles: string[]): boolean

  $hasOwner(owner: UserModel): boolean

  $isLoggedIn(ctx: KoaContext): boolean

  // TODO: type options
  static login(ctx: KoaContext, options: any): Promise<void>

  static sessionQuery(trx: Knex.Transaction): QueryBuilder<UserModel>
}

export class TimeStampedModel extends Model {
  // static properties: {
  //   createdAt: {
  //     type: 'timestamp'
  //     default: string
  //   }
  //   updatedAt: {
  //     type: 'timestamp'
  //     default: string
  //   }
  // }
  // static scopes: {
  //   timeStamped: ModelScope<Model>
  // }

  createdAt: Date
  updatedAt: Date
}

export class UserController<M extends Model> extends ModelController<M> {}

export class AdminController extends Controller {
  config?: AdminConfig
  /**
   * To be overridden in sub-classes, if the controller needs to install
   * middleware. For normal routes, use `this.app.addRoute()` instead.
   */
  setupKoaWebpack(): Promise<void>
  getVueConfig(): any
  chainWebpack(conf: any): void
  getVuePlugins(): { id: string; apply: (...args: any[]) => any }[]
  getWebpackConfig(): any
}

// TODO: UserMixin

type ModelControllerHookType = 'collection' | 'member'
type ModelControllerHookKeys<
  $Keys extends string,
  $ModelControllerHookType extends string
> = `${'before' | 'after' | '*'}:${$ModelControllerHookType | '*'}:${
  | Exclude<$Keys, 'allow'>
  | ControllerActionName
  | '*'}`
type ModelControllerHook<
  $ModelController extends ModelController<Model> = ModelController<Model>
> = (
  ctx: KoaContext,
  result: objection.Page<modelFromModelController<$ModelController>>
) => any

type HookHandler = () => void

type HookKeysFromController<$ModelController extends ModelController<Model>> =
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
  $ModelController extends ModelController<Model>,
  $Key extends HookKeysFromController<$ModelController>
> = $Key extends `${'before' | 'after' | '*'}:${
  | 'collection'
  | 'member'
  | '*'}:${string}`
  ? (this: $ModelController, ctx: KoaContext, ...args: any[]) => any
  : never

type ModelControllerHooks<
  $ModelController extends ModelController<Model> = ModelController<Model>
> = {
  [$Key in HookKeysFromController<$ModelController>]?: HandlerFromHookKey<
    $ModelController,
    HookKeysFromController<$ModelController>
  >
}

export type ModelControllerScope = OrArrayOf<string>

export class ModelController<$Model extends Model = Model> extends Controller {
  /**
   * The model class that this controller represents. If none is provided,
   * the singularized controller name is used to look up the model class in
   * models registered with the application. As a convention, model controller
   * names should always be provided in pluralized form.
   */
  modelClass?: Class<$Model>
  /**
   * The controller's collection actions. Instead of being provided on the
   * instance level as in the controller base class, they are to be wrapped
   * in a designated object in order to be assigned to the collection.
   *
   * To limit which collection actions will be mapped to routes, supply an
   * array of action names under the `allow` key. Only the action names listed
   * there will be mapped to routes, everything else will be omitted.
   */
  collection?: ModelControllerActions<ModelController<$Model>>
  /**
   * The controller's member actions. Instead of being provided on the instance
   * level as in the controller base class, they are to be wrapped in a
   * designated object in order to be assigned to the member.
   *
   * To limit which member actions will be mapped to routes, supply an array
   * of action names under the `allow` key. Only the action names listed there
   * will be mapped to routes, everything else will be omitted.
   */
  member?: ModelControllerMemberActions<ModelController<$Model>>
  assets?:
    | boolean
    | {
        allow?: OrArrayOf<string>
        authorize: Record<string, OrArrayOf<string>>
      }
  /**
   * When nothing is returned from a hook, the standard action result is used.
   */
  hooks?: ModelControllerHooks<ModelController<$Model>>
  /**
   * Controls whether normal database methods should be used, or their …Graph…
   * counterparts.
   *
   * @see {@link https://github.com/ditojs/dito/blob/master/docs/model-queries.md#graph-methods Model Queries – Graph Methods}
   */
  graph?: boolean
  /**
   * The query parameter(s) allowed to be passed to the default model actions,
   * both on `collection` and `member` level. If none is provided, every
   * supported parameter is allowed.
   *
   * @See {@link https://github.com/ditojs/dito/blob/master/docs/model-queries.md#find-methods) Model Queries – Find Methods}
   */
  allowParam?: OrArrayOf<LiteralUnion<keyof QueryParameterOptions>>
  /**
   * The scope(s) allowed to be requested when passing the 'scope' query
   * parameter to the default model actions. If none is provided, every
   * supported scope is allowed.
   *
   * @see {@link https://github.com/ditojs/dito/blob/master/docs/model-scopes.md Model Scopes}
   */
  allowScope?: boolean | OrArrayOf<string>
  /**
   * The filter(s) allowed to be requested when passing the 'filter' query
   * parameter to the default model actions. If none is provided, every
   * supported filter is allowed.
   *
   * @see {@link https://github.com/ditojs/dito/blob/master/docs/model-filters.md Model Filters}
   */
  allowFilter?: boolean | OrArrayOf<string>
  /**
   * The scope(s) to be applied to every query executed through this controller.
   *
   * @see {@link https://github.com/ditojs/dito/blob/master/docs/model-scopes.md Model Scopes}
   */
  scope?: ModelControllerScope
  query(): QueryBuilder<$Model>
}

export class Validator extends objection.Validator {
  constructor(schema?: {
    options?: {
      /**
       * @defaultValue `false`
       */
      async?: boolean
      /**
       * @defaultValue `false`
       */
      patch?: boolean
      /**
       * @defaultValue `false`
       */
      $data?: boolean
      /**
       * @defaultValue `false`
       */
      $comment?: boolean
      /**
       * @defaultValue `false`
       */
      coerceTypes?: boolean
      /**
       * @defaultValue `false`
       */
      multipleOfPrecision?: boolean
      /**
       * @defaultValue `true`
       */
      ownProperties?: boolean
      /**
       * @defaultValue `false`
       */
      removeAdditional?: boolean
      /**
       * @defaultValue `true`
       */
      uniqueItems?: boolean
      /**
       * @defaultValue `true`
       */
      useDefaults?: boolean
      /**
       * @defaultValue `false`
       */
      verbose?: boolean
    }
    keywords?: Record<string, Keyword>
    formats?: Record<string, Format>
  })
}

// NOTE: Because EventEmitter overrides a number of EventEmitter2 methods with
// changed signatures, we are unable to extend it.
export class EventEmitter {
  static mixin: (target: any) => {}
  constructor(options?: EventEmitter2.ConstructorOptions)
  responds(event: EventEmitter2.event): boolean
  emit(
    event: EventEmitter2.event | EventEmitter2.eventNS,
    ...values: any[]
  ): Promise<any[]>
  on(
    event: EventEmitter2.event | EventEmitter2.eventNS,
    listener: EventEmitter2.ListenerFn
  ): this
  off(
    event: EventEmitter2.event | EventEmitter2.eventNS,
    listener: EventEmitter2.ListenerFn
  ): this
  once(
    event: EventEmitter2.event | EventEmitter2.eventNS,
    listener: EventEmitter2.ListenerFn
  ): this
  setupEmitter(
    events: Record<string, EventEmitter2.ListenerFn>,
    options: EventEmitter2.ConstructorOptions
  ): void

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
  ): Boolean
  hasListeners(event?: String): Boolean
  static once(
    emitter: EventEmitter2.EventEmitter2,
    event: EventEmitter2.event | EventEmitter2.eventNS,
    options?: EventEmitter2.OnceOptions
  ): EventEmitter2.CancelablePromise<any[]>
  static defaultMaxListeners: number
}

export interface DitoGraphOptions {
  fetchStrategy?: 'OnlyNeeded' | 'OnlyIdentifiers' | 'Everything'
  relate?: boolean
  allowRefs?: boolean
  insertMissing?: boolean
  unrelate?: boolean
  update?: boolean
}

export type QueryParameterOptions = {
  scope?: OrArrayOf<string>
  filter?: OrArrayOf<string>
  /**
   * A range between two numbers. When expressed as a string, the value
   * is split at the ',' character ignoring any spaces on either side.
   * i.e. `'1,2'` and `'1 , 2'`
   */
  range?: [number, number] | string
  limit?: number
  offset?: number
  order?: 'asc' | 'desc'
}
export type QueryParameterOptionKey = keyof QueryParameterOptions

export class Service {
  constructor(app: Application<Models>, name?: string)

  setup(config: any): void

  initialize(): void

  start(): Promise<void>

  stop(): Promise<void>
}
export type Services = Record<string, Class<Service> | Service>

export class QueryBuilder<
  M extends Model,
  R = M[]
> extends objection.QueryBuilder<M, R> {
  /**
   * Returns true if the query defines normal selects:
   * select(), column(), columns()
   */
  hasNormalSelects: () => boolean
  /**
   * Returns true if the query defines special selects:
   * distinct(), count(), countDistinct(), min(), max(),
   * sum(), sumDistinct(), avg(), avgDistinct()
   */
  hasSpecialSelects: () => boolean
  withScope: (...scopes: string[]) => this
  /**
   * Clear all scopes defined with `withScope()` statements, preserving the
   * default scope.
   */
  clearWithScope: () => this
  ignoreScope: (...scopes: string[]) => this
  applyScope: (...scopes: string[]) => this
  allowScope: (...scopes: string[]) => void
  clearAllowScope: () => void
  applyFilter: (name: string, ...args: any[]) => this
  allowFilter: (...filters: string[]) => void
  withGraph: (
    expr: objection.RelationExpression<M>,
    options?: objection.GraphOptions & { algorithm: 'fetch' | 'join' }
  ) => this
  toSQL: () => string
  raw: Knex.RawBuilder
  selectRaw: SetReturnType<Knex.RawBuilder, this>
  // TODO: add type for Dito's pluck method, which has a different method
  // signature than the objection one:
  // pluck: <K extends objection.ModelProps<M>>(
  //   key: K
  // ) => QueryBuilder<M, ReflectArrayType<R, M[K]>>
  loadDataPath: (
    dataPath: string[] | string,
    options: objection.GraphOptions & { algorithm: 'fetch' | 'join' }
  ) => this
  upsert: (
    data: PartialModelObject<M>,
    options?: {
      update: boolean
      fetch: boolean
    }
  ) => this
  find: (
    query: QueryParameterOptions,
    allowParam?:
      | QueryParameterOptionKey[]
      | { [key in keyof QueryParameterOptionKey]: boolean }
  ) => this
  patchById: (id: Id, data: PartialModelObject<M>) => this
  updateById: (id: Id, data: PartialModelObject<M>) => this
  upsertAndFetch: (data: PartialModelObject<M>) => this
  insertDitoGraph: (
    data: PartialDitoModelGraph<M>,
    options?: DitoGraphOptions
  ) => this
  insertDitoGraphAndFetch: (
    data: PartialDitoModelGraph<M>,
    options?: DitoGraphOptions
  ) => this
  upsertDitoGraph: (
    data: PartialDitoModelGraph<M>,
    options?: DitoGraphOptions
  ) => this
  upsertDitoGraphAndFetch: (data: any, options?: DitoGraphOptions) => this
  upsertDitoGraphAndFetchById: (
    id: Id,
    data: any,
    options?: DitoGraphOptions
  ) => QueryBuilder<M, M>
  updateDitoGraph: (
    data: PartialDitoModelGraph<M>,
    options?: DitoGraphOptions
  ) => Promise<any>
  updateDitoGraphAndFetch: (
    data: PartialDitoModelGraph<M>,
    options?: DitoGraphOptions
  ) => this
  updateDitoGraphAndFetchById: (
    id: Id,
    data: any,
    options?: DitoGraphOptions
  ) => QueryBuilder<M, M>
  patchDitoGraph: (
    data: PartialDitoModelGraph<M>,
    options?: DitoGraphOptions
  ) => this
  patchDitoGraphAndFetch: (
    data: PartialDitoModelGraph<M>,
    options?: DitoGraphOptions
  ) => this
  patchDitoGraphAndFetchById: (
    id: Id,
    data: PartialDitoModelGraph<M>,
    options?: DitoGraphOptions
  ) => QueryBuilder<M, M>
  // TODO: static mixin(target)

  ArrayQueryBuilderType: QueryBuilder<M, M[]>
  SingleQueryBuilderType: QueryBuilder<M, M>
  NumberQueryBuilderType: QueryBuilder<M, number>
  PageQueryBuilderType: QueryBuilder<M, objection.Page<M>>
}
export interface QueryBuilder<M extends Model, R = M[]> extends KnexHelper {}

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

/*------------------------------ Start Errors -----------------------------*/
export class ResponseError extends Error {
  constructor()
  constructor(
    error:
      | {
          /**
           * The http status code.
           */
          status: number
          /**
           * The error message.
           */
          message?: string
          /**
           * An optional code to be used to distinguish different error instances.
           */
          code?: string | number
        }
      | string,
    defaults?: { message?: string; status?: number }
  )
  status: number
  code?: string | number
}
export class AssetError extends ResponseError {}
export class AuthenticationError extends ResponseError {}
export class AuthorizationError extends ResponseError {}
export class WrappedError extends ResponseError {}
export class DatabaseError extends WrappedError {
  constructor(
    error:
      | dbErrors.CheckViolationError
      | dbErrors.NotNullViolationError
      | dbErrors.ConstraintViolationError
      | dbErrors.DataError
      | dbErrors.DBError
  )
}
export class GraphError extends ResponseError {}
export class ModelError extends ResponseError {
  constructor(model: Class<Model> | Model)
}
export class NotFoundError extends ResponseError {}
export class NotImplementedError extends ResponseError {}
export class QueryBuilderError extends ResponseError {}
export class RelationError extends ResponseError {}
export class ValidationError extends ResponseError {}
export class ControllerError extends ResponseError {
  constructor(controller: { name: string } | { constructor: { name: string } })
}
/*------------------------------- End Errors ------------------------------*/

/*------------------------------ Start Mixins -----------------------------*/
export type Mixin = (
  target: Object,
  propertyName: string,
  propertyDescriptor: PropertyDescriptor
) => void

/**
 * Apply the action mixin to a controller action, in order to
 * determine which HTTP verb (`'get'`, `'post'`, `'put'`, `'delete'` or
 * `'patch'`) the action should listen to and optionally the path to which it
 * is mapped, defined in relation to the route path of its controller. By
 * default, the normalized method name is used as the action's path, and
 * the `'get'` verb is assigned if none is provided.
 */
export const action: (verb: string, path: string) => Mixin

/**
 * Apply the authorize mixin to a controller action, in order to
 * determines whether or how the request is authorized. This value can
 * either be one of the values as described below, an array of them or
 * a function which returns one or more of them.
 *
 * - boolean: `true` if the action should be authorized, `false` otherwise.
 * - '$self': The requested member is checked against `ctx.state.user`
 *   and the action is only authorized if it matches the member.
 * - '$owner': The member is asked if it is owned by `ctx.state.user`
 *   through the optional `Model.$hasOwner()` method.
 * - any string: `ctx.state.user` is checked for this role through
 *   the overridable `UserModel.hasRole()` method.
 */
export const authorize: (
  authorize: (ctx: KoaContext) => void | boolean | OrArrayOf<string>
) => Mixin

/**
 * Apply the parameters mixin to a controller action, in order to
 * apply automatic mapping of Koa.js' `ctx.query` object to method parameters
 * along with their automatic validation. The parameters mixin is supplied
 * with an array listing each parameter in the same format Dito.js uses for
 * its model property schema, but with added `name` keys for each parameter,
 * in order to do the mapping.
 *
 * @see {@link https://github.com/ditojs/dito/blob/master/docs/model-properties.md Model Properties}
 */
export const parameters: (
  ...args:
    | [(ActionParameter | MemberActionParameter<any>)[], any]
    | (ActionParameter | MemberActionParameter<any>)[]
) => Mixin

/**
 * Apply the returns mixin to a controller action, in order to
 * provide a schema for the value returned from the action handler and
 * optionally map the value to a key inside a returned object when it
 * contains a `name` property.
 */
export const returns: (
  returns: Schema & { name?: string },
  options: any
) => Mixin

/**
 * Apply the scope mixin to a controller action, in order to
 * determine the scope(s) to be applied when loading the relation's models.
 * The scope needs to be defined in the related model class' scopes
 * definitions.
 */
export const scope: (...scopes: string[]) => Mixin

/**
 * Apply the transacted mixin to a controller action in order to
 * determine whether queries in the action should be executed within a
 * transaction. Any failure will mean the database will rollback any queries
 * executed to the pre-transaction state.
 */
export const transacted: () => Mixin

/*------------------------------ End Mixins -----------------------------*/

export type HTTPVerb = 'get' | 'post' | 'put' | 'delete' | 'patch'

export interface KnexHelper {
  getDialect(): string

  isPostgreSQL(): boolean

  isMySQL(): boolean

  isSQLite(): boolean

  isMsSQL(): boolean
}

export type Keyword = SetOptional<Ajv.KeywordDefinition, 'keyword'>
export type Format = Ajv.ValidateFunction | Ajv.FormatDefinition<string>
export type Id = string | number
export type KoaContext<$State = any> = Koa.ParameterizedContext<
  $State,
  {
    transaction: objection.Transaction
    session: koaSession.ContextSession & { state: { user: any } }
  }
>

type LiteralUnion<T extends U, U = string> = T | (U & Record<never, never>);

type ReflectArrayType<Source, Target> = Source extends any[] ? Target[] : Target

type OrArrayOf<T> = T[] | T

type OrPromiseOf<T> = Promise<T> | T

type modelFromModelController<$ModelController extends ModelController<Model>> =
  InstanceType<Exclude<$ModelController['modelClass'], undefined>>
