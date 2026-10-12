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
  const dito: GlobalConfig
  interface Window {
    dito: GlobalConfig
  }
}

export default DitoAdmin
export interface GlobalConfig {
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
  /**
   * Milliseconds after which the request is aborted.
   *
   * @defaultValue {@link ApiConfig.timeout}
   */
  timeout?: number | null
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
   * Milliseconds after which requests are aborted, so that
   * nothing waits for them forever, e.g. submitting forms for
   * pending loads of options. Requests can set their own.
   *
   * @defaultValue `null`, no timeout
   */
  timeout?: number | null
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
   * Computes and sets the field value reactively, also
   * when the field isn't rendered, unless its `if`
   * evaluates to `false`. If the callback returns
   * `undefined`, the current value is preserved. The
   * value is computed into the data, which is what is
   * displayed and saved. As the callback runs whenever
   * the data it reads changes, it should only return a
   * value and not change data.
   *
   * As it doesn't depend on the field's component, the
   * context's members that depend on components, e.g.
   * `listQuery`, refer to the form, view or dialog that
   * holds the data, not to the field.
   *
   * Reading `context.options` waits while the options
   * load, and is `undefined` when the load fails or its
   * data resolves to nothing, so use `options?.`.
   */
  compute?: ItemAccessor<$Item>
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
  rules?: SchemaRules
}

/**
 * Validation rules shared by all schemas, extended by the individual types.
 */
export interface SchemaRules {
  /** Override whether the field is required. */
  required?: boolean
}

/**
 * Return false to mark event as handled and stop it from propagating to parent
 * schemas.
 */
// Handlers can be async, as events are awaited, e.g. by buttons that show
// their progress while their `click` handler runs.
export type ItemEventHandler<$Item = any> = (
  itemParams: SchemaContext<$Item>
) => void | false | Promise<void | false>

export type OpenEventHandler<$Item = any> = (
  itemParams: SchemaContext<$Item> & { open: boolean }
) => void | false

export type ErrorEventHandler<$Item = any> = (
  itemParams: SchemaContext<$Item> & { error: Error }
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
  events?: BaseSchemaEvents<$Item>
}

/**
 * Grouped event handlers shared by all schemas, extended by the individual
 * types.
 */
export interface BaseSchemaEvents<$Item> extends SchemaEvents<$Item> {
  /** @see {@link BaseSchema.onFocus} */
  focus?: ItemEventHandler<$Item>
  /** @see {@link BaseSchema.onBlur} */
  blur?: ItemEventHandler<$Item>
  /** @see {@link BaseSchema.onInput} */
  input?: ItemEventHandler<$Item>
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
   * Labels are HTML: Callbacks return HTML, and need to
   * escape the item values that they include with
   * `escapeHtml()` from `@ditojs/utils`.
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
   * The key under which primitive values are wrapped in objects, so that the
   * source's forms can edit them, e.g. `'value'` for a list of strings. Routed
   * forms can't `mutate` them.
   */
  wrapPrimitives?: string
  /**
   * Whether the forms of the source's items directly mutate the source's data
   * instead of editing a copy that is applied when submitting. Forms that
   * mutate data are never dirty.
   *
   * @defaultValue `false`
   */
  mutate?: boolean
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
  creatable?: OrItemAccessor<
    $Item,
    {},
    | boolean
    | {
        label?: string
        /**
         * Returns additional query parameters to include in the
         * URL when navigating to the create form.
         */
        query?: (context: SchemaContext) => Record<string, any>
      }
  >
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
   * when the `draggable` property of the list schema is set to `true`. Items
   * are numbered when the data is loaded, and when they are added, removed or
   * reordered.
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
       * receives the `SchemaContext` and returns an inner
       * function that is called to fetch the actual data,
       * enabling reactive dependency tracking.
       *
       * The options are loaded independently of the
       * field's component, also for computes, so the
       * context's members that depend on components, e.g.
       * `listQuery`, refer to the form, view or dialog that
       * holds the data, not to the field.
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
       * @deprecated Not supported, the options are grouped by the `groupBy`
       * setting of the component's schema, see
       * {@link SchemaOptionsMixin.groupBy}.
       */
      groupBy?: keyof $Option
      /**
       * Custom equality function for matching a value to an
       * option. Receives a context with `value` and `option`.
       */
      equals?: (
        context: SchemaContext & {
          value: any
          option: $Option
        }
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
   * group the options. Selects and multiselects show the groups
   * in their dropdowns, radio buttons and checkboxes list each
   * group in a fieldset with the group's name as its legend.
   */
  groupBy?: OrItemAccessor<$Item, {}, string>
  /**
   * When defined, a search input field will be added to allow
   * searching for specific options.
   */
  search?:
    | ItemAccessor<$Item, {}, OrPromiseOf<$Option[]>>
    | {
        /**
         * Filters options based on the `searchTerm`
         * available in the context. Returns matching
         * options, optionally as a promise.
         */
        filter?: ItemAccessor<$Item, {}, OrPromiseOf<$Option[]>>
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
   * to its form in the view of `view`. Radio buttons and checkboxes
   * show an edit button for each of their options.
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
   * The maximum amount of decimals allowed, validated on input.
   */
  decimals?: OrItemAccessor<$Item, {}, number>
  /** Validation rules for numeric constraints. */
  rules?: SchemaRules &
    Omit<SchemaNumberMixin<$Item>, 'rules'> & {
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
  data?: OrItemAccessor<$Item, {}, Record<string, any>>
  /**
   * Path to retrieve data from parent context.
   */
  dataPath?: string
}

/**
 * Properties shared by all schemas that support panels
 * and lifecycle events — component schemas, views, and
 * forms.
 */
export interface SchemaFields<$Item> {
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
   * Fires after all reactive updates have propagated,
   * once the values derived from the data are written,
   * including the ones that depend on options to load.
   */
  onLoad?: ItemEventHandler<$Item>
  /**
   * Called after a value change is committed. Fires
   * after all reactive updates have propagated, once the
   * values derived from the change are written, including
   * the ones that depend on options to load. Bubbles to
   * parent schemas — return `false` to stop propagation.
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
   * copy/paste handlers. Pasted data replaces the
   * values of the schema as new items, without the
   * values of sources with their own resource.
   */
  clipboard?: ClipboardConfig
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
   * like this: import(...). It receives the props of
   * {@link CustomComponentProps}, and emits the events of
   * {@link CustomComponentEmits}.
   */
  component: Resolvable<VueComponent>
}

/**
 * The props of the custom components of `type: 'component'` schemas. Their
 * root element gets the id that the label of the component points to.
 */
export interface CustomComponentProps<$Item = any, $Value = any> {
  /** The schema of the component, see {@link getSchemaValue}. */
  schema: ComponentSchema<$Item>
  /** The context of the component, which follows the changes of its data. */
  context: SchemaContext<$Item>
  /** The value of the component, after `format()`. */
  modelValue: $Value
  /** The id of the element that displays the errors, while there are any. */
  errorsElementId?: string | null
}

/** The events of the custom components of `type: 'component'` schemas. */
export interface CustomComponentEmits<$Value = any> {
  /** Changes the value of the component, through `parse()`. */
  'update:modelValue': (value: $Value) => void
  /** Ends the change of the value, which emits the schema's `change` event. */
  'change': () => void
  /** Emit the schema's events, and `blur` validates the value. */
  'focus'?: () => void
  'blur'?: () => void
  'input'?: () => void
}

/**
 * Returns the value of `key` in the schema of a custom component, calling it
 * with the component's `context` if it's a function.
 */
export function getSchemaValue<$Item = any>(
  schema: Record<string, any>,
  key: string,
  context: SchemaContext<$Item>
): any

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
  rules?: SchemaRules & {
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
   * @deprecated Use `formats.date` instead. `dateFormat` is no longer read and
   * has no effect.
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
  events?: BaseSchemaEvents<$Item> & {
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
  // `rules` comes from `SchemaNumberMixin`, which extends `SchemaRules`.
  extends SchemaNumberMixin<$Item>,
    Omit<BaseSchema<$Item>, 'rules'>,
    SchemaAffixMixin<$Item> {
  /**
   * The type of the component.
   */
  type: 'number' | 'integer'
}

export interface SliderSchema<$Item = any>
  // `rules` comes from `SchemaNumberMixin`, which extends `SchemaRules`.
  extends SchemaNumberMixin<$Item>,
    Omit<BaseSchema<$Item>, 'rules'> {
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
    /**
     * The heading levels to support, or `true` for all levels.
     */
    heading?: true | (1 | 2 | 3 | 4 | 5 | 6)[]
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
   * like `'200kB'`, `'1MB'`, `'3.2GB'`, etc., using base 10 (1 kB = 1000
   * bytes). IEC units like `'1MiB'` use base 2 (1 KiB = 1024 bytes).
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

type SectionContent<$Data, $Item = $Data> = {
  /**
   * The section's field components, or a callback that
   * creates them from the data, e.g. fields that depend on
   * a selected template. The callback runs again when the
   * data that it reads changes, and receives the context of
   * the section, so that `item` is the item that contains
   * it, also for nested sections.
   */
  components?:
    | Components<$Data>
    | ItemAccessor<$Item, {}, Components<$Data>>
  /**
   * A form schema for the section's content. Use this
   * instead of `components` to get form-level options
   * like `label` and `tabs`.
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
      } & SectionContent<$Nested, $Item>)
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
   * Whether multiple values can be selected.
   *
   * @defaultValue `true`
   */
  multiple?: boolean
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
  // `format` is the color format here, not the formatting function of
  // `BaseSchema`.
  extends Omit<BaseSchema<$Item>, 'format'>,
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
  events?: BaseSchemaEvents<$Item> & {
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
> = (params: Merge<SchemaContext<$Item>, $Params>) => $ReturnValue

/** The user that is logged in to the admin. */
export interface AdminUser {
  roles?: string[]
  hasRole(...roles: string[]): boolean
}

export type SchemaContext<$Item = any> = {
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
   * Data path of the parent item ancestor, `null` for
   * root items.
   */
  parentItemDataPath: string | null
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
   * The item processed for the server, built when it's
   * read. In `process` callbacks, the item that is being
   * processed, allowing modification of sibling fields.
   */
  processedItem: any
  /**
   * The root item processed for the server, built when
   * it's read. In nested forms, with the draft in place
   * of the item, like `rootItem`.
   */
  processedRootItem: any
  /**
   * The form's current data processed for clipboard
   * copy/paste operations.
   */
  clipboardItem: any
  /** The currently authenticated user, `null` when logged out. */
  user: AdminUser | null
  /** The admin API configuration. */
  api: ApiConfig
  /** The schema definition for the current component. */
  schema: Component | null
  /** All registered top-level views. */
  views: Record<string, View>
  /** All views flattened into a single record. */
  flattenedViews: Record<string, ViewSchema>
  /**
   * Display label of the current item, as HTML with
   * escaped item values.
   */
  itemLabel: string | null
  /**
   * The text of `itemLabel`, with its item values
   * unescaped.
   */
  itemLabelText: string | null
  /** Display label of the current form. */
  formLabel: string | null
  /** The currently focused option in a select. */
  option: any
  /**
   * All available options in a select. In `compute()`, they are
   * loaded when first read, also when the field isn't rendered.
   * Reading them while they load ends the callback, which keeps
   * the current value and runs again once they are loaded, so
   * they are always available in it.
   */
  options: any
  /**
   * Whether the option that `options.label()` labels is
   * selected: the shown value, e.g. of a closed multiselect
   * or its tags, and the selected entries in the open list.
   */
  isSelected: boolean
  /**
   * Whether a collapsible schema opens, in its `open`
   * event.
   */
  open: boolean | undefined
  /**
   * The current search term in select components.
   */
  searchTerm: string
  /**
   * Whether a button request is currently running.
   */
  isRunning: boolean
  /**
   * Whether the data has unsaved changes: the data of the
   * form, view, dialog or panel with its own data that the
   * context belongs to. Nested forms tell their own,
   * unless they mutate the item of their parent.
   */
  isDirty: boolean
  /**
   * Whether the form creates a new item, `false` outside
   * of forms, e.g. in dialogs and panels with their own
   * data.
   */
  isCreating: boolean
  /**
   * The name of the selected tab of the nearest form, `null`
   * without tabs.
   */
  selectedTab: string | null
  /** Current URL query parameters. */
  routeQuery: Record<string, string | (string | null)[]>
  /**
   * The query of the nearest list, e.g. its scope, page,
   * order and filters, or `null` outside of lists.
   */
  listQuery: Record<string, any> | null
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
  /** Returns the URL of a route location. */
  getRouteUrl(location: Parameters<VueRouter['resolve']>[0]): string
  /**
   * Submits the data through the button that the context
   * belongs to, like buttons with a resource do when
   * clicked: through its list or other source, or else to
   * its form, which saves its data or applies it to its
   * parent. Resolves with whether it succeeded. Throws
   * outside of buttons of sources and forms.
   */
  submit(options?: {
    validate?: boolean
    closeForm?: boolean
  }): Promise<boolean>
  /**
   * Closes the form, navigating to its parent route.
   * Throws outside of forms.
   */
  closeForm(): Promise<unknown>
  /**
   * Triggers a file download from the given URL or
   * options.
   */
  download: {
    (url: string): void
    (options: { url: string; filename: string }): void
  }
  /**
   * Returns the full URL for a given resource, resolved
   * relative to the nearest resource. Without one, returns
   * the URL of the nearest form or list with a resource:
   * of the item that the form edits, or of the collection
   * that the list loads or the form creates its item in.
   * Throws without such a form or list.
   */
  getResourceUrl(resource?: Resource): string
  /**
   * Validates the data of the form, view, dialog or panel
   * with its own data that the context belongs to, or only
   * the values whose data paths match `match`, and shows
   * their errors. Returns whether they are valid.
   */
  validate(
    match?: string | string[] | RegExp | ((dataPath: string) => boolean)
  ): boolean
  /**
   * Like {@link SchemaContext.validate}, but without showing
   * the errors.
   */
  verify(
    match?: string | string[] | RegExp | ((dataPath: string) => boolean)
  ): boolean
  /**
   * Marks the data of the form, view, dialog or panel with
   * its own data as edited, e.g. after changing it
   * directly.
   */
  markEdited(): void
  /**
   * Sets `data`, e.g. the response of a request, as the
   * data of the form, view, dialog or panel with its own
   * data, and returns it. Forms merge it into their item,
   * the others replace their data with it and set up its
   * defaults.
   */
  replaceItem(data: Record<string, any>): $Item
  /**
   * Shows a modal dialog and resolves with the value that
   * it's closed with: its data when submitted, `undefined`
   * when cancelled, or the value of `closeDialog()`.
   */
  showDialog(
    schema: {
      components?: Components
      buttons?: Buttons<any>
    },
    options?: {
      data?: Record<string, any>
      settings?: Record<string, any>
    }
  ): Promise<unknown>
  /**
   * Closes the dialog that the context belongs to, and
   * resolves `showDialog()` with `value`. Throws outside
   * of dialogs.
   */
  closeDialog(value?: unknown): void
  /**
   * Displays a notification to the user, with the
   * paragraphs of either `text` or `html`.
   */
  notify(
    options: {
      /** Notification style. @defaultValue `'info'` */
      type?: LiteralUnion<'warning' | 'error' | 'info' | 'success'>
      /**
       * Heading text, escaped like `text`. Defaults to
       * a label matching `type`.
       */
      title?: string
      /**
       * The original error object. When `type` is
       * `'error'`, this is logged to the console
       * alongside the message.
       */
      error?: unknown
      /**
       * Display duration in milliseconds. When omitted,
       * calculated automatically from content length.
       * Use `0` for sticky.
       */
      duration?: number
    } & (
      | {
          /**
           * Body text, escaped as plain text. Each entry
           * is a paragraph, newlines become `<br>`, and
           * `false` and `null` entries are skipped.
           */
          text: OrArrayOf<string | false | null>
          html?: never
        }
      | {
          /**
           * Body HTML from trusted sources, rendered as
           * it is. Every interpolated value must be
           * escaped with `escapeHtml()` from
           * `@ditojs/utils`. Each entry is a paragraph,
           * newlines become `<br>`, and `false` and
           * `null` entries are skipped.
           */
          html: OrArrayOf<string | false | null>
          text?: never
        }
    )
  ): void
}

/**
 * The context of the admin, provided once to all its components as
 * `adminContext`. `user`, `views` and `flattenedViews` change with each login,
 * and are reactive.
 */
export interface AdminContext {
  /** The admin API configuration. */
  readonly api: ApiConfig
  readonly router: VueRouter
  /** Logs users in and out through the `api.users` resources. */
  readonly session: {
    /** The logged in user, `null` when logged out. */
    readonly user: SchemaContext['user']
    /**
     * Asks for the credentials and logs in, again after
     * each failure, until it succeeds or the user cancels.
     */
    login(): Promise<SchemaContext['user']>
    logout(): Promise<void>
    /** Fetches the user of the server's session. */
    fetchUser(): Promise<SchemaContext['user']>
    /** Asks to log in if the session expired. */
    ensureUser(): Promise<void>
  }
  /** The logged in user, `null` when logged out. */
  readonly user: SchemaContext['user']
  /** All registered top-level views. */
  readonly views: Record<string, View>
  /** All views flattened into a single record. */
  readonly flattenedViews: Record<string, ViewSchema>
  /** Tracks the pending requests of the whole admin. */
  readonly loadingTracker: LoadingTracker
  /** The rendered routes and components, to reveal and focus them. */
  readonly ui: UiRegistry
  showDialog: SchemaContext['showDialog']
  notify: SchemaContext['notify']
  /** Closes all notification toasts. */
  closeNotifications(): void
}

/** What a rendered component offers to reveal and focus it. */
export interface UiHandle {
  /** The context of the data that the component displays. */
  readonly dataContext: DataContext | null
  /**
   * Renders what leads to the component at `componentPath` inside this one,
   * e.g. opens a collapsed schema and renders its tab, which `focus` also
   * selects.
   */
  reveal?(componentPath: string, options: { focus: boolean }): Promise<void>
  /** Focuses the element of the component, once it's revealed. */
  focus?(): void
}

/**
 * The handles of the rendered components by component path, and the contexts
 * of the rendered routes, as `admin.ui`.
 */
export interface UiRegistry {
  /** The contexts of the rendered routes by level. Reactive. */
  readonly routes: readonly RouteContext[]
  /**
   * Registers `handle` under the component path, and again under the new one
   * whenever it changes. Returns the function that unregisters it.
   */
  register(getComponentPath: () => string, handle: UiHandle): () => void
  /**
   * Returns the handles at `componentPath`, of all data contexts or of
   * `dataContext`, the outer ones first.
   */
  getHandles(
    componentPath: string,
    dataContext?: DataContext | null
  ): UiHandle[]
  /**
   * Reveals the component at `componentPath` in `dataContext`, by asking the
   * components on the way from the outside in, and with `focus`, focuses it.
   */
  reveal(
    dataContext: DataContext | null,
    componentPath: string,
    options?: { focus?: boolean }
  ): Promise<void>
}

/**
 * The context of a view, form, dialog or panel with its own data, provided
 * to the components that display its data as `dataContext`. Its members are
 * reactive.
 */
export interface DataContext {
  /**
   * The data model that holds the data, which is the model of the parent
   * for forms that mutate the item of their parent.
   */
  readonly model: DataModel
  /** See {@link DataModel.isDirty}. */
  readonly isDirty: boolean
  /** See {@link DataModel.isEdited}. */
  readonly isEdited: boolean
  /** Whether the form creates a new item, `false` outside of forms. */
  readonly isCreating: boolean
  /**
   * Whether the data is there to display: forms load or create their item,
   * the others always have their data.
   */
  readonly hasData: boolean
  validate: SchemaContext['validate']
  verify: SchemaContext['verify']
  /**
   * Shows the validation errors of the server for the data that was sent,
   * keyed by data paths relative to `dataPath`, by default the root data, and
   * reveals them.
   */
  showValidationErrors(
    errors: Record<string, ValidationError[]>,
    dataPath?: string
  ): Promise<void>
  /**
   * Reveals the errors of the data, opening the forms, collapsed schemas and
   * tabs that display them, and focuses the first one.
   */
  revealErrors(): Promise<void>
  markEdited: SchemaContext['markEdited']
  replaceItem: SchemaContext['replaceItem']
}

/** The context that dialogs provide as `dataContext`. */
export interface DialogContext extends DataContext {
  /** Closes the dialog, and resolves `showDialog()` with `value`. */
  close(value?: unknown): void
}

/**
 * The context of a view or form, provided to the components that it renders
 * as `routeContext`. Its members are reactive.
 */
export interface RouteContext {
  /** The context of the route of the parent form or view. */
  readonly parent: RouteContext | null
  /** The context of the data of the view or form. */
  readonly dataContext: DataContext
  /** The schema of the data that the route renders. */
  readonly schema: Component | null
  /** The data path of the data, relative to `rootData`. */
  readonly dataPath: string
  /**
   * The data that the data paths of the route are relative to, e.g. the
   * draft root of nested forms.
   */
  readonly rootData: Record<string, any> | null
  readonly componentPath: string
  /**
   * Tracks the requests of the view, along with the ones of the resources of
   * its forms.
   */
  readonly loadingTracker: LoadingTracker
  /** The depth of the route, starting at `0` for views. */
  readonly level: number
  readonly isForm: boolean
  /**
   * The state that the routes below depend on: the data, the parameters of
   * the route, and whether its sources are transient, e.g. in forms that
   * create their item.
   */
  readonly state: {
    data: any
    routeParams: Record<string, any>
    isTransient: boolean
  }
  readonly path: string
  /** Whether the route is the last one of the current route. */
  readonly isLastRoute: boolean
  /** Whether the route is being left, until its view or form is unmounted. */
  readonly isLeaving: boolean
  /**
   * Whether leaving the route loses changes. Forms that edit the item of their
   * parent leave their changes in the parent's data.
   */
  readonly isDirty: boolean
  /** The text of the route in the breadcrumb trail. */
  readonly breadcrumb: string
  /** The name of the selected tab, `null` without tabs. */
  readonly selectedTab: string | null
  /**
   * Action verb labels of the form, with the transient ones in nested data,
   * e.g. `apply`.
   */
  readonly verbs: Record<string, string>
  /**
   * The resource of the form, or else of the nearest form above with a
   * resource, which the resources of its components and nested forms
   * continue, `null` in views.
   */
  readonly resourceContext: ResourceContext | null
  /**
   * Resolves the path of the form that edits the item at `dataPath`, or
   * `null`.
   */
  getFormPath(dataPath: string): string | null
  /**
   * Resolves the path of the deepest form that edits the data at
   * `dataPath`, along with the data path that remains within that form,
   * or `null`.
   */
  getFormRoute(dataPath: string): { path: string; dataPath: string } | null
  /**
   * Resolves the path of the form that creates an item of the source at
   * `dataPath`, or `null`.
   */
  getCreatePath(dataPath: string): string | null
  /**
   * Closes the form, navigating to the route of its parent. Throws for
   * views.
   */
  close(): Promise<unknown>
  /**
   * Submits the data of the form through `button`: forms with a resource
   * save it, the others apply it to their parent. Resolves with whether it
   * succeeded. Throws for views.
   */
  submit(
    button: SubmitButton,
    options?: { validate?: boolean; closeForm?: boolean }
  ): Promise<boolean>
}

/**
 * The context of a list, object or tree, provided to the components that
 * display it and its items as `sourceContext`. Its members are reactive.
 */
export interface SourceContext {
  readonly schema: Component
  /** The query of lists, e.g. their scope, page, order and filters. */
  readonly query: Record<string, any>
  /** Navigates lists to other queries. */
  readonly listQuery: {
    readonly query: Record<string, any>
    update(
      changes: Record<string, any>,
      options?: { resetPage?: boolean }
    ): Promise<unknown>
  }
  readonly dataPath: string
  readonly componentPath: string
  readonly store: Record<string, any>
  readonly isDisabled: boolean
  /**
   * Creates an item with the form `schema`, of `type` if the source has
   * several forms, inserts it at `index`, or else at the end, and returns it.
   */
  createItem(schema: Form, type?: string | null, index?: number | null): any
  /**
   * The label of `item` as the source shows it: an object for inlined items,
   * HTML for others, through `render()` if the source has it.
   */
  getSourceItemLabel(item: any, index?: number | null): any
  /** Loads the data of the source again, e.g. after its item was saved. */
  reload(): void
  /**
   * Submits the data of the source through `button`, to the resource of the
   * button, continuing the one of the source. Resolves with whether it
   * succeeded.
   */
  submit(button: SubmitButton): Promise<boolean>
  /** Action verb labels, with the transient ones in nested data. */
  readonly verbs: Record<string, string>
  /**
   * The resource of the source, `null` without a resource of its own, see
   * {@link ResourceContext}.
   */
  readonly resourceContext: ResourceContext | null
}

/**
 * The context of a form or source with a resource of its own, provided to the
 * components that it renders as `resourceContext`. Components see the nearest
 * one, e.g. the one of the form in its inlined lists, which loads the data that
 * they display.
 */
export interface ResourceContext {
  /**
   * Returns the resource of the form or source: of the item of forms, and the
   * collection of sources.
   */
  getResource(options?: {
    method?: HTTPMethod
    child?: Resource | null
  }): Resource | null
  /** Submits the data through `button`, resolving with whether it succeeded. */
  submit(
    button: SubmitButton,
    options?: { validate?: boolean; closeForm?: boolean }
  ): Promise<boolean>
}

/**
 * The button that submits the data of a form or source, and receives the
 * `success` and `error` events of the submit.
 */
export interface SubmitButton {
  readonly schema: ButtonSchema<any>
  readonly context: SchemaContext
  /** Whether the form closes after the submit. */
  readonly closeForm: boolean
  createContext(values?: Record<string, any>): SchemaContext
  getSchemaValue(keyOrDataPath: string | string[], options?: object): any
  emitEvent(
    event: string,
    options?: { context?: Record<string, any> | SchemaContext }
  ): Promise<any>
}

/**
 * Counts the pending operations of a scope, e.g. the
 * requests of a resource component, of all components
 * in a view, or of the whole admin, and forwards them
 * to the tracker of the enclosing scope.
 */
export interface LoadingTracker {
  /** The tracker of the enclosing scope, if any. */
  readonly parent: LoadingTracker | null
  /** The tracker of the outermost scope. */
  readonly root: LoadingTracker
  /** Whether any operation within the scope is pending. */
  readonly isLoading: boolean
  /**
   * Begins an operation in this scope and its enclosing
   * ones, and returns the function that ends it.
   */
  begin(): () => void
  /**
   * Tracks the operation that `callback()` performs until
   * its returned promise settles, and returns its result.
   */
  track<T>(callback: () => T | Promise<T>): Promise<T>
}

/**
 * A list that the change API of `DataModel` changes, with the schema
 * that numbers its items by its `orderKey`, and its data path, which tells
 * the source with its own resource that the change belongs to, if any.
 */
export interface ListEntry {
  schema: Record<string, any>
  list: any[]
  dataPath: string
}

/**
 * The data model of a view, form, dialog or panel with its own data.
 * Components write the data through its change API, which marks the data
 * edited until it's replaced or saved, if the write changes the value.
 * Direct writes don't mark it.
 */
export interface DataModel {
  /**
   * Whether the data has edits that can be saved: of the component if it
   * has a button of type `submit`, and of the lists of sources with their
   * own resource and such a button, which include the changes inside them.
   */
  readonly isDirty: boolean
  /** Whether the data was edited, also where it can't be saved. */
  readonly isEdited: boolean
  /** Marks the data edited, e.g. after writing it directly. */
  markEdited(): void
  /**
   * The number of the last edit. Saves read it when they start, to only
   * clean the edits that they carried, see `markClean()`.
   */
  readonly editCount: number
  /**
   * Marks the data clean, e.g. once it's saved, or only the edits of the
   * source with its own resource at `dataPath`, once the source saved them.
   * With `editCount`, only the edits up to it are cleaned.
   */
  markClean(options?: { dataPath?: string | null; editCount?: number }): void
  /**
   * Merges `data` from the server, e.g. the response of a save,
   * into the data in place, so that its objects keep their
   * identity, along with their uids, item stores, open forms and
   * errors. The data of sources with their own resource is kept.
   * Values missing in `data` are removed. Returns the merged
   * data, which isn't dirty, apart from the edits of sources with
   * their own resource.
   */
  mergeFromServer(data: object): object
  /**
   * Sets `data[key]` to `value`, an edit if the value changes. Values equal
   * to the current one are not written, so it keeps its identity.
   */
  set(data: object, key: string | number, value: any): void
  /** Inserts `item` into the list of `entry` at `index`. */
  insert(entry: ListEntry, index: number, item: any): void
  /** Removes the item at `index` from the list of `entry`. */
  remove(entry: ListEntry, index: number): void
  /** Moves the item at `from` in the list of `entry` to `to`. */
  move(entry: ListEntry, from: number, to: number): void
  /** Replaces the items of the list of `entry` with `items`, in place. */
  replaceItems(entry: ListEntry, items: any[]): void
  /**
   * Returns the errors of the value at `dataPath`, of validation and of
   * the server, in the format of the server, or `null`. Errors are kept
   * by the data that holds the value and its name, so they stay with
   * items that move. They only apply while it's the value that they were
   * set for.
   */
  getErrors(dataPath: string): ValidationError[] | null
  /**
   * Returns the error messages of the field itself at `dataPath`, e.g. of
   * options that failed to load, or `null`.
   */
  getFieldErrors(dataPath: string): string[] | null
  /**
   * Replaces the validation errors of the value of the field at
   * `dataPath`. The errors of the server stay while the value does.
   */
  setErrors(dataPath: string, errors: ValidationError[] | null): void
  /**
   * Adds an error message to the field rather than to its value,
   * unless it has it already. It stays until it's removed.
   */
  addError(dataPath: string, message: string): void
  /** Removes an error message from the field. */
  removeError(dataPath: string, message: string): void
  /**
   * Replaces the validation errors, or with `server` the ones of
   * the server, of the values within `dataPath` with `errors`,
   * keyed by data path, and returns the ones of fields that aren't
   * displayed, or `null`.
   */
  replaceErrors(
    errors: Record<string, ValidationError[]>,
    options?: { dataPath?: string; server?: boolean }
  ): Record<string, ValidationError[]> | null
  /**
   * Clears the errors of the values within `dataPath`, of
   * validation and of the server. The errors of fields stay.
   */
  clearErrors(dataPath?: string): void
  /** Returns the data paths of the fields within `dataPath` with errors. */
  getErrorDataPaths(dataPath?: string): string[]
  /**
   * Whether `data` or the data nested in it holds values with
   * errors, also where they aren't displayed.
   */
  hasErrorsWithin(data: object): boolean
}

/** A validation error, as validation and the server return them. */
export interface ValidationError {
  message: string
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
      copy?: (context: SchemaContext) => unknown
      /**
       * Receives the copied data as `clipboardItem`, and
       * returns the data to paste.
       */
      paste?: (context: SchemaContext) => unknown
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
  events?: BaseSchemaEvents<$Item> & {
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
   * The properties shown for tree nodes, displayed like the columns of
   * lists.
   */
  properties?: Columns<$Item>
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
   * The panel's own data, e.g. of filters, instead of
   * the data of its form or view. Its edits don't make
   * the form or view dirty. It's the `item` of the
   * contexts inside the panel, and `rootItem` stays the
   * root data of the page, while `data()`, `if`,
   * `visible`, `label` and `sticky` receive the context of
   * the data around the panel.
   */
  data?: OrItemAccessor<$Item, {}, Record<string, any>>
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
  // `rules` comes from `SchemaNumberMixin`, which extends `SchemaRules`.
  extends SchemaNumberMixin<$Item>,
    Omit<BaseSchema<$Item>, 'rules'> {
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
  | PanelSchema<$Item>

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
 * Field components that don't have an options mixin (excludes
 * select, multiselect, and source components like list/object/tree).
 */
type NonOptionFieldComponent<$Item = any> = Exclude<
  NonSectionComponent<$Item>,
  SelectSchema<$Item> | MultiselectSchema<$Item> | SourceComponent<$Item>
>

/**
 * Select/multiselect with a typed `$Option` for option callbacks.
 *
 * Note: This is intentionally an intersection type rather than
 * `SelectSchema<$Item, $Option> | MultiselectSchema<$Item, $Option>`,
 * because using the full interfaces in a union breaks TypeScript's
 * contextual typing for callbacks in the `Components` mapped type.
 */
type OptionComponent<$Item, $Option> = BaseSchema<$Item> &
  SchemaOptionsMixin<$Item, $Option> &
  SchemaAffixMixin<$Item> &
  Pick<
    MultiselectSchema,
    'multiple' | 'searchable' | 'stayOpen' | 'taggable'
  > & { type: 'select' | 'multiselect' }

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
        ? // Sections and panels that share the data of their schema.
          NonSectionComponent<$Item> | SectionSchema<$Item> | PanelSchema<$Item>
        : NonNullable<$Item[K]> extends (infer E)[]
          ? E extends Record<string, any>
            ? NonSectionComponent<E>
            : // Lists of primitive values edit them wrapped in objects under
              // the key given by `wrapPrimitives`.
              NonSectionComponent<Record<string, E>>
          : NonNullable<$Item[K]> extends Record<string, any>
            ?
                | NonOptionFieldComponent<$Item>
                | OptionComponent<$Item, NonNullable<$Item[K]>>
                | SourceComponent<NonNullable<$Item[K]>>
                | SectionSchema<$Item, NonNullable<$Item[K]>>
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
  /** The context of the admin, provided to all its components. */
  context: AdminContext
  /** The Vue application instance. */
  app: import('vue').App
  /** Additional options passed at construction. */
  options: Record<string, any>

  constructor(
    element: Element | string,
    options?: {
      // `dito` contains the base and api settings passed from
      // `AdminController`
      dito?: GlobalConfig
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
}

/**
 * Wraps the primitive values of a list in objects for the forms of its items
 * to edit them, and unwraps them again.
 */
export interface ItemAdapter {
  /**
   * The name of the component that edits the value. It shares the data path
   * of the item.
   */
  readonly name: string
  wrap(value: any): Record<string, any>
  unwrap(item: Record<string, any>): any
}

/**
 * Describes a type of schema components: the component that renders it, and
 * how the admin handles its schemas and values, also when they aren't
 * rendered. Its options tell the admin what to do for the type, as verb
 * phrases, and the defaults of schema settings start with `default`.
 */
export interface TypeDescriptor {
  /** The type, or the types that share the descriptor. */
  readonly type: string | string[]
  readonly component: VueComponent
  /**
   * The default of `default`, `null` if not set. Functions are called with
   * the context of the component and return the default.
   */
  readonly defaultValue?: any
  /** The default of `nested`, `true` if not set. */
  readonly defaultNested?: boolean
  /** The default of `visible`, `true` if not set. */
  readonly defaultVisible?: boolean
  /** The default of `multiple`. */
  readonly defaultMultiple?: boolean
  /** The default of `width`. */
  readonly defaultWidth?: string | number
  /** The default of `exclude`. */
  readonly excludeValue?: boolean | ((context: SchemaContext) => boolean)
  /** Don't give values that are missing their defaults, e.g. passwords. */
  readonly ignoreMissingValue?: (context: SchemaContext) => boolean
  /** Give values that are `null` their defaults, e.g. nested sections. */
  readonly treatNullAsMissing?: (context: SchemaContext) => boolean
  /** Resolve the value from `schema.data` or `schema.dataPath`. */
  readonly resolveValue?: boolean
  /** Generate a label from the name for components without `label`. */
  readonly generateLabel?: boolean
  /** Omit the label of the container, as the component displays it. */
  readonly omitLabel?: (context: SchemaContext) => boolean
  /** Omit the spacing around the component. */
  readonly omitSpacing?: boolean
  /** Replace the component with the label of its container, if it has one. */
  readonly replaceWithLabel?: boolean
  /**
   * Submit the data of the form, like `submit`, which makes buttons of the
   * type count for the dirty state of forms and sources.
   */
  readonly submitData?: boolean
  /** Sources hold their items in a list or an object. */
  readonly sourceType?: 'list' | 'object'
  /**
   * Render the forms of the items inside the form or view of their source,
   * instead of in their own routes.
   */
  readonly nestForms?: boolean
  /** The sources routed next to the forms of the items, e.g. of trees. */
  getChildSourceSchemas?(schema: Record<string, any>): Record<string, any>[]
  getItemAdapter?(schema: Record<string, any>): ItemAdapter | null
  /**
   * The data schema of the options that the data model loads. Only types with
   * it load options, e.g. through `optionsTraits`.
   */
  getOptionsDataSchema?(schema: Record<string, any>): any
  getPanelSchema?(
    api: ApiConfig,
    schema: Record<string, any>,
    dataPath: string,
    source: SourceContext | null
  ): Record<string, any> | null | undefined
  getValidations?(
    schema: Record<string, any>,
    context: SchemaContext
  ): Record<string, any>
  /** Sets up the schema, e.g. resolves the schemas that it contains. */
  processSchema?(
    api: ApiConfig,
    schema: Record<string, any>,
    name: string
  ): Promise<any> | void
  /** Converts the value for storage. */
  processValue?(context: SchemaContext, graph: any): any
}

/**
 * Defines a type of schema components, registered under its `type`. Its
 * component receives the props of {@link CustomComponentProps} and emits the
 * events of {@link CustomComponentEmits}, like the components of
 * `type: 'component'`.
 */
export function defineType(descriptor: TypeDescriptor): TypeDescriptor

/** Loads `schema.options` and relates values to them, like `select`. */
export const optionsTraits: Partial<TypeDescriptor>
/** The validations of `min`, `max`, `range`, `step` and `decimals`. */
export const numberTraits: Partial<TypeDescriptor>
/** Trims text values if `trim` is set, and turns empty ones into defaults. */
export const textTraits: Partial<TypeDescriptor>
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
  'panel': PanelSchema<$Item>
  'hidden': HiddenSchema<$Item>
  'unknown': never
}

export type OrRecordOf<T> = T | Record<string, T>
export type OrPromiseOf<T> = T | Promise<T>
export type OrFunctionReturning<T> = (() => T) | T
export type OrArrayOf<T> = T | T[]
export type Resolvable<T> = OrFunctionReturning<OrPromiseOf<OrRecordOf<T>>>

type LiteralUnion<T extends U, U = string> = T | (U & Record<never, never>)
