/// <reference types="node" />

// Type definitions for Dito.js server
// Project: <https://github.com/ditojs/dito/>

// Export the entire Dito namespace.

import { Options as CorsOptions } from '@koa/cors'
import * as Ajv from 'ajv'
import * as EventEmitter2 from 'eventemitter2'
import * as Knex from 'knex'
import * as Koa from 'koa'
import { CompressOptions } from 'koa-compress'
import { opts as koaSessionOpts } from 'koa-session'
import * as objection from 'objection'
import { KnexSnakeCaseMappersFactory } from 'objection'
import { DateFormat } from '@ditojs/utils'
import * as aws from 'aws-sdk'
import * as dbErrors from 'db-errors'

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
     * @defaultValue `false`
     */
    proxy?: boolean
    /**
     * Whether to include X-Response-Time header in responses
     * @defaultValue `true`
     */
    responseTime?: boolean
    /**
     * Whether to use koa-helmet middleware which provides important security
     * headers to make your app more secure by default.
     * @defaultValue `true`
     */
    helmet?: boolean
    /**
     * Enable or configure Cross-Origin Resource Sharing (CORS)
     * @defaultValue `true`
     */
    cors?: boolean | CorsOptions
    /**
     * Enable or configure server response compression
     * @defaultValue `true`
     */
    compress?: boolean | CompressOptions
    /**
     * Enable ETag headers in server responses
     * @defaultValue `true`
     */
    etag?: boolean
    /**
     * @defaultValue `false`
     */
    session?: boolean | ({ modelClass: string } & koaSessionOpts)
    /**
     * Enable passport authentication middleware
     * @defaultValue `false`
     */
    passport?: boolean

    // csrf: boolean,            // TODO: Implement

    /**
     * Keys used for session
     */
    keys?: string[]
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

export type StorageConfigs = {
  [k: string]: StorageConfig
}

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
      acl: StringSuggestions<
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
      storageClass?: StringSuggestions<
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
  /**
   * @default Application.config.env or `'production'` when missing
   */
  mode?: 'production' | 'development'
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
   * Settings accessible on the browser side as `global.dito.settings`.
   */
  settings?: {
    [k: string]: any
  }
  /**
   * Whether to use hot reload when in development mode.
   *
   * @default `true`
   */
  hotReload?: boolean
  api?: ApiConfig
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
  resources?: {
    [k: string]: (resource: ApiResource | string) => string
  }

  /**
   * Optionally override / extend headers
   * @defaultValue `{
   *   'Content-Type': 'application/json'
   * }`
   */
  headers?: { [headerKey: string]: string }
}

export type ApplicationControllers = {
  [k: string]:
    | Class<ModelController<Model>>
    | Class<Controller>
    | ApplicationControllers
}

export type Models = {
  [name: string]: Class<Model>
}

export class Application {
  constructor(
    config: ApplicationConfig,
    elements: {
      validator?: Validator
      // TODO: router types
      router?: any
      /**
       * Subscribe to application events. Event names: `'before:start'`,
       * `'after:start'`, `'before:stop'`, `'after:stop'`, `'error'`
       */
      events?: {
        [eventName: string]: (this: Application, ...args: []) => void
      }
      models: Models
      controllers?: ApplicationControllers
      // TODO: services docs
      services?: Services
    }
  )
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

export type SchemaType = StringSuggestions<
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
  relation: StringSuggestions<
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
export type SchemaValue =
  | string
  | number
  | boolean
  | {
      [key: string]: SchemaValue
    }
  | SchemaValue[]
  | null

export type SchemaDefinition =
  | Schema
  // Shorthand type schema:
  | SchemaType
  // Shorthand array schema:
  | SchemaDefinition[]
  // Shorthand object schema:
  | {
      [k: string]: SchemaDefinition
    }
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

  required?: boolean

  properties?: {
    [key: string]: SchemaDefinition
  }
  patternProperties?: {
    [key: string]: SchemaDefinition
  }
  additionalProperties?: SchemaDefinition
  dependencies?: {
    [key: string]: SchemaDefinition | string[]
  }
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
  format?: StringSuggestions<
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
  definitions?: {
    [key: string]: SchemaDefinition
  }

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
    app: Application
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
    app: Application
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
    | StringSuggestions<
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

export type ModelScope<T extends Model> = (
  this: T,
  queryBuilder: QueryBuilder<T>
) => QueryBuilder<T, any> | void

export interface ModelScopes<T extends Model> {
  [k: string]: ModelScope<T>
}

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

export interface ModelFilters<$Model extends Model> {
  [k: string]: ModelFilter<$Model>
}

export interface ModelAsset {
  storage: string
  readImageSize?: boolean
}

export interface ModelAssets {
  [k: string]: ModelAsset
}

export interface ModelOptions extends objection.ModelOptions {
  graph?: boolean
  async?: boolean
  mutable?: boolean
}

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

  static assets: ModelAssets

  static getPropertyOrRelationAtDataPath: (dataPath: OrArrayOf<string>) => any

  static count: {
    (column?: objection.ColumnRef, options?: { as: string }): number
    (aliasToColumnDict: { [alias: string]: string | string[] }): number
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
  $app: Application
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
    options?: ModelOptions & { [k: string]: any }
  ): Promise<$JSON | this>
  $validateGraph(options: ModelOptions & { [k: string]: any }): Promise<this>

  //   /*-------------------- Start QueryBuilder.mixin(Model) -------------------*/
  static first: QueryBuilder<Model>['first']
  static find: QueryBuilder<Model>['find']
  static findOne: QueryBuilder<Model>['findOne']
  static findById: QueryBuilder<Model>['findById']

  static withGraph: QueryBuilder<Model>['withGraph']
  static withGraphFetched: QueryBuilder<Model>['withGraphFetched']
  static withGraphJoined: QueryBuilder<Model>['withGraphJoined']
  static clearWithGraph: QueryBuilder<Model>['clearWithGraph']

  static withScope: QueryBuilder<Model>['withScope']
  static applyScope: QueryBuilder<Model>['applyScope']
  static clearWithScope: QueryBuilder<Model>['clearWithScope']

  static clear: QueryBuilder<Model>['clear']
  static pick: QueryBuilder<Model>['pick']
  static omit: QueryBuilder<Model>['omit']
  static select: QueryBuilder<Model>['select']

  static insert: QueryBuilder<Model>['insert']
  static upsert: QueryBuilder<Model>['upsert']
  static update: QueryBuilder<Model>['update']
  static relate: QueryBuilder<Model>['relate']
  static patch: QueryBuilder<Model>['patch']

  static truncate: QueryBuilder<Model>['truncate']
  static delete: QueryBuilder<Model>['delete']
  static deleteById: QueryBuilder<Model>['deleteById']

  static insertAndFetch: QueryBuilder<Model>['insertAndFetch']
  static upsertAndFetch: QueryBuilder<Model>['upsertAndFetch']
  static updateAndFetch: QueryBuilder<Model>['updateAndFetch']
  static patchAndFetch: QueryBuilder<Model>['patchAndFetch']
  static updateAndFetchById: QueryBuilder<Model>['updateAndFetchById']
  static patchAndFetchById: QueryBuilder<Model>['patchAndFetchById']

  static insertGraph: QueryBuilder<Model>['insertGraph']
  static upsertGraph: QueryBuilder<Model>['upsertGraph']
  static insertGraphAndFetch: QueryBuilder<Model>['insertGraphAndFetch']
  static upsertGraphAndFetch: QueryBuilder<Model>['upsertGraphAndFetch']

  static insertDitoGraph: QueryBuilder<Model>['insertDitoGraph']
  static upsertDitoGraph: QueryBuilder<Model>['upsertDitoGraph']
  static updateDitoGraph: QueryBuilder<Model>['updateDitoGraph']
  static patchDitoGraph: QueryBuilder<Model>['patchDitoGraph']
  static insertDitoGraphAndFetch: QueryBuilder<Model>['insertDitoGraphAndFetch']
  static upsertDitoGraphAndFetch: QueryBuilder<Model>['upsertDitoGraphAndFetch']
  static updateDitoGraphAndFetch: QueryBuilder<Model>['updateDitoGraphAndFetch']
  static patchDitoGraphAndFetch: QueryBuilder<Model>['patchDitoGraphAndFetch']
  static upsertDitoGraphAndFetchById: QueryBuilder<
    Model
  >['upsertDitoGraphAndFetchById']
  static updateDitoGraphAndFetchById: QueryBuilder<
    Model
  >['updateDitoGraphAndFetchById']
  static patchDitoGraphAndFetchById: QueryBuilder<
    Model
  >['patchDitoGraphAndFetchById']

  static where: QueryBuilder<Model>['where']
  static whereNot: QueryBuilder<Model>['whereNot']
  static whereRaw: QueryBuilder<Model>['whereRaw']
  static whereWrapped: QueryBuilder<Model>['whereWrapped']
  static whereExists: QueryBuilder<Model>['whereExists']
  static whereNotExists: QueryBuilder<Model>['whereNotExists']
  static whereIn: QueryBuilder<Model>['whereIn']
  static whereNotIn: QueryBuilder<Model>['whereNotIn']
  static whereNull: QueryBuilder<Model>['whereNull']
  static whereNotNull: QueryBuilder<Model>['whereNotNull']
  static whereBetween: QueryBuilder<Model>['whereBetween']
  static whereNotBetween: QueryBuilder<Model>['whereNotBetween']
  static whereColumn: QueryBuilder<Model>['whereColumn']
  static whereNotColumn: QueryBuilder<Model>['whereNotColumn']
  static whereComposite: QueryBuilder<Model>['whereComposite']
  static whereInComposite: QueryBuilder<Model>['whereInComposite']
  // whereNotInComposite:  QueryBuilder<Model>['whereNotInComposite']
  static whereJsonHasAny: QueryBuilder<Model>['whereJsonHasAny']
  static whereJsonHasAll: QueryBuilder<Model>['whereJsonHasAll']
  static whereJsonIsArray: QueryBuilder<Model>['whereJsonIsArray']
  static whereJsonNotArray: QueryBuilder<Model>['whereJsonNotArray']
  static whereJsonIsObject: QueryBuilder<Model>['whereJsonIsObject']
  static whereJsonNotObject: QueryBuilder<Model>['whereJsonNotObject']
  static whereJsonSubsetOf: QueryBuilder<Model>['whereJsonSubsetOf']
  static whereJsonNotSubsetOf: QueryBuilder<Model>['whereJsonNotSubsetOf']
  static whereJsonSupersetOf: QueryBuilder<Model>['whereJsonSupersetOf']
  static whereJsonNotSupersetOf: QueryBuilder<Model>['whereJsonNotSupersetOf']

  static having: QueryBuilder<Model>['having']
  static havingIn: QueryBuilder<Model>['havingIn']
  static havingNotIn: QueryBuilder<Model>['havingNotIn']
  static havingNull: QueryBuilder<Model>['havingNull']
  static havingNotNull: QueryBuilder<Model>['havingNotNull']
  static havingExists: QueryBuilder<Model>['havingExists']
  static havingNotExists: QueryBuilder<Model>['havingNotExists']
  static havingBetween: QueryBuilder<Model>['havingBetween']
  static havingNotBetween: QueryBuilder<Model>['havingNotBetween']
  static havingRaw: QueryBuilder<Model>['havingRaw']
  static havingWrapped: QueryBuilder<Model>['havingWrapped']

  // deprecated methods that are still supported at the moment.
  // TODO: Remove once we move to Objection 3.0

  static eager: QueryBuilder<Model>['eager']
  static joinEager: QueryBuilder<Model>['joinEager']
  static naiveEager: QueryBuilder<Model>['naiveEager']
  static mergeEager: QueryBuilder<Model>['mergeEager']
  static mergeJoinEager: QueryBuilder<Model>['mergeJoinEager']
  static mergeNaiveEager: QueryBuilder<Model>['mergeNaiveEager']
  static clearEager: QueryBuilder<Model>['clearEager']

  // static scope:  QueryBuilder<Model>['scope']
  // static mergeScope:  QueryBuilder<Model>['mergeScope']
  // static clearScope:  QueryBuilder<Model>['clearScope']

  /*--------------------- End QueryBuilder.mixin(Model) --------------------*/
}
export interface Model extends EventEmitter {}
export interface Model extends KnexHelper {}

export type ModelClass = Class<Model>

export type ModelRelations = {
  [k: string]: ModelRelation
}

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

export type ModelProperties = {
  [k: string]: ModelProperty
}

export type ControllerAction<$Controller extends Controller> =
  | ControllerActionOptions<$Controller>
  | ControllerActionHandler<$Controller>

export type AllowedControllerActionName = StringSuggestions<
  'find' | 'delete' | 'insert' | 'update' | 'patch'
>
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
  processValues(
    values: any
  ): {
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
> = (
  this: $ModelController,
  ctx: KoaContext,
  member: InstanceType<Exclude<$ModelController['modelClass'], undefined>>,
  ...args: any[]
) => any

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

export type AuthorizationOptions =
  | boolean
  | OrArrayOf<StringSuggestions<'$self' | '$owner'>>

export type Authorize =
  | ((ctx: KoaContext) => AuthorizationOptions | Promise<AuthorizationOptions>)
  | AuthorizationOptions

export type BaseControllerActionOptions = {
  /**
   * The HTTP verb (`'get'`, `'post'`, `'put'`, `'delete'` or `'patch'`) to
   * which the action should listen and optionally the path to which it is
   * mapped, defined in relation to the route path of its controller. By
   * default, the normalized method name is used as the action's path, and
   * the `'get'` verb is assigned if none is provided.
   */
  action?: OrArrayOf<StringSuggestions<HTTPVerb>>
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

export type ControllerActionOptions<
  $Controller extends Controller
> = BaseControllerActionOptions & {
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
      query?: {
        [key: string]: any
      }
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
> = {
  [key: string]:
    | ModelControllerActionOptions<$ModelController>
    | ModelControllerActionHandler<$ModelController>
    | AllowedControllerActionName[]
    // NOTE: this is meant only for the 'authorize' key, which due to
    // typescript limitations we cannot type stricly to the key
    | {
        [key: string]: AuthorizationOptions
      }
}

export type ModelControllerMemberActions<
  $ModelController extends ModelController<Model>
> = {
  [key: string]:
    | (
        | (Omit<
            ModelControllerActionOptions<$ModelController>,
            'parameters'
          > & {
            parameters?:
              | MemberActionParameter<
                  InstanceType<
                    Exclude<$ModelController['modelClass'], undefined>
                  >
                >[]
              | [
                  MemberActionParameter<
                    InstanceType<
                      Exclude<$ModelController['modelClass'], undefined>
                    >
                  >[],
                  any
                ]
          })
        | ModelControllerActionHandler<$ModelController>
      )
    | AllowedControllerActionName[]
}

export type ControllerActions<$Controller extends Controller> = {
  [key: string]: OrArrayOf<ControllerAction<$Controller>>
}

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

export class ModelController<$Model extends Model> extends Controller {
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
        authorize: {
          [k: string]: OrArrayOf<string>
        }
      }
  /**
   * When nothing is returned from a hook, the standard action result is used.
   */
  hooks?: {
    [k: string]: (ctx: objection.QueryContext, result: any) => any
  }
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
  allowParam?: OrArrayOf<StringSuggestions<keyof QueryParameterOptions>>
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
  scope?: boolean | OrArrayOf<string>
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
    keywords?: {
      [keyword: string]: Keyword
    }
    formats?: {
      [format: string]: Format
    }
  })
}

// NOTE: Because EventEmitter overrides a number of EventEmitter2 methods with
// changed signatures, we are unable to extend it.
export class EventEmitter {
  static mixin: (target: any) => {}
  constructor(options?: EventEmitter2.ConstructorOptions)
  responds: (event: EventEmitter2.event) => boolean
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
  constructor(app: Application, name?: string)

  setup(config: any): void

  initialize(): void

  start(): Promise<void>

  stop(): Promise<void>
}
export type Services = { [k: string]: Class<Service> | Service }

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
  ignoreScope: () => this
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
  selectRaw: ReplaceReturnType<Knex.RawBuilder, this>
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
  updateById: (id: Id, data: PartialModelObject<M>) => this
  patchById: (id: Id, data: PartialModelObject<M>) => this
  upsertAndFetch: (
    data: PartialModelObject<M>,
    options?: {
      update: boolean
    }
  ) => this
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
  constructor(error: { status: number; message?: string })
  constructor(message: string, defaults?: { status: number })
  status: number
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
export const returns: (returns: Schema & { name?: string }, options: any) => Mixin

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

export type Keyword = Ajv.KeywordDefinition
export type Format = Ajv.FormatValidator | Ajv.FormatDefinition
export type Id = string | number
export type KoaContext<$State = any> = Koa.ParameterizedContext<
  $State,
  { transaction: objection.Transaction }
>

// https://stackoverflow.com/a/56363362/825205
export interface Class<T> extends Function {
  new (...args: any[]): T
}

export type ReplaceReturnType<T extends (...a: any) => any, TNewReturn> = (
  ...a: Parameters<T>
) => TNewReturn

// Allow auto-complete suggestions for string-literal / string unions:
// https://github.com/microsoft/TypeScript/issues/29729#issuecomment-471566609
export type StringSuggestions<T extends U, U = string> =
  | T
  | (U & { _ignore_me?: never })

export type ReflectArrayType<Source, Target> = Source extends any[] ? Target[] : Target

export type OrArrayOf<T> = T[] | T
