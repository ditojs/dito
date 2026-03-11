// Type definitions for Dito.js admin
// Project: <https://github.com/ditojs/dito/>

import {
  DateFormat,
  format as utilsFormat,
  NumberFormat,
  TimeFormat
} from '@ditojs/utils'
import { RequireAtLeastOne, SetOptional } from 'type-fest'
import { Component as VueComponent } from 'vue'
import { Router as VueRouter } from 'vue-router'

declare global {
  const dito: DitoGlobal
}

export default DitoAdmin
export interface DitoGlobal {
  /** Global API configuration shared across the admin. */
  api?: ApiConfig
  /** Base URL path for the admin application. */
  base?: string
  /** Arbitrary settings accessible via `dito.settings`. */
  settings?: Record<string, any>
}

/**
 * A function that performs an HTTP request and returns the parsed
 * response. Used by the admin to communicate with the Dito.js
 * server API.
 *
 * @template T The expected type of the response data.
 */
export type RequestMethod = <T>(options: {
  /** The URL to send the request to. */
  url: string
  /**
   * The HTTP method to use.
   *
   * @default 'get'
   */
  method?: HTTPMethod
  /** Request body payload. */
  data?: unknown
  /** URL query parameters. */
  query?:
    | Record<string, string | number | (string | number)[]>
    | [string, string | number][]
    | null
  /** Additional HTTP headers to include. */
  headers?: Record<string, string> | null
  /** Abort signal to cancel the request. */
  signal?: AbortSignal | null
}) => Promise<RequestMethodResponse<T>>

/**
 * The response returned by {@link RequestMethod}, extending the
 * standard `Response` with a parsed `data` property.
 *
 * @template T The type of the parsed response data.
 */
export type RequestMethodResponse<T> = Response & { data: T }

/**
 * Describes a resource in the Dito.js server API. Resources can be
 * nested via {@link ApiResource.parent} to build hierarchical API
 * paths. The {@link ApiResource.type} determines how the path is
 * constructed:
 *
 * - `'collection'` — uses `path` directly (e.g. `users`)
 * - `'member'` — appends `id` to the path (e.g. `users/5`)
 * - `'upload'` — builds an upload path under the parent collection
 *   (e.g. `users/upload/avatar`)
 *
 * Paths are built recursively through the `parent` chain, so a
 * member nested under a collection produces paths like
 * `users/1/comments/3`.
 */
export interface ApiResource {
  /**
   * Determines how the resource path is constructed.
   *
   * @see {@link ApiResource} for the path-building rules per type.
   */
  type: LiteralUnion<'collection' | 'member' | 'upload'>
  /**
   * URL path segment for this resource. If it starts with `/`, it is
   * treated as absolute and parent nesting is skipped. Otherwise it
   * is appended to the parent's resolved path.
   */
  path?: string
  /** HTTP method for the resource request. */
  method?: HTTPMethod
  /**
   * Identifier of a specific resource item, used when
   * {@link ApiResource.type} is `'member'` to append the id to the
   * resolved path.
   */
  id?: string | number
  /**
   * Parent resource for nested API paths. The parent's path is
   * resolved first and this resource's path is appended to it,
   * enabling hierarchical URLs.
   */
  parent?: ApiResource
  /** Query parameters appended to the request URL. */
  query?: Record<string, string | number | (string | number)[]>
}

/**
 * Configuration for the admin's API layer. Merged from three
 * sources in order of priority: the constructor `api` parameter,
 * `dito.api` (passed from `AdminController` on the server), and
 * built-in defaults.
 */
export interface ApiConfig {
  /**
   * The base path for the admin UI, as passed from
   * `AdminController`.
   *
   * @defaultValue `'/'`
   */
  base?: string
  /**
   * The base URL prepended to all API requests. Relative request
   * URLs are combined with this value.
   */
  url?: string
  /**
   * Locale used for date, time, and number formatting throughout
   * the admin.
   *
   * @defaultValue `'en-US'`
   */
  locale?: string
  /**
   * Default format options for numbers, dates, and times. Merged
   * with the built-in `defaultFormats` from `@ditojs/utils`.
   * Individual schemas can override these on a per-component basis.
   */
  formats?: {
    number?: NumberFormat
    date?: DateFormat
    time?: TimeFormat
  }
  /**
   * The function used to perform HTTP requests. Defaults to a
   * built-in `fetch` wrapper that applies {@link ApiConfig.headers},
   * {@link ApiConfig.cors}, and {@link ApiConfig.getApiUrl}
   * automatically for API URLs.
   */
  request?: RequestMethod
  /**
   * Controls admin notification toasts. Set to `false` to disable
   * all notifications, or provide an object to customize display
   * duration.
   *
   * @defaultValue `true`
   */
  notifications?:
    | boolean
    | {
        /**
         * Milliseconds per character used to calculate notification
         * display duration. The formula is:
         * `(40 + text.length + title.length) * durationFactor`.
         *
         * @defaultValue `20`
         */
        durationFactor: number
      }
  /**
   * CORS settings applied to API requests (where
   * {@link ApiConfig.isApiUrl} returns `true`).
   */
  cors?: {
    /**
     * Enables cross-site requests with credentials
     * (`credentials: 'include'`).
     */
    credentials: boolean
  }
  /**
   * When `true`, sets {@link ApiConfig.normalizePath} to
   * `hyphenate` (camelCase to kebab-case) and
   * {@link ApiConfig.denormalizePath} to `camelize` (kebab-case to
   * camelCase). Used for automatic path conversion between JS
   * naming conventions and URL paths.
   *
   * @defaultValue Inherits from
   * `Application.config.app.normalizePaths`, falling back
   * to `false`.
   */
  normalizePaths?: boolean
  /**
   * Converts a camelCase path segment to its URL form. Applied
   * when building schema routes and upload paths.
   *
   * @defaultValue `hyphenate` when {@link ApiConfig.normalizePaths}
   * is `true`, otherwise an identity function.
   */
  normalizePath?: (path: string) => string
  /**
   * Converts a URL path segment back to its camelCase form.
   *
   * @defaultValue `camelize` when {@link ApiConfig.normalizePaths}
   * is `true`, otherwise an identity function.
   */
  denormalizePath?: (path: string) => string
  /**
   * Authentication resource configuration. The `path` defines the
   * user collection endpoint, and `login`, `logout`, and `session`
   * are nested as child resources under it (e.g. `users/login`).
   */
  users?: {
    /** The collection path for the user model. */
    path: string
    /** Login endpoint. */
    login?: {
      /**
       * @defaultValue `'login'`
       */
      path?: string
      /**
       * @defaultValue `'post'`
       */
      method?: HTTPMethod
    }
    /** Logout endpoint. */
    logout?: {
      /**
       * @defaultValue `'logout'`
       */
      path?: string
      /**
       * @defaultValue `'post'`
       */
      method?: HTTPMethod
    }
    /**
     * Session endpoint for checking an existing authenticated
     * session on page load.
     */
    session?: {
      /**
       * @defaultValue `'session'`
       */
      path?: string
      /**
       * @defaultValue `'get'`
       */
      method?: HTTPMethod
    }
  }
  /**
   * Custom resource path handlers, keyed by resource type. Merged
   * with the built-in handlers (`any`, `default`, `collection`,
   * `member`, `upload`). Each handler receives an
   * {@link ApiResource} and returns the resolved path string.
   */
  resources?: Record<string, (resource: ApiResource | string) => string>

  /**
   * HTTP headers included in all API requests (where
   * {@link ApiConfig.isApiUrl} returns `true`). Merged with the
   * default `Content-Type: application/json` header, and can be
   * further overridden per-request.
   *
   * @defaultValue `{ 'Content-Type': 'application/json' }`
   */
  headers?: Record<string, string>

  /**
   * Returns the full API URL for a given request configuration.
   * Prepends {@link ApiConfig.url} to relative URLs and appends
   * formatted query parameters.
   */
  getApiUrl?: (options: {
    url: string
    query?:
      | Record<string, string | number | (string | number)[]>
      | [string, string | number][]
      | null
  }) => string

  /**
   * Returns `true` if the given URL is an API URL. A URL is
   * considered an API URL if it is not absolute or if it starts
   * with {@link ApiConfig.url}. When `true`, the request includes
   * {@link ApiConfig.headers} and respects
   * {@link ApiConfig.cors} settings.
   */
  isApiUrl?: (url: string) => boolean

  /**
   * Default schema property values per component type. During
   * schema processing, defaults for a matching type are applied
   * to the schema: top-level properties that are `undefined` are
   * set directly, while existing object properties are
   * deep-merged. When a function is provided, it receives the
   * schema and can return defaults or modify it directly.
   *
   * @example
   * ```js
   * defaults: {
   *   multiselect: {
   *     selectable: true
   *   }
   * }
   * ```
   */
  defaults?: Record<
    string,
    | Record<string, any>
    | ((schema: Component) => Record<string, any> | void)
  >
}

export interface BaseSchema<$Item>
  extends SchemaDitoMixin<$Item>,
    SchemaTypeMixin<$Item> {
  /**
   * Value used when the field's key is absent from the
   * data object.
   */
  default?: OrItemAccessor<$Item>
  /**
   * Computes and sets the field value reactively. If
   * the callback returns `undefined`, the current value
   * is preserved.
   */
  compute?: ItemAccessor<$Item>
  /**
   * Additional reactive data properties merged into
   * the component's data scope.
   */
  data?: OrItemAccessor<$Item, {}, Record<string, any>>
  /**
   * Custom CSS class(es) added to the component's container
   * element. Accepts a string or an object of class-boolean
   * pairs.
   */
  class?: string | Record<string, boolean>
  /**
   * Whether the component type omits surrounding spacing.
   *
   * @internal Set as a static option on component type
   * definitions, not configured in schemas.
   */
  omitSpacing?: boolean
  /**
   * Forces a layout line break before, after, or on
   * both sides of the component.
   */
  break?: 'before' | 'after' | 'both'
}

export interface SchemaDitoMixin<$Item> {
  /**
   * Only displays the component if the schema accessor returns `true`
   */
  if?: OrItemAccessor<$Item, {}, boolean>

  /**
   * Specifies validations rules to add, remove (by setting to `undefined`) or
   * change before value validation occurs. Rule changes do not influence how
   * the component is rendered.
   */
  rules?: {
    /** Override whether the field is required. */
    required?: boolean
  }
}

/**
 * Return false to mark event as handled and stop it from propagating to parent
 * schemas.
 */
export type ItemEventHandler<$Item = any> = (
  itemParams: DitoContext<$Item>
) => void | false

export type OpenEventHandler<$Item = any> = (
  itemParams: DitoContext<$Item> & { open: boolean }
) => void | false

export type ErrorEventHandler<$Item = any> = (
  itemParams: DitoContext<$Item> & { error: Error }
) => void | false

/**
 * Event handlers shared by component schemas, views,
 * and forms.
 */
export interface SchemaEvents<$Item = any> {
  /**
   * Fires when the schema's component tree is set up.
   * @see {@link SchemaFields.onInitialize}
   */
  initialize?: ItemEventHandler<$Item>
  /**
   * Fires when the schema component is unmounted.
   * @see {@link SchemaFields.onDestroy}
   */
  destroy?: ItemEventHandler<$Item>
  /**
   * Fires after data has been fetched from the API.
   * @see {@link SchemaFields.onLoad}
   */
  load?: ItemEventHandler<$Item>
  /**
   * Fires after a value change is committed.
   * @see {@link SchemaFields.onChange}
   */
  change?: ItemEventHandler<$Item>
}

export interface SchemaOpen<$Item = any> {
  /**
   * Called when a collapsible schema section is
   * toggled open or closed. The `open` property on
   * the context indicates the new state.
   */
  onOpen?: OpenEventHandler<$Item>
}

export interface SchemaTypeMixin<$Item> extends SchemaFields<$Item> {
  /**
   * The label of the component.
   *
   * @defaultValue The title-cased component name.
   */
  label?: OrItemAccessor<$Item, {}, string | boolean>

  /**
   * The width of the component. The value can either be given in percent
   * (e.g. '20%' or a value between 0 and 1), or as 'auto' to have the width
   * depend on its contents or as 'fill' to fill left over space. A line will
   * contain multiple components until their widths exceed 100%.
   */
  width?: OrItemAccessor<
    $Item,
    {},
    'auto' | 'fill' | `${number}%` | `${number}/${number}` | number
  >

  /**
   * Whether the component is visible.
   *
   * @defaultValue `true`
   */
  visible?: OrItemAccessor<$Item, {}, boolean>

  /**
   * Whether to exclude the field's value from the processed data
   * sent to the server.
   *
   * @defaultValue `false`
   */
  exclude?: OrItemAccessor<$Item, {}, boolean>

  /**
   * Whether the field is required.
   * @defaultValue `false`
   */
  required?: OrItemAccessor<$Item, {}, boolean>

  /**
   * Whether the value is read only.
   *
   * @defaultValue `false`
   */
  readonly?: OrItemAccessor<$Item, {}, boolean>

  /**
   * Whether to autofocus the field.
   * @defaultValue `false`
   */
  autofocus?: OrItemAccessor<$Item, {}, boolean>

  /**
   * Whether the field can be cleared.
   * @defaultValue `false`
   */
  clearable?: OrItemAccessor<$Item, {}, boolean>

  /**
   * Specifies a short hint intended to aid the user
   * with data entry when the input has no value. Set
   * to `false` to disable the placeholder, or `true`
   * to use the component's auto-generated default
   * (e.g. multiselect generates one based on
   * `searchable` and `taggable`).
   */
  placeholder?: OrItemAccessor<$Item, {}, string | boolean>

  /**
   * Info text displayed near the component label.
   */
  info?: OrItemAccessor<$Item, {}, string>

  /**
   * The maximum allowed length of the input value.
   */
  maxLength?: OrItemAccessor<$Item, {}, number>

  /**
   * Whether the input field should have autocomplete enabled.
   */
  autocomplete?: OrItemAccessor<$Item, {}, 'on' | 'off'>

  /**
   * Specifies a function which transforms the stored
   * value into a display format before it is passed
   * to the component for rendering.
   */
  format?: ItemAccessor<$Item, {}, any>
  /**
   * Whether the component is disabled.
   *
   * @defaultValue `false`
   */
  disabled?: OrItemAccessor<$Item, {}, boolean>

  /**
   * Specifies a function which parses the component
   * value when it changes, transforming the raw
   * input before it is stored.
   */
  parse?: ItemAccessor<$Item, {}>

  /**
   * Specifies a function which processes the field value after
   * type-specific processing but before exclusion, allowing
   * custom value transformation before sending data to the
   * server. Can also modify sibling data via `processedItem`
   * in the context, even when `exclude` is `true`.
   */
  process?: ItemAccessor<$Item, {}>

  /**
   * The property key used to identify the field in data objects.
   * Auto-assigned from the component's key if not provided.
   */
  name?: string

  /**
   * Called when the input element receives focus.
   */
  onFocus?: ItemEventHandler<$Item>
  /**
   * Called when the input element loses focus.
   */
  onBlur?: ItemEventHandler<$Item>
  /**
   * Called on every keystroke or value modification. Unlike
   * {@link BaseSchema.onChange}, fires synchronously.
   */
  onInput?: ItemEventHandler<$Item>
  /**
   * Grouped event handlers, equivalent to the `on[A-Z]`-style
   * callbacks on the schema (e.g. {@link BaseSchema.onFocus}).
   *
   * @see {@link SchemaFields.onInitialize} and other `on`-
   * prefixed properties for per-event documentation.
   */
  events?: SchemaEvents<$Item> & {
    /** @see {@link BaseSchema.onFocus} */
    focus?: ItemEventHandler<$Item>
    /** @see {@link BaseSchema.onBlur} */
    blur?: ItemEventHandler<$Item>
    /** @see {@link BaseSchema.onInput} */
    input?: ItemEventHandler<$Item>
  }
}

export interface SchemaSourceMixin<$Item> {
  /**
   * The form schema used for editing items.
   */
  form?: ResolvableForm<$Item>
  /**
   * Multiple form schemas keyed by item type, for
   * sources with polymorphic content.
   */
  forms?: {
    [key: string]: ResolvableForm
  }
  /**
   * The label given to items. If no itemLabel is given,
   * the default is the 'name' property of the item,
   * followed by the label of the form (plus item id)
   * and other defaults.
   */
  itemLabel?:
    | OrItemAccessor<
        $Item,
        {},
        | string
        | {
            text?: string
            prefix?: string
            suffix?: string
          }
      >
    | false
  /**
   * The columns displayed in the table. Can be an array
   * of property names or an object with column schemas.
   */
  columns?: Columns<$Item> | (keyof $Item)[]
  /**
   * Scope names as defined on the model. When set, the
   * admin renders scope buttons allowing the user to
   * switch between them while editing.
   */
  scopes?:
    | string[]
    | {
        [scopeName: string]:
          | {
              label?: string
              hint?: string
              defaultScope?: boolean
            }
          | string
      }
  /**
   * Use a Vue component to render the items.
   */
  component?: Resolvable<VueComponent>
  /**
   * Custom render function for items.
   */
  render?: ItemAccessor<$Item, {}, string>
  /**
   * Maximum nesting depth for nested sources.
   *
   * @defaultValue `1`
   */
  maxDepth?: number
  /** Buttons for the source. */
  buttons?: Buttons<$Item>
  /**
   * Whether to wrap primitive values in objects.
   */
  wrapPrimitives?: boolean
  /**
   * URL path for the source items.
   */
  path?: string
  /**
   * The property name used as the item's unique
   * identifier.
   *
   * @defaultValue `'id'`
   */
  idKey?: string
  /**
   * Whether the data is stored under its own key in the parent item.
   * When `true`, an "address" source stores data at `item.address`.
   * When `false`, its fields are stored directly on `item`.
   *
   * @defaultValue `true`
   */
  nested?: boolean
  /**
   * Inline form components. When defined, items are
   * edited inline rather than navigating to a separate
   * page.
   */
  components?: Components<$Item>
  /**
   * The number of items displayed per page. When not provided, all items are
   * rendered.
   *
   * @defaultValue `false`
   */
  paginate?: OrItemAccessor<$Item, {}, number>
  /**
   * The default page number for paginated sources.
   */
  page?: number
  /**
   * Whether to display items inline in an expandable form rather
   * than navigating to a separate page. Also implicitly `true`
   * when `components` is defined on the schema.
   *
   * @defaultValue `false`
   */
  inlined?: OrItemAccessor<$Item, {}, boolean>
  /**
   * Whether to add a button to create list items.
   *
   * @defaultValue `false`
   */
  creatable?: OrItemAccessor<$Item, {}, boolean | { label: string }>
  /**
   * Whether to add edit buttons next to the list items.
   *
   * @defaultValue `false`
   */
  editable?: OrItemAccessor<$Item, {}, boolean | { label: string }>
  /**
   * Whether to add delete buttons next to the list items.
   *
   * @defaultValue `false`
   */
  deletable?: OrItemAccessor<$Item, {}, boolean | { label: string }>
  /**
   * The column used for the order resulting from dragging around list entries
   * when the `draggable` property of the list schema is set to `true`.
   */
  orderKey?: string
  /**
   * Whether the items can be reordered by the user. Set the `orderKey` property
   * if you want the order to be persisted into a column.
   * @defaultValue `false`
   */
  draggable?: OrItemAccessor<$Item, {}, boolean>
  /**
   * Whether an inlined form is collapsible.
   * @defaultValue `null`
   */
  collapsible?: OrItemAccessor<$Item, {}, boolean | null>
  /** Whether the inlined form is collapsed. */
  collapsed?: OrItemAccessor<$Item, {}, boolean>
  /**
   * Default sort configuration.
   */
  defaultSort?:
    | string
    | { key: string; order: 'asc' | 'desc' }
  /**
   * Default scope name as defined on the model.
   */
  defaultScope?: string
  /**
   * Resource configuration for loading data from the
   * API.
   */
  resource?: Resource
  /**
   * The name of a view to reference for form schemas and
   * editing navigation.
   */
  view?: string
}

export type SchemaOptionsOption<$Value> =
  | { label: string; value: $Value }
  | $Value
export type SchemaOptions<$Item, $Option = any> =
  | SchemaOptionsOption<$Option>[]
  | {
      /**
       * The function which is called to load the options.
       * Can be a double-function: the outer function
       * receives the `DitoContext` and returns an inner
       * function that is called to fetch the actual data,
       * enabling reactive dependency tracking.
       */
      data?: OrItemAccessor<
        $Item,
        {},
        OrItemAccessor<$Item, {}, OrPromiseOf<SchemaOptionsOption<$Option>[]>>
      >
      /**
       * Either the key of the option property which should be treated as
       * the option label or a function returning the option label.
       *
       * @defaultValue `'label'` when no label is supplied and the options are
       * objects
       */
      label?: keyof $Option | ItemAccessor<$Item, { option: $Option }, string>
      /**
       * Either the key of the option property which should be
       * treated as the value or a function returning the option
       * value.
       *
       * @defaultValue `'id'` when `relate` is set, otherwise
       * `'value'` when the options are objects.
       */
      value?: keyof $Option | ItemAccessor<$Item, { option: $Option }>
      /**
       * The key of the option property which should used to group the options.
       */
      groupBy?: keyof $Option
      /**
       * Custom equality function for comparing options.
       */
      equals?: (
        a: $Option,
        b: $Option
      ) => boolean
      /**
       * Relative path to resolve options from data
       * within the same form. Uses filesystem-style
       * path notation: `..` navigates up, `/` navigates
       * into nested properties.
       *
       * @example Sibling data
       * ```js
       * // Form data: { tags: [...], selectedTags: [...] }
       * selectedTags: {
       *   type: 'checkboxes',
       *   relate: true,
       *   options: { dataPath: '../tags' }
       * }
       * ```
       *
       * @example Parent data
       * ```js
       * // Root data: { categories: [...], items: [{ category: ... }] }
       * // Inside a form for items:
       * category: {
       *   type: 'select',
       *   options: { dataPath: '../../../categories' }
       * }
       * ```
       */
      dataPath?: string
    }

export interface SchemaOptionsMixin<$Item, $Option = any> {
  /** The available options for selection. */
  options?: SchemaOptions<$Item, $Option>
  /**
   * When true, treats options as related objects. The
   * full object is used during editing, but only the
   * `id` reference is stored on save.
   */
  relate?: boolean
  /**
   * The property key used as the identifier when
   * relating options. Only relevant when `relate` is
   * `true`.
   *
   * @defaultValue `'id'`
   *
   * Note: Only `'id'` is currently supported.
   */
  relateBy?: string
  /**
   * The key of the option property which should be used to
   * group the options.
   */
  groupBy?: OrItemAccessor<$Item, {}, string>
  /**
   * When defined, a search input field will be added to allow
   * searching for specific options.
   */
  search?:
    | ItemAccessor<$Item, { query: string }, OrPromiseOf<$Option[]>>
    | {
        /**
         * Filters options based on the search `query`
         * available in the context. Returns matching
         * options, optionally as a promise.
         */
        filter?: ItemAccessor<$Item, { query: string }, OrPromiseOf<$Option[]>>
        /**
         * Debounce config for the filter. Delays
         * invocation until input pauses.
         */
        debounce?:
          | number
          | {
              delay: number
              immediate?: boolean
            }
      }
  /**
   * Whether the selected option can be edited by navigating
   * to it.
   */
  editable?: OrItemAccessor<$Item, {}, boolean>
  /**
   * The name of a view to reference for form schemas and
   * editing navigation.
   */
  view?: string
}

export interface SchemaNumberMixin<$Item> {
  /**
   * The minimum value.
   */
  min?: OrItemAccessor<$Item, {}, number>

  /**
   * The maximum value.
   */
  max?: OrItemAccessor<$Item, {}, number>

  /**
   * The minimum and maximum value.
   */
  range?: OrItemAccessor<$Item, {}, [number, number]>
  /**
   * When defined, buttons with up and down arrows are added next to the input
   * field. Which when pressed will add or subtract `step` from the value.
   */
  step?: OrItemAccessor<$Item, {}, number>
  /**
   * The amount of decimals to round to.
   */
  decimals?: OrItemAccessor<$Item, {}, number>
  /** Validation rules for numeric constraints. */
  rules?: Omit<SchemaNumberMixin<$Item>, 'rules'> & {
    /** Restrict the value to whole numbers. */
    integer?: boolean
  }
}

export interface SchemaTextMixin<$Item> {
  /**
   * Whether to trim whitespace from the value.
   */
  trim?: OrItemAccessor<$Item, {}, boolean>
}

export type SchemaAffix =
  | string
  | {
      /** The component type name for the affix. */
      type?: string
      /** Plain text content for the affix. */
      text?: string
      /** Raw HTML content for the affix. */
      html?: string
      /** Conditionally display the affix. */
      if?: OrItemAccessor<any, {}, boolean>
    }

export interface SchemaAffixMixin<$Item> {
  /**
   * Prefix content displayed before the input.
   */
  prefix?: OrArrayOf<SchemaAffix>
  /**
   * Suffix content displayed after the input.
   */
  suffix?: OrArrayOf<SchemaAffix>
}

export interface SchemaDataMixin<$Item> {
  /**
   * Data source for the component.
   */
  data?: OrItemAccessor<$Item, {}, any>
  /**
   * Path to retrieve data from parent context.
   */
  dataPath?: string
}

/**
 * Properties shared by all schemas that support custom
 * instance members and lifecycle events — component
 * schemas, views, and forms.
 */
export interface SchemaFields<$Item> {
  /**
   * Methods accessible via `this` from event handlers,
   * computed properties, watchers, and templates. Unlike
   * event handlers, methods do not receive a context
   * parameter — use `this.context` to access it.
   */
  methods?: Record<string, (...args: any[]) => any> &
    ThisType<DitoComponentInstance<$Item>>

  /**
   * Computed properties defined on the component. Can be a
   * getter function or a `{ get, set }` object for
   * read-write computed properties. Getters and setters
   * are called with the component as `this`. Like
   * {@link SchemaFields.methods}, use `this.context` to
   * access the context.
   */
  computed?: Record<
    string,
    | ((this: DitoComponentInstance<$Item>) => any)
    | {
        get: (this: DitoComponentInstance<$Item>) => any
        set: (
          this: DitoComponentInstance<$Item>,
          value: any
        ) => void
      }
  >

  /**
   * Watchers on data properties or expression paths. Keys
   * are either component names (resolved to
   * `data.${name}`) or arbitrary expression paths. Can be
   * a plain handler function or an object with `handler`,
   * `deep`, and `immediate` options.
   */
  watch?:
    | WatchHandlers<$Item>
    | ((
        this: DitoComponentInstance<$Item>
      ) => WatchHandlers<$Item>)

  /**
   * Panel schemas rendered in the sidebar. Panels share
   * the parent's data unless their schema defines its
   * own `data` property.
   */
  panels?: Record<string, PanelSchema<$Item>>

  /**
   * Called when the schema's component tree is set up.
   */
  onInitialize?: ItemEventHandler<$Item>
  /**
   * Called once when the schema component is unmounted
   * from the DOM.
   */
  onDestroy?: ItemEventHandler<$Item>
  /**
   * Called after data has been fetched from the API.
   * Fires after all reactive updates have propagated.
   */
  onLoad?: ItemEventHandler<$Item>
  /**
   * Called after a value change is committed. Fires
   * after all reactive updates have propagated. Bubbles
   * to parent schemas — return `false` to stop
   * propagation.
   */
  onChange?: ItemEventHandler<$Item>
}

/** @deprecated Use {@link SchemaFields} instead. */
export type SchemaSetupMixin<$Item = any> = SchemaFields<$Item>

/**
 * Properties shared by route-level schemas
 * ({@link ViewSchema} and {@link Form}).
 */
export interface SchemaRoute<$Item = any>
  extends SchemaFields<$Item>,
    SchemaOpen<$Item> {
  /**
   * Renders with reduced spacing.
   *
   * @defaultValue `false`
   */
  compact?: boolean
  /**
   * Resource configuration for loading data from
   * the API.
   */
  resource?: Resource
  /**
   * Enables copy/paste for the data. Set to `true`
   * for default behavior or provide custom
   * copy/paste handlers.
   */
  clipboard?: ClipboardConfig
  /**
   * Additional reactive data properties merged into
   * the component's data scope.
   */
  data?: OrItemAccessor<$Item, {}, Record<string, any>>
  /**
   * Whether to use a wider content area.
   *
   * @defaultValue `false`
   */
  wide?: OrItemAccessor<$Item, {}, boolean>
  /**
   * Custom breadcrumb text shown in page navigation.
   *
   * @defaultValue `${breadcrumbPrefix} ${label}`
   */
  breadcrumb?: string
  buttons?: Buttons<$Item>
  /**
   * Conditionally display this view or form.
   */
  if?: OrItemAccessor<$Item, {}, boolean>
}

/** @deprecated Use {@link SchemaRoute} instead. */
export type SchemaRouteMixin<$Item = any> = SchemaRoute<$Item>

export interface ComponentSchema<$Item = any> extends BaseSchema<$Item> {
  type: 'component'
  /**
   * Use a Vue component to render the component. The component is specified
   * like this: import(...).
   */
  component: Resolvable<VueComponent>
}

export interface InputSchema<$Item = any>
  extends BaseSchema<$Item>,
    SchemaTextMixin<$Item>,
    SchemaAffixMixin<$Item> {
  /**
   * The type of the component.
   */
  type:
    | 'text'
    | 'email'
    | 'url'
    | 'hostname'
    | 'domain'
    | 'tel'
    | 'password'
    | 'creditcard'
  rules?: {
    text?: boolean
    email?: boolean
    url?: boolean
    hostname?: boolean
    domain?: boolean
    password?: boolean
    creditcard?: boolean
  }
}

export interface DateSchema<$Item = any>
  extends BaseSchema<$Item>,
    SchemaAffixMixin<$Item> {
  /**
   * The type of the component.
   */
  type: 'date' | 'datetime' | 'time'
  /**
   * @defaultValue `En/US`
   */
  locale?: string
  /**
   * Format configuration for date/time display.
   */
  formats?: OrItemAccessor<
    $Item,
    {},
    {
      date?: DateFormat
      time?: TimeFormat
    }
  >
  /**
   * @deprecated Use `formats` instead.
   */
  dateFormat?: OrItemAccessor<$Item, {}, DateFormat>
}

export interface ButtonSchema<$Item = any>
  extends BaseSchema<$Item>,
    SchemaAffixMixin<$Item> {
  /**
   * The type of the component.
   */
  type: 'button' | 'submit'
  closeForm?: OrItemAccessor<$Item, {}, boolean>
  text?: OrItemAccessor<$Item, {}, string>
  resource?: Resource
  onClick?: ItemEventHandler<$Item>
  onSuccess?: ItemEventHandler<$Item>
  onError?: ErrorEventHandler<$Item>
  events?: {
    click?: ItemEventHandler<$Item>
    success?: ItemEventHandler<$Item>
    error?: ErrorEventHandler<$Item>
  }
}

export interface SwitchSchema<$Item = any> extends BaseSchema<$Item> {
  /**
   * The type of the component.
   */
  type: 'switch'
  labels?: {
    /**
     * The displayed label when the switch is checked.
     *
     * @defaultValue `'on'`
     */
    checked?: string
    /**
     * The displayed label when the switch is unchecked.
     *
     * @defaultValue `'off'`
     */
    unchecked?: string
  }
}

export interface NumberSchema<$Item = any>
  extends SchemaNumberMixin<$Item>,
    BaseSchema<$Item>,
    SchemaAffixMixin<$Item> {
  /**
   * The type of the component.
   */
  type: 'number' | 'integer'
}

export interface SliderSchema<$Item = any>
  extends SchemaNumberMixin<$Item>,
    BaseSchema<$Item> {
  /**
   * The type of the component.
   */
  type: 'slider'
  /**
   * Whether to show a number input alongside the slider.
   *
   * @defaultValue `true`
   */
  input?: OrItemAccessor<$Item, {}, boolean>
}

export interface TextareaSchema<$Item = any>
  extends BaseSchema<$Item>,
    SchemaTextMixin<$Item> {
  /**
   * The type of the component.
   */
  type: 'textarea'
  /**
   * Whether the input element is resizable.
   */
  resizable?: OrItemAccessor<$Item, {}, boolean>
  /**
   * The amount of visible lines.
   *
   * @defaultValue `4`
   */
  lines?: number
}

export interface CodeSchema<$Item = any> extends BaseSchema<$Item> {
  /**
   * The type of the component.
   */
  type: 'code'
  /**
   * The code language.
   *
   * @defaultValue `js`
   */
  language?: OrItemAccessor<$Item, {}, string>
  /**
   * The indent size.
   *
   * @defaultValue `2`
   */
  indentSize?: OrItemAccessor<$Item, {}, number>
  /**
   * The amount of visible lines.
   *
   * @defaultValue `3`
   */
  lines?: OrItemAccessor<$Item, {}, number>
  /**
   * Whether the input element is resizable.
   */
  resizable?: OrItemAccessor<$Item, {}, boolean>
}

export interface MarkupSchema<$Item = any> extends BaseSchema<$Item> {
  /**
   * The type of the component.
   */
  type: 'markup'
  /**
   * Whether the input element is resizable.
   */
  resizable?: OrItemAccessor<$Item, {}, boolean>
  /**
   * @defaultValue `'collapse'`
   */
  whitespace?: OrItemAccessor<
    $Item,
    {},
    'collapse' | 'preserve' | 'preserve-all'
  >
  /**
   * The amount of visible lines.
   *
   * @defaultValue `10`
   */
  lines?: number

  /**
   * Whether TipTap input and paste rules are enabled. When
   * `true`, both input and paste rules are active. Can also be
   * an object to control input and paste rules independently.
   *
   * @defaultValue `false`
   */
  enableRules?: OrItemAccessor<
    $Item,
    {},
    | boolean
    | {
        input: boolean
        paste: boolean
      }
  >
  /**
   * Whether Enter creates a hard break instead of a new
   * paragraph.
   */
  hardBreak?: boolean
  marks?: {
    bold?: boolean
    italic?: boolean
    underline?: boolean
    strike?: boolean
    small?: boolean
    code?: boolean
    subscript?: boolean
    superscript?: boolean
    link?: boolean
  }
  nodes?: {
    blockquote?: boolean
    codeBlock?: boolean
    heading?: (1 | 2 | 3 | 4 | 5 | 6)[]
    horizontalRule?: boolean
    orderedList?: boolean
    bulletList?: boolean
  }
  tools?: {
    history?: boolean
    footnotes?: boolean
  }
}

export interface LabelSchema<$Item = any> extends BaseSchema<$Item> {
  /**
   * The type of the component.
   */
  type: 'label'
}

/**
 * A non-visible component that includes a computed or
 * derived value in the form data without rendering it.
 */
export interface HiddenSchema<$Item = any>
  extends BaseSchema<$Item>,
    SchemaDataMixin<$Item> {
  /**
   * The type of the component.
   */
  type: 'hidden'
}

export interface UploadSchema<$Item = any> extends BaseSchema<$Item> {
  /**
   * The type of the component.
   */
  type: 'upload'
  /**
   * Whether multiple files can be uploaded.
   *
   * @default false
   */
  multiple?: boolean
  /**
   * Allowed file extensions for upload.
   * @example 'zip' // Only files with zip extension
   * @example ['jpg', 'jpeg', 'gif', 'png']
   * @example /\.(gif|jpe?g|png)$/i
   */
  extensions?: OrArrayOf<RegExp | string>
  /**
   * One or more unique file type specifiers that describe the type of file
   * that may be selected for upload by the user.
   *
   * @example 'audio/*' // Any type of audio file
   * @example ['image/png', 'image/gif', 'image/jpeg']
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file#Unique_file_type_specifiers }
   */
  accept?: OrArrayOf<string>
  /**
   * The maximum size of the file expressed as number of bytes or as a string
   * like `'200kb'`, `'1mb'`, `'3.2gb'`, etc.
   *
   * @see {@link https://github.com/patrickkettner/filesize-parser/blob/master/test.js String Examples}
   */
  maxSize?: string | number
  /**
   * Whether uploaded files can be reordered by dragging.
   *
   * @defaultValue `false`
   */
  draggable?: OrItemAccessor<$Item, {}, boolean>
  /**
   * Whether files can be deleted.
   */
  deletable?: OrItemAccessor<$Item, {}, boolean>
  /**
   * Custom render function for file display.
   */
  render?: ItemAccessor<$Item, {}, string>
  /**
   * Whether to display thumbnails for uploaded files, or
   * thumbnail size.
   */
  thumbnails?: OrItemAccessor<$Item, {}, boolean | string>
  /**
   * URL or function returning URL for file thumbnails.
   */
  thumbnailUrl?: OrItemAccessor<$Item, {}, string>
  /**
   * URL or function returning URL for file downloads.
   */
  downloadUrl?: OrItemAccessor<$Item, {}, string>
}

export interface MultiselectSchema<$Item = any, $Option = any>
  extends BaseSchema<$Item>,
    SchemaOptionsMixin<$Item, $Option>,
    SchemaAffixMixin<$Item> {
  /**
   * The type of the component.
   */
  type: 'multiselect'
  /**
   * Whether more than one option can be selected.
   *
   * @defaultValue `false`
   */
  multiple?: boolean
  /**
   * Whether to enable a search input field in the dropdown
   * for filtering options.
   *
   * @defaultValue `false`
   */
  searchable?: boolean
  /**
   * Whether the dropdown stays open after selecting an option,
   * useful for making multiple selections without repeated
   * opening.
   *
   * @defaultValue `false`
   */
  stayOpen?: boolean
  /**
   * Whether users can create new options by typing and
   * pressing Enter, adding custom tags not in the options
   * list.
   *
   * @defaultValue `false`
   */
  taggable?: boolean
}

export interface SelectSchema<$Item = any>
  extends BaseSchema<$Item>,
    SchemaOptionsMixin<$Item>,
    SchemaAffixMixin<$Item> {
  /**
   * The type of the component.
   */
  type: 'select'
}

export interface RadioSchema<$Item = any>
  extends BaseSchema<$Item>,
    SchemaOptionsMixin<$Item> {
  /**
   * The type of the component.
   */
  type: 'radio'
  /**
   * @defaultValue `'vertical'`
   */
  layout?: 'horizontal' | 'vertical'
}

type SectionContent<$Data> = {
  /** The section's field components. */
  components?: Components<$Data>
  /**
   * A form schema for the section's content. Use this
   * instead of `components` to get form-level options
   * like `label`, `tabs`, and `mutate`.
   */
  form?: ResolvableForm<$Data>
  /**
   * Display several schemas in different tabs
   * within the section.
   */
  tabs?: Record<
    string,
    Omit<Form<$Data>, 'tabs' | 'type'> & {
      type: 'tab'
      defaultTab?: OrItemAccessor<$Data, {}, boolean>
    }
  >
}

/**
 * A visual grouping of components within a form.
 *
 * By default, the section's components read and write fields
 * on the parent item directly. When `nested` is `true`, the
 * section's fields are stored under their own key on the
 * parent item instead (e.g. `item.address`).
 *
 * For non-nested sections, declare the key as `never` in
 * your item type. For nested sections, declare it as the
 * object type of the nested data (see {@link Components}).
 *
 * @template $Item The parent item type, used for callbacks
 *   like `label` and `collapsible`.
 * @template $Nested The type of the section's own data.
 *   For nested sections this is the value type at the
 *   section's key (e.g. `Address`). For non-nested sections
 *   this defaults to `$Item`.
 *
 * @example Non-nested section (fields stored on parent item)
 * ```ts
 * type Item = {
 *   title: string
 *   details: never // UI-only key
 * }
 *
 * const components: Components<Item> = {
 *   details: {
 *     type: 'section',
 *     components: {
 *       title: { type: 'text' }
 *     }
 *   }
 * }
 * ```
 *
 * @example Nested section (fields stored at `item.address`)
 * ```ts
 * type Address = { street: string; city: string }
 *
 * type Item = {
 *   title: string
 *   address: Address // data key for nested section
 * }
 *
 * const components: Components<Item> = {
 *   address: {
 *     type: 'section',
 *     nested: true,
 *     components: {
 *       street: { type: 'text' },
 *       city: { type: 'text' }
 *     }
 *   }
 * }
 * ```
 */
export type SectionSchema<$Item = any, $Nested = $Item> = BaseSchema<$Item> &
  SchemaOpen<$Item> & {
    /**
     * The type of the component.
     */
    type: 'section'
    /**
     * Multiple form schemas keyed by item type, for
     * sections with polymorphic content.
     */
    forms?: {
      [key: string]: ResolvableForm
    }
    /**
     * Renders the section with reduced spacing.
     *
     * @defaultValue `false`
     */
    compact?: boolean
    /**
     * Enables copy/paste for the section's data.
     */
    clipboard?: ClipboardConfig
    /**
     * Whether the section can be collapsed.
     */
    collapsible?: OrItemAccessor<$Item, {}, boolean>
    /** Whether the section is collapsed. */
    collapsed?: OrItemAccessor<$Item, {}, boolean>
    /**
     * Grouped event handlers.
     */
    events?: {
      /**
       * Called when a collapsible section is toggled
       * open or closed.
       */
      open?: OpenEventHandler<$Item>
    }
  } & (
    | ({
        /**
         * Whether the data is stored under its own key
         * on the parent item. When `true`, an "address"
         * section stores data at `item.address`. When
         * `false` or omitted, the section's fields are
         * stored directly on the parent item.
         *
         * @defaultValue `false`
         */
        nested?: false
      } & SectionContent<$Item>)
    | ({
        /**
         * Whether the data is stored under its own key
         * on the parent item. When `true`, an "address"
         * section stores data at `item.address`. When
         * `false` or omitted, the section's fields are
         * stored directly on the parent item.
         *
         * @defaultValue `false`
         */
        nested: true
      } & SectionContent<$Nested>)
  )

export interface CheckboxSchema<$Item = any> extends BaseSchema<$Item> {
  /**
   * The type of the component.
   */
  type: 'checkbox'
}

export interface CheckboxesSchema<$Item = any>
  extends BaseSchema<$Item>,
    SchemaOptionsMixin<$Item> {
  /**
   * The type of the component.
   */
  type: 'checkboxes'
  /**
   * @defaultValue `'vertical'`
   */
  layout?: 'horizontal' | 'vertical'
}

export type ColorFormat =
  | 'rgb'
  | 'prgb'
  | 'hex'
  | 'hex6'
  | 'hex3'
  | 'hex4'
  | 'hex8'
  | 'name'
  | 'hsl'
  | 'hsv'
export interface ColorSchema<$Item = any>
  extends BaseSchema<$Item>,
    SchemaAffixMixin<$Item> {
  /**
   * The type of the component.
   */
  type: 'color'
  /**
   * The color format.
   */
  format?: OrItemAccessor<$Item, {}, ColorFormat>
  /**
   * Whether the color may contain an alpha component.
   *
   * @defaultValue `false`
   */
  alpha?: OrItemAccessor<$Item, {}, boolean>
  /**
   * Whether to display input fields for manual color value
   * entry (e.g. RGB, HSL) in the color picker.
   *
   * @defaultValue `true`
   */
  inputs?: OrItemAccessor<$Item, {}, boolean>
  /**
   * Color presets as an array of color values as strings in any css
   * compatible format.
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/CSS/color_value}
   */
  presets?: OrItemAccessor<$Item, {}, string[]>
}

export type ColumnSchema<$Item = any, $Value = any> = {
  /**
   * The label of the column.
   * @defaultValue The labelized column key.
   */
  label?: string
  /**
   * Use a Vue component to render the cell. The component is specified
   * like this: import(...).
   */
  component?: Resolvable<VueComponent>
  /**
   * Whether the column should be sortable.
   */
  sortable?: boolean
  /**
   * A function of the value and the item returning the displayed name.
   * If the column is sortable, the column is sorted by value and not by
   * rendered name.
   */
  render?: ItemAccessor<$Item, { value: $Value }, string | null | undefined>
  /**
   * The provided string is applied to the class property of the column
   * cell html elements.
   */
  class?: string
  /**
   * The provided string is applied to the style property of the column
   * cell html elements.
   */
  style?: string | Partial<CSSStyleDeclaration>
  /**
   * Sort the colum in ascending or descending order. Columns are ordered by the
   * first column to specify `defaultSort`.
   */
  defaultSort?: 'asc' | 'desc'
  /** Whether to display the column. */
  if?: OrItemAccessor<$Item, {}, boolean>
}

/**
 * A form that can be provided directly, as a record of named forms
 * (e.g. a module namespace from `import()`), wrapped in a promise,
 * or returned from a function.
 */
export type ResolvableForm<$Item = any> = Resolvable<Form<$Item>>

export interface ListSchema<$Item = { [key: string]: any }>
  extends SchemaSourceMixin<$Item>,
    BaseSchema<$Item>,
    SchemaOpen<$Item> {
  /**
   * The type of the component.
   */
  type: 'list'

  /**
   * Filter definitions that render a filter panel above the
   * list, allowing users to filter displayed items. Each
   * filter can be a text filter with operators, a date-range
   * filter, or a custom filter with components.
   */
  filters?: {
    /**
     * Whether the filters panel header sticks to
     * the top of the scroll container.
     */
    sticky?: boolean
    [k: string]:
      | {
          label?: string
          filter: 'text'
          /**
           * @defaultValue `['contains']`
           */
          operators?: ('contains' | 'equals' | 'starts-with' | 'ends-with')[]
        }
      | {
          label?: string
          filter: 'date-range'
        }
      | {
          label?: string
          components: Components
        }
      | boolean
      | undefined
  }
  /**
   * Grouped event handlers.
   */
  events?: {
    /**
     * Called when a collapsible inlined list is
     * toggled open or closed.
     */
    open?: OpenEventHandler<$Item>
  }
}

export type OrItemAccessor<
  $Item = any,
  $Params extends {} = {},
  $ReturnValue = any
> = ItemAccessor<$Item, $Params, $ReturnValue> | $ReturnValue

/**
 * Merges two object types into a single flat mapped type.
 * Unlike `A & B`, this preserves contextual typing for
 * callback parameters in complex intersections.
 */
type Merge<A, B> = {
  [K in keyof A | keyof B]: K extends keyof B
    ? B[K]
    : K extends keyof A
      ? A[K]
      : never
}

export type ItemAccessor<
  $Item = any,
  $Params extends {} = {},
  $ReturnValue = any
> = (params: Merge<DitoContext<$Item>, $Params>) => $ReturnValue

export type DitoContext<$Item = any> = {
  /**
   * `true` when the data-path points to a value inside
   * an item, `false` when it points to the item itself.
   */
  nested: boolean
  /** The current value of the component. */
  value: any
  /** Full dot-separated path to the current data. */
  dataPath: string
  /** The property name of the current component. */
  name: string
  /** The index within a list, if applicable. */
  index: number | null
  /**
   * Data path of the closest item ancestor.
   */
  itemDataPath: string
  /**
   * Data path of the parent item ancestor.
   */
  parentItemDataPath: string
  /** Index of the closest item in its list. */
  itemIndex: number | null
  /** Index of the parent item in its list. */
  parentItemIndex: number | null
  /** The current data item. */
  item: OmitNever<$Item>
  /**
   * NOTE: `parentItem` isn't the closest data parent to `item`,
   * it's the closest parent that isn't an array, e.g. for
   * relations or nested JSON data. This is why the term `item`
   * was chosen over `data`, e.g. VS the use of `parentData` in
   * server-sided validation, which is the closest parent.
   */
  parentItem: any
  /** The top-level root data item. */
  rootItem: any
  /**
   * The cloned data being prepared for server
   * submission. Available during `process` callbacks,
   * allowing modification of sibling fields.
   */
  processedItem: any
  /**
   * The root-level cloned data being prepared for
   * server submission.
   */
  processedRootItem: any
  /**
   * The form's current data processed for clipboard
   * copy/paste operations.
   */
  clipboardItem: any
  /** The currently authenticated user. */
  user: {
    roles?: string[]
    hasRole(...roles: string[]): boolean
  }
  /** The admin API configuration. */
  api: ApiConfig
  /** The schema definition for the current component. */
  schema: Component | null
  /** All registered top-level views. */
  views: Record<string, View>
  /** All views flattened into a single record. */
  flattenedViews: Record<string, ViewSchema>
  /** Display label of the current item. */
  itemLabel: string | null
  /** Display label of the current form. */
  formLabel: string | null
  /** The current Vue component instance. */
  component: DitoComponentInstanceBase | null
  /**
   * The nearest ancestor `DitoSchema` component that
   * manages this field's layout.
   */
  schemaComponent: DitoSchemaInstance | null
  /** The nearest ancestor form component. */
  formComponent: DitoFormInstance
  /** The nearest ancestor view component. */
  viewComponent: DitoViewInstance | null
  /** The nearest ancestor dialog component. */
  dialogComponent: DitoComponentInstanceBase | null
  /** The nearest ancestor panel component. */
  panelComponent: DitoComponentInstanceBase | null
  /** The nearest ancestor resource component. */
  resourceComponent:
    | DitoFormInstance
    | DitoSourceInstance
    | null
  /** The nearest ancestor source component. */
  sourceComponent: DitoSourceInstance | null
  /** The currently focused option in a select. */
  option: any
  /** All available options in a select. */
  options: any
  /**
   * Whether a pulldown/select is currently open.
   */
  open: boolean | undefined
  /**
   * The current search term in select components.
   */
  searchTerm: string | undefined
  /**
   * Whether a button request is currently running.
   */
  isRunning: boolean
  /** Current URL query parameters. */
  query: Record<string, string | (string | null)[]>
  /**
   * The error object, populated in button `error`
   * event handler contexts.
   */
  error: unknown
  /**
   * Whether the event handler already called
   * `context.notify()`, used to suppress the default
   * notification for button events.
   */
  wasNotified: boolean

  // Helper Methods

  /** Performs an API request with optional caching. */
  request<T>(options: {
    /**
     * Allows caching of loaded data on two levels:
     * - 'global': cache globally, for the entire admin session
     * - 'local': cache locally within the closest route
     *   component that is associated with a resource and loads
     *   its own data.
     */
    cache?: 'local' | 'global'
    url: string
    /**
     * @default 'get'
     */
    method?: HTTPMethod
    query?:
      | Record<string, string | number | (string | number)[]>
      | [string, string | number][]
    data?: unknown
    resource?: Resource
  }): Promise<T>
  /** Formats values using locale-aware formatters. */
  format: typeof utilsFormat
  /** Navigates to a route programmatically. */
  navigate: VueRouter['push']
  /**
   * Triggers a file download from the given URL or
   * options.
   */
  download: {
    (url: string): void
    (options: { url: string; filename: string }): void
  }
  /** Returns the full URL for a given resource. */
  getResourceUrl(resource: Resource): string
  /** Displays a notification to the user. */
  notify(options: {
    type?: LiteralUnion<'warning' | 'error' | 'info' | 'success'>
    title?: string
    text: OrArrayOf<string>
  }): void
}

/**
 * The `this` type inside schema `methods`, `computed`,
 * and `watch` handlers. Unlike the context passed to
 * schema accessors like `if` and `label`, this is the
 * live component instance.
 *
 * @template $Item The data item type.
 * @template $Members Additional schema-defined methods
 *   and computed properties available on `this`.
 */
export type DitoComponentInstance<
  $Item = any,
  $Members extends Record<string, any> = {}
> = DitoComponentInstanceBase<$Item> & $Members

export interface DitoComponentInstanceBase<$Item = any> extends EmitterMixin {
  // -- Data access (ValueMixin, ContextMixin, TypeMixin) --

  /** The current value of the component (getter/setter). */
  value: any
  /** The current data item. */
  item: OmitNever<$Item>
  /**
   * The closest parent item that isn't an array (e.g.
   * for relations or nested JSON data).
   */
  parentItem: any
  /** The top-level root data item. */
  rootItem: any
  /**
   * The cloned data being prepared for server
   * submission. Available during `process` callbacks.
   */
  processedItem: any
  /** The root-level cloned data for server submission. */
  processedRootItem: any
  /** The component's data object. */
  data: Record<string, any>
  /** Parent data object, or `null` if same as data. */
  parentData: Record<string, any> | null
  /** The property name of the current component. */
  name: string
  /** Full dot-separated path to the current data. */
  dataPath: string
  /** The schema definition for the current component. */
  schema: Component
  /** The component type from the schema. */
  type: string

  // -- State (TypeMixin, ValidationMixin) --

  /** Whether the component currently has focus. */
  focused: boolean
  /** The value after applying `schema.parse()`. */
  parsedValue: any
  /** Whether the field has been focused at least once. */
  isTouched: boolean
  /** Whether the field value has been modified. */
  isDirty: boolean
  /** Whether the field is currently valid. */
  isValid: boolean
  /** Whether validation has been run on the field. */
  isValidated: boolean
  /** Validation error messages, or `null`. */
  errors: string[] | null
  /** Whether the field has validation errors. */
  hasErrors: boolean
  /** Whether async data is currently being loaded. */
  isLoading: boolean
  /**
   * Sets the loading state. Optionally propagates
   * to the root or view component.
   */
  setLoading(
    isLoading: boolean,
    options?: { updateRoot?: boolean; updateView?: boolean }
  ): void
  /**
   * Whether the component works with data not yet
   * persisted to the server.
   */
  isTransient: boolean
  /** Whether the component is mounted. */
  isMounted: boolean
  /** Whether the component tree is populated. */
  isPopulated: boolean
  /**
   * Whether this component loads its own data from
   * a resource.
   */
  providesData: boolean
  /** The schema of the source component. */
  sourceSchema: Component | null
  /** Action verb labels (create, save, delete, etc.). */
  verbs: Record<string, string>

  // -- Resolved schema accessors (TypeMixin) --

  /** Resolved `schema.visible` value. */
  visible: boolean
  /** Resolved `schema.exclude` value. */
  exclude: boolean
  /** Resolved `schema.required` value. */
  required: boolean
  /** Resolved `schema.readonly` value. */
  readonly: boolean
  /** Resolved `schema.disabled` value. */
  disabled: boolean
  /** Resolved `schema.clearable` value. */
  clearable: boolean
  /** Resolved `schema.autofocus` value. */
  autofocus: boolean
  /** Resolved `schema.placeholder` value. */
  placeholder: string | undefined
  /** Resolved `schema.info` value. */
  info: string | null
  /** Resolved `schema.maxLength` value. */
  maxLength: number | undefined
  /** Resolved `schema.autocomplete` value. */
  autocomplete: string | undefined

  // -- Component hierarchy (DitoMixin) --

  /** The `DitoContext` for this component. */
  context: DitoContext<$Item>
  /** The nearest `DitoSchema` managing layout. */
  schemaComponent: DitoSchemaInstance
  /** The nearest ancestor form component. */
  formComponent: DitoFormInstance
  /** The nearest ancestor view component. */
  viewComponent: DitoViewInstance | null
  /** The nearest ancestor dialog component. */
  dialogComponent: DitoComponentInstanceBase | null
  /** The nearest ancestor panel component. */
  panelComponent: DitoComponentInstanceBase | null
  /** The nearest ancestor resource component. */
  resourceComponent: DitoFormInstance | DitoSourceInstance
  /** The nearest ancestor source component. */
  sourceComponent: DitoSourceInstance
  /**
   * The nearest route component (form or view) in the
   * ancestor chain.
   */
  routeComponent: DitoFormInstance | DitoViewInstance | null
  /**
   * The first parent route component that provides and
   * loads its own data from the API.
   */
  dataComponent: DitoFormInstance | DitoViewInstance | null
  /** The parent schema component. */
  parentSchemaComponent: DitoComponentInstanceBase | null
  /** The parent form component. */
  parentFormComponent: DitoComponentInstanceBase | null
  /** The root component instance. */
  rootComponent: DitoComponentInstanceBase | null
  /** The nearest ancestor tab component. */
  tabComponent: DitoComponentInstanceBase | null
  /** The parent route component. */
  parentRouteComponent:
    | DitoFormInstance
    | DitoViewInstance
    | null
  /** The parent resource component. */
  parentResourceComponent:
    | DitoFormInstance
    | DitoSourceInstance
    | null

  // -- Environment (DitoMixin) --

  /** The currently authenticated user. */
  user: DitoContext['user']
  /** The admin API configuration. */
  api: ApiConfig
  /** Current locale from the API config. */
  locale: string
  /** All registered top-level views. */
  views: Record<string, View>
  /** All views flattened into a single record. */
  flattenedViews: Record<string, ViewSchema>
  /** Data from the first parent route that loads data. */
  rootData: any

  // -- Actions (DitoMixin) --

  /** Performs an API request with optional caching. */
  request: DitoContext['request']
  /** Formats values using locale-aware formatters. */
  format: DitoContext['format']
  /** Navigates to a route programmatically. */
  navigate: DitoContext['navigate']
  /** Triggers a file download. */
  download: DitoContext['download']
  /** Displays a notification to the user. */
  notify: DitoContext['notify']
  /** Returns the full URL for a given resource. */
  getResourceUrl: DitoContext['getResourceUrl']
  /**
   * Sends an HTTP request to the API.
   */
  sendRequest(options: {
    method?: HTTPMethod
    url?: string
    resource?: Resource
    query?:
      | Record<string, string | number | (string | number)[]>
      | [string, string | number][]
    data?: unknown
    signal?: AbortSignal
    internal?: boolean
  }): Promise<unknown>
  /**
   * Shows a modal dialog and returns a promise that
   * resolves with the dialog result.
   */
  showDialog(options: {
    components?: Components
    buttons?: Buttons<any>
    data?: Record<string, any>
    settings?: Record<string, any>
  }): Promise<unknown>
  /**
   * Resolves a schema value by key or data-path,
   * with optional type coercion and default.
   */
  getSchemaValue(
    keyOrDataPath: string,
    options?: {
      type?: Function | Function[]
      default?: any
      schema?: Component
      context?: DitoContext
      callback?: boolean
    }
  ): any
  /** Returns a human-readable label for a schema. */
  getLabel(
    schema: Component | null,
    name?: string
  ): string
  /**
   * Returns a Vue Router location object with the
   * given query params and the current hash
   * preserved (for tab navigation).
   */
  getQueryLink(
    query: Record<string, any>
  ): { query: Record<string, any>; hash: string }
  /**
   * Returns `true` if the schema's `if` accessor
   * evaluates to `true` (or is absent).
   */
  shouldRenderSchema(
    schema?: Component | null
  ): boolean
  /**
   * Returns the resolved `visible` value for a
   * schema. Defaults to `true`.
   */
  shouldShowSchema(
    schema?: Component | null
  ): boolean
  /**
   * Returns the resolved `disabled` value for a
   * schema. Defaults to `false`.
   */
  shouldDisableSchema(
    schema?: Component | null
  ): boolean
  /**
   * Emits a schema event by name (e.g. `'change'`,
   * `'focus'`). Calls the matching `on[Event]`
   * handler and the `events[event]` handler on the
   * schema. Returns the handler result, or
   * `undefined` if no handler was found. The event
   * bubbles to parent schemas unless the handler
   * returns `false`.
   *
   * @param event The event name to emit.
   * @param options.context Custom context properties
   *   merged into the `DitoContext` passed to the
   *   event handler.
   */
  emitEvent(
    event: string,
    options?: {
      context?: DitoContext
    }
  ): Promise<any>
  /**
   * Emits a schema event on the nearest schema
   * component (rather than `this`). Used by form
   * and resource components to emit lifecycle
   * events like `'load'` and `'submit'`.
   */
  emitSchemaEvent(
    event: string,
    params?: Record<string, any>
  ): Promise<any>
  /** Converts a camelCase name to a human-readable label. */
  labelize(name: string): string
  /** Gets a value from the component store. */
  getStore(key: string): any
  /** Sets a value in the component store. */
  setStore(key: string, value: any): any
  /** Removes a value from the component store. */
  removeStore(key: string): void

  // -- Actions (TypeMixin) --

  /** Focuses the component and scrolls it into view. */
  focus(): Promise<void>
  /** Blurs the component. */
  blur(): void
  /** Clears the value, blurs, and triggers onChange. */
  clear(): void
  /** Scrolls the component into view. */
  scrollIntoView(): Promise<void>

  // -- Actions (ValidationMixin) --

  /**
   * Validates the field. Returns `true` if valid.
   * When `notify` is `true` (default), updates state
   * and emits errors.
   */
  validate(notify?: boolean): boolean
  /** Validates without notifying (shorthand). */
  verify(): boolean
  /** Marks the field as touched and clears errors. */
  markTouched(): void
  /** Marks the field as dirty and resets validation. */
  markDirty(): void
  /** Resets all validation state. */
  resetValidation(): void
  /** Adds an error message to the errors array. */
  addError(error: string, addLabel?: boolean): void
  /**
   * Shows server-side validation errors on the
   * component. Returns `true` if errors were shown.
   */
  showValidationErrors(
    errors: { message: string }[],
    focus: boolean
  ): boolean
  /** Returns a copy of the current errors, or `null`. */
  getErrors(): string[] | null
  /** Clears all validation errors. */
  clearErrors(): void
  /** Closes all notification toasts. */
  closeNotifications(): void
}

export interface EmitterMixin {
  /** Registers one or more event listeners. */
  on(
    event:
      | string
      | string[]
      | Record<string, Function>,
    callback?: Function
  ): this
  /** Registers a one-time event listener. */
  once(event: string, callback: Function): this
  /** Removes event listener(s). */
  off(
    event?:
      | string
      | string[]
      | Record<string, Function>,
    callback?: Function
  ): this
  /** Emits an event asynchronously (queued). */
  emit(event: string, ...args: any[]): Promise<any>
  /** Returns `true` if listeners exist for the event(s). */
  hasListeners(event: string | string[]): boolean
  /** Re-emits events from this component on the target. */
  delegate(
    event: string | string[],
    target: EmitterMixin
  ): this
}

export interface DitoFormInstance<$Item = any>
  extends DitoComponentInstanceBase<$Item> {
  /**
   * Whether this form is creating a new item
   * (`true`) or editing an existing one (`false`).
   */
  isCreating: boolean

  /**
   * Submits the form data to the API. Returns
   * `true` on success, `false` if validation
   * fails or the request errors.
   */
  submit(
    button?: DitoComponentInstanceBase,
    options?: {
      validate?: boolean
      closeForm?: boolean
    }
  ): Promise<boolean>

  /**
   * Cancels the form and navigates to the parent
   * route.
   */
  cancel(): Promise<void>

  /**
   * Closes the form and navigates to the parent
   * route.
   */
  close(): Promise<void>

  /**
   * Validates all fields in the form. Optionally
   * filter fields with a match pattern. Returns
   * `true` if all matched fields are valid.
   */
  validateAll(
    match?:
      | string
      | string[]
      | RegExp
      | ((field: string) => boolean),
    notify?: boolean
  ): boolean

  /**
   * Like {@link validateAll} but without
   * triggering error notifications.
   */
  verifyAll(
    match?:
      | string
      | string[]
      | RegExp
      | ((field: string) => boolean)
  ): boolean

  // -- Resource & route (ResourceMixin, RouteMixin) --

  /** Display label for this form. */
  label: string
  /** Breadcrumb text for navigation. */
  breadcrumb: string
  /** Prefix prepended to the breadcrumb label. */
  breadcrumbPrefix: string
  /** Whether this is the last route in the hierarchy. */
  isLastRoute: boolean
  /** Whether this route is nested inside another route. */
  isNestedRoute: boolean
  /** Zero-based depth of this route in the hierarchy. */
  routeLevel: number

  /**
   * The resolved API resource for this component,
   * or `null` if none is configured.
   */
  resource: Resource | null
  /**
   * Whether loaded data is available on this
   * component.
   */
  hasData: boolean
  /**
   * Reloads data from the API without clearing
   * the existing data first.
   */
  reloadData(): void
  /**
   * Ensures data is loaded: reloads if data
   * exists, otherwise loads fresh.
   */
  ensureData(): void
  /** Clears the loaded data. */
  clearData(): void
  /** Sets the component's loaded data directly. */
  setData(data: any): void
  /**
   * Creates a new data object with default values
   * from the schema. Optionally sets a `type`
   * property for polymorphic forms.
   */
  createData(
    schema: Component,
    type?: string
  ): Record<string, any>
  /**
   * The route parameter value for this route
   * component (e.g. an item id or `'create'`).
   */
  param: string | number | null
  /**
   * Whether the form directly mutates the
   * parent's data instead of working on a copy.
   */
  isMutating: boolean
  /**
   * Builds a child route path relative to this
   * route component's path.
   */
  getChildPath(path: string): string
}

export interface DitoViewInstance<$Item = any>
  extends DitoComponentInstanceBase<$Item> {
  /** Always `true` for view components. */
  isView: true

  // -- Route (RouteMixin) --

  /** Display label for this view. */
  label: string
  /** Breadcrumb text for navigation. */
  breadcrumb: string
  /** Prefix prepended to the breadcrumb label. */
  breadcrumbPrefix: string
  /** Whether this is the last route in the hierarchy. */
  isLastRoute: boolean
  /** Whether this route is nested inside another route. */
  isNestedRoute: boolean
  /** Zero-based depth of this route in the hierarchy. */
  routeLevel: number
  /**
   * The route parameter value for this route
   * component (e.g. an item id or `'create'`).
   */
  param: string | number | null
  /**
   * Whether the view directly mutates the
   * parent's data instead of working on a copy.
   */
  isMutating: boolean
  /**
   * Builds a child route path relative to this
   * route component's path.
   */
  getChildPath(path: string): string

  // -- Data & schema (DitoView) --

  /** The view's reactive data object. */
  data: Record<string, any>
  /** The resolved view schema definition. */
  viewSchema: ViewSchema
  /**
   * Whether this view contains a single inlined
   * source component (renders without a table header).
   */
  isSingleComponentView: boolean
  /**
   * Whether this view loads its own data from
   * a resource.
   */
  providesData: boolean
  /** Sets the view's data directly. */
  setData(data: any): void

  // -- Validation (ValidatorMixin) --

  /**
   * Validates all fields in the view.
   * Optionally filter fields with a match pattern.
   * Returns `true` if all matched fields are valid.
   */
  validateAll(
    match?:
      | string
      | string[]
      | RegExp
      | ((field: string) => boolean),
    notify?: boolean
  ): boolean

  /**
   * Like {@link validateAll} but without
   * triggering error notifications.
   */
  verifyAll(
    match?:
      | string
      | string[]
      | RegExp
      | ((field: string) => boolean)
  ): boolean
}

export interface DitoSchemaInstance<$Item = any>
  extends DitoComponentInstanceBase<$Item> {
  /**
   * Validates all fields in the schema.
   * Optionally filter fields with a match pattern
   * (string, string[], RegExp, or function).
   * Returns `true` if all matched fields are
   * valid.
   */
  validateAll(
    match?:
      | string
      | string[]
      | RegExp
      | ((field: string) => boolean),
    notify?: boolean
  ): boolean

  /**
   * Like {@link validateAll} but without
   * triggering error notifications.
   */
  verifyAll(
    match?:
      | string
      | string[]
      | RegExp
      | ((field: string) => boolean)
  ): boolean
}

export interface DitoSourceInstance<$Item = any>
  extends DitoComponentInstanceBase<$Item> {
  // -- Data access (SourceMixin) --

  /** The list data array (getter/setter). */
  listData: any[]
  /** The object data (getter/setter). */
  objectData: Record<string, any> | null
  /** Total number of items (for pagination). */
  total: number
  /** Current query parameters (getter/setter). */
  query: Record<string, any>
  /** Whether this source manages a list. */
  isListSource: boolean
  /** Whether this source manages an object. */
  isObjectSource: boolean
  /** Whether the source renders inline. */
  isInlined: boolean
  /**
   * Nesting depth of sources (0 for top-level,
   * increments for nested sources).
   */
  sourceDepth: number
  /** The URL path for this source. */
  path: string

  // -- Resolved schema accessors (SourceMixin) --

  /** Whether new items can be created. */
  creatable: boolean
  /** Whether existing items can be edited. */
  editable: boolean
  /** Whether items can be deleted. */
  deletable: boolean
  /** Whether items can be reordered by dragging. */
  draggable: boolean
  /** Whether inlined forms are collapsible. */
  collapsible: boolean
  /** Whether inlined forms are collapsed. */
  collapsed: boolean
  /** Resolved pagination page size. */
  paginate: number | undefined
  /** Maximum nesting depth for nested sources. */
  maxDepth: number
  /** Whether the source renders in compact mode. */
  isCompact: boolean

  // -- Schema introspection (SourceMixin) --

  /** Resolved column definitions. */
  columns: Record<string, ColumnSchema> | null
  /** Resolved scope definitions. */
  scopes: Record<string, any> | null
  /** Resolved form definitions. */
  forms: Form[]
  /** Resolved button schemas. */
  buttonSchemas: Record<string, ButtonSchema<any>>

  // -- Item operations (SourceMixin) --

  /**
   * Creates a new data item with defaults from the
   * schema. Optionally sets a `type` property for
   * polymorphic forms.
   */
  createItem(
    schema: Component,
    type?: string
  ): Record<string, any>
  /** Removes an item from the list data locally. */
  removeItem(item: any, index: number): void
  /**
   * Deletes an item via the API and removes it
   * from the list.
   */
  deleteItem(item: any, index: number): void
  /**
   * Navigates to a component identified by its
   * data path.
   */
  navigateToComponent(
    dataPath: string,
    onComplete?: Function
  ): Promise<boolean>
  /**
   * Navigates to the route component associated
   * with a data path.
   */
  navigateToRouteComponent(
    dataPath: string,
    onComplete?: Function
  ): Promise<boolean>

  // -- Resource (ResourceMixin) --

  /**
   * The resolved API resource for this component,
   * or `null` if none is configured.
   */
  resource: Resource | null
  /**
   * Whether loaded data is available on this
   * component.
   */
  hasData: boolean
  /**
   * Reloads data from the API without clearing
   * the existing data first.
   */
  reloadData(): void
  /**
   * Ensures data is loaded: reloads if data
   * exists, otherwise loads fresh.
   */
  ensureData(): void
  /** Clears the loaded data. */
  clearData(): void
  /** Sets the component's loaded data directly. */
  setData(data: any): void
  /**
   * Creates a new data object with default values
   * from the schema. Optionally sets a `type`
   * property for polymorphic forms.
   */
  createData(
    schema: Component,
    type?: string
  ): Record<string, any>
}

export interface MenuSchema<$Item = any> {
  type: 'menu'
  /**
   * The label shown in the navigation menu.
   */
  label?: string
  /**
   * The name of the menu group.
   *
   * @defaultValue Camelized from `label`.
   */
  name?: string
  /** Sub-views shown as menu items under this group. */
  items: Record<string, OrPromiseOf<View<$Item>>>
}

export type ClipboardConfig =
  | boolean
  | {
      copy?: (context: DitoContext) => unknown
      paste?: (context: DitoContext) => unknown
    }

export type View<$Item = any> =
  | ViewSchema<$Item>
  | MenuSchema<$Item>

export interface ViewSchema<$Item = any> extends SchemaRoute<$Item> {
  type: 'view'
  /**
   * The label shown in the navigation menu.
   *
   * @defaultValue The title-cased view name.
   */
  label?: string
  /**
   * The URL path for the view.
   */
  path?: string
  /**
   * The name of the view.
   */
  name?: string
  /**
   * Display several schemas in different tabs within
   * the view.
   */
  tabs?: Record<
    string,
    Omit<ViewSchema<$Item>, 'tabs' | 'type'> & {
      type: 'tab'
      /**
       * Whether this tab is selected by default.
       */
      defaultTab?: OrItemAccessor<$Item, {}, boolean>
    }
  >
  /**
   * Grouped event handlers, equivalent to the
   * `on[A-Z]`-style callbacks on the view schema
   * (e.g. {@link ViewSchema.onOpen}).
   *
   * @see {@link SchemaFields.onInitialize} and
   * other `on`-prefixed properties for per-event
   * documentation.
   */
  events?: SchemaEvents<$Item> & {
    /**
     * Called when a collapsible schema section is
     * toggled open or closed.
     */
    open?: OpenEventHandler<$Item>
  }
  component?: Component<$Item>
  components?: Components<$Item>
}

/**
 * A non-visible component that computes a value and
 * stores it in the form data.
 */
export interface ComputedSchema<$Item = any>
  extends BaseSchema<$Item>,
    SchemaDataMixin<$Item> {
  /**
   * The type of the component.
   */
  type: 'computed'
}

/**
 * A non-visible component that fetches external data
 * and stores it in the form data.
 */
export interface DataSchema<$Item = any>
  extends BaseSchema<$Item>,
    SchemaDataMixin<$Item> {
  /**
   * The type of the component.
   */
  type: 'data'
}

export interface ObjectSchema<$Item = { [key: string]: any }>
  extends SchemaSourceMixin<$Item>,
    BaseSchema<$Item>,
    SchemaOpen<$Item> {
  /**
   * The type of the component.
   */
  type: 'object'
  /**
   * Grouped event handlers.
   */
  events?: {
    /**
     * Called when a collapsible inlined object is
     * toggled open or closed.
     */
    open?: OpenEventHandler<$Item>
  }
}

interface TreeSchema<$Item, $Type extends 'tree-list' | 'tree-object'>
  extends SchemaSourceMixin<$Item>,
    BaseSchema<$Item> {
  /**
   * The type of the component.
   */
  type: $Type
  /**
   * Nested tree schema describing the recursive
   * children of each node. The `name` property
   * identifies which data property holds the
   * children array.
   */
  children?: Omit<TreeListSchema<$Item>, 'type'> & {
    name: string
  }
  /**
   * Properties schema for tree nodes.
   */
  properties?: Record<string, Component<$Item>>
  /**
   * Whether child nodes are expanded by default.
   */
  open?: boolean
}

export type TreeListSchema<$Item = any> = TreeSchema<$Item, 'tree-list'>
export type TreeObjectSchema<$Item = any> = TreeSchema<$Item, 'tree-object'>
export type PanelSchema<$Item = any> = BaseSchema<$Item> & {
  /**
   * The type of the component.
   */
  type: 'panel'
  /**
   * The components within the panel.
   */
  components?: Components<$Item>
  /** Buttons rendered at the bottom of the panel. */
  buttons?: Buttons<$Item>
  /**
   * Buttons rendered in the panel header, next to the
   * title. Displayed at a smaller size.
   */
  panelButtons?: Buttons<$Item>
  /**
   * Whether the panel header sticks to the top of the
   * scroll container.
   *
   * @defaultValue `false`
   */
  sticky?: OrItemAccessor<$Item, {}, boolean>
}

export interface SpacerSchema<$Item = any> extends BaseSchema<$Item> {
  /**
   * The type of the component.
   */
  type: 'spacer'
}

export interface ProgressSchema<$Item = any>
  extends SchemaNumberMixin<$Item>,
    BaseSchema<$Item> {
  /**
   * The type of the component.
   */
  type: 'progress'
}

type NonSectionComponent<$Item = any> =
  | InputSchema<$Item>
  | RadioSchema<$Item>
  | CheckboxSchema<$Item>
  | CheckboxesSchema<$Item>
  | ColorSchema<$Item>
  | SelectSchema<$Item>
  | MultiselectSchema<$Item>
  | ListSchema<$Item>
  | TextareaSchema<$Item>
  | CodeSchema<$Item>
  | NumberSchema<$Item>
  | SliderSchema<$Item>
  | UploadSchema<$Item>
  | MarkupSchema<$Item>
  | ButtonSchema<$Item>
  | SwitchSchema<$Item>
  | DateSchema<$Item>
  | ComponentSchema<$Item>
  | LabelSchema<$Item>
  | HiddenSchema<$Item>
  | ObjectSchema<$Item>
  | TreeListSchema<$Item>
  | TreeObjectSchema<$Item>
  | ComputedSchema<$Item>
  | DataSchema<$Item>
  | SpacerSchema<$Item>
  | ProgressSchema<$Item>

export type Component<$Item = any> =
  | NonSectionComponent<$Item>
  | SectionSchema<$Item>

/**
 * Source components (list, object, tree) that contain nested
 * items with their own item type.
 */
export type SourceComponent<$Item = any> =
  | ListSchema<$Item>
  | ObjectSchema<$Item>
  | TreeListSchema<$Item>
  | TreeObjectSchema<$Item>

/**
 * Strips properties with `never` values from a type.
 */
type OmitNever<T> = {
  [K in keyof T as [T[K]] extends [never] ? never : K]: T[K]
} & {}

/**
 * Defines the components for a form or view.
 *
 * When you provide an `$Item` type, each component key must match
 * a property on that type, and callbacks receive a typed `item`
 * whose type depends on that property:
 *
 * - **Regular data fields** (e.g. `title: string`): callbacks
 *   receive the full parent item type.
 * - **Array fields** (e.g. `entries: Entry[]`): nested list or
 *   tree components use the array element type (`Entry`).
 * - **UI-only keys** (e.g. `viewButton: never`): for components
 *   like buttons, spacers, or sections that exist only in the UI
 *   and are not actual data fields. Declare these keys as `never`.
 *   They are omitted from `item` in callbacks.
 *
 * Only keys defined in `$Item` are allowed. Unknown keys are a
 * type error.
 *
 * @example
 * ```ts
 * type Entry = { id: number; title: string }
 *
 * type Item = {
 *   title: string
 *   entries: Entry[]
 *   viewButton: never   // UI-only key for a button
 *   details: never      // UI-only key for a section
 * }
 *
 * const components: Components<Item> = {
 *   // regular data field — callbacks receive Item
 *   title: { type: 'text' },
 *
 *   // array field — callbacks receive Entry, not Item
 *   entries: {
 *     type: 'list',
 *     form: {
 *       type: 'form',
 *       components: {
 *         title: {
 *           type: 'text',
 *           // item is typed as Entry, not Item
 *           onChange({ item }) { console.log(item.title) }
 *         }
 *       }
 *     }
 *   },
 *
 *   // UI-only key — item omits viewButton and details
 *   viewButton: {
 *     type: 'button',
 *     events: {
 *       click({ item }) { ... }
 *     }
 *   },
 *
 *   // UI-only key — sections group fields from the parent item
 *   details: {
 *     type: 'section',
 *     components: {
 *       title: { type: 'text' }
 *     }
 *   }
 * }
 * ```
 */
export type Components<$Item = any> = 0 extends 1 & $Item
  ? Record<string, Component>
  : {
      [K in keyof $Item]?: [$Item[K]] extends [never]
        ? NonSectionComponent<$Item> | SectionSchema<$Item>
        : $Item[K] extends (infer E)[]
          ? E extends Record<string, any>
            ? NonSectionComponent<E>
            : NonSectionComponent<$Item>
          : $Item[K] extends Record<string, any>
            ?
                | NonSectionComponent<$Item>
                | SectionSchema<$Item, $Item[K]>
            :
                | NonSectionComponent<$Item>
                | SectionSchema<$Item>
    }

export type Columns<$Item = any> = 0 extends 1 & $Item
  ? { [key: string]: ColumnSchema | undefined }
  : {
      [K in keyof $Item]?: ColumnSchema<$Item, $Item[K]>
    } & {
      [key: string]: ColumnSchema<$Item> | undefined
    }

export type Buttons<$Item> = Record<
  string,
  SetOptional<ButtonSchema<$Item>, 'type'>
>

export interface Form<$Item = any> extends SchemaRoute<$Item> {
  type: 'form'

  /**
   * The name of the item model produced by the form.
   */
  name?: OrItemAccessor<$Item, {}, string>
  /**
   * The label of the form.
   */
  label?: OrItemAccessor<$Item, {}, string | boolean>
  /**
   * Whether the form directly mutates the parent data instead
   * of working on a copy.
   *
   * @defaultValue `false`
   */
  mutate?: boolean
  /**
   * The property name used as the item's unique identifier.
   *
   * @defaultValue `'id'`
   */
  idKey?: string
  /**
   * Display several forms in different tabs within the form.
   */
  tabs?: Record<
    string,
    Omit<Form<$Item>, 'tabs' | 'type'> & {
      type: 'tab'
      /**
       * Whether this tab is selected by default.
       */
      defaultTab?: OrItemAccessor<$Item, {}, boolean>
    }
  >
  /** The form's field components. */
  components?: Components<$Item>
  /**
   * Grouped event handlers, equivalent to the
   * `on[A-Z]`-style callbacks on the form schema
   * (e.g. {@link Form.onOpen}).
   *
   * @see {@link SchemaFields.onInitialize} and
   * other `on`-prefixed properties for per-event
   * documentation.
   */
  events?: SchemaEvents<$Item> & {
    /**
     * Called when a collapsible schema section is
     * toggled open or closed.
     */
    open?: OpenEventHandler<$Item>
    /**
     * Called after a new item is successfully
     * created and persisted.
     */
    create?: ItemEventHandler<$Item>
    /**
     * Called after an existing item is successfully
     * submitted and persisted.
     */
    submit?: ItemEventHandler<$Item>
    /**
     * Called when a submit request fails. The
     * `error` property on the context contains the
     * request error.
     */
    error?: ErrorEventHandler<$Item>
  }
  /**
   * Called after a new item is successfully
   * created and persisted.
   */
  onCreate?: ItemEventHandler<$Item>
  /**
   * Called after an existing item is successfully
   * submitted and persisted.
   */
  onSubmit?: ItemEventHandler<$Item>
  /**
   * Called when a submit request fails. The
   * `error` property on the context contains the
   * request error.
   */
  onError?: ErrorEventHandler<$Item>
}

export type Resource =
  | string
  | RequireAtLeastOne<{
      path?: string
      method?: HTTPMethod
      data?: unknown
    }>

export class DitoAdmin<
  $Views extends Record<string, OrPromiseOf<View>> = Record<
    string,
    OrPromiseOf<View>
  >
> {
  /** The DOM element the admin is mounted to. */
  el: Element
  /** The resolved API configuration. */
  api: ApiConfig
  /** The Vue application instance. */
  app: import('vue').App
  /** Additional options passed at construction. */
  options: Record<string, any>

  constructor(
    element: Element | string,
    options?: {
      // `dito` contains the base and api settings passed from
      // `AdminController`
      dito?: DitoGlobal
      api?: ApiConfig
      views: OrFunctionReturning<OrPromiseOf<$Views>>
      login?: {
        additionalComponents?: Components
        redirectAfterLogin?: string
      }
      /**
       * Controls the loading spinner displayed in the
       * admin header. Set to `null` to disable it.
       */
      spinner?: {
        size?: string
        color?: string
      } | null
      [key: string]: any
    }
  )

  /**
   * Registers a custom component type with the admin.
   */
  register(
    type: OrArrayOf<string>,
    options: Record<string, unknown>
  ): VueComponent
}
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
/** @deprecated Use `HTTPMethod` instead. */
export type HTTPVerb = HTTPMethod

export type SchemaByType<$Item = any> = {
  'button': ButtonSchema<$Item>
  'checkbox': CheckboxSchema<$Item>
  'checkboxes': CheckboxesSchema<$Item>
  'code': CodeSchema<$Item>
  'color': ColorSchema<$Item>
  'component': ComponentSchema<$Item>
  'computed': ComputedSchema<$Item>
  'creditcard': InputSchema<$Item>
  'data': DataSchema<$Item>
  'date': DateSchema<$Item>
  'datetime': DateSchema<$Item>
  'domain': InputSchema<$Item>
  'email': InputSchema<$Item>
  'hostname': InputSchema<$Item>
  'integer': NumberSchema<$Item>
  'list': ListSchema<$Item>
  'markup': MarkupSchema<$Item>
  'multiselect': MultiselectSchema<$Item>
  'number': NumberSchema<$Item>
  'object': ObjectSchema<$Item>
  'password': InputSchema<$Item>
  'progress': ProgressSchema<$Item>
  'radio': RadioSchema<$Item>
  'select': SelectSchema<$Item>
  'slider': SliderSchema<$Item>
  'spacer': SpacerSchema<$Item>
  'submit': ButtonSchema<$Item>
  'switch': SwitchSchema<$Item>
  'tel': InputSchema<$Item>
  'text': InputSchema<$Item>
  'textarea': TextareaSchema<$Item>
  'time': DateSchema<$Item>
  'tree-list': TreeListSchema<$Item>
  'tree-object': TreeObjectSchema<$Item>
  'upload': UploadSchema<$Item>
  'url': InputSchema<$Item>
  'label': LabelSchema<$Item>
  'section': SectionSchema<$Item>
  'hidden': HiddenSchema<$Item>
  'unknown': never
}

export type OrRecordOf<T> = T | Record<string, T>
export type OrPromiseOf<T> = T | Promise<T>
export type OrFunctionReturning<T> = (() => T) | T
export type OrArrayOf<T> = T | T[]
export type Resolvable<T> = OrFunctionReturning<OrPromiseOf<OrRecordOf<T>>>

type WatchHandler<$Item> = (
  this: DitoComponentInstance<$Item>,
  value: any,
  oldValue: any
) => void

type WatchEntry<$Item> =
  | WatchHandler<$Item>
  | {
      handler: WatchHandler<$Item>
      deep?: boolean
      immediate?: boolean
    }

type WatchHandlers<$Item> = Record<string, WatchEntry<$Item>>

type LiteralUnion<T extends U, U = string> = T | (U & Record<never, never>)
