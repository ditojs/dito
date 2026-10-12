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
   * schema setup, defaults for a matching type are applied
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

/** The schema settings shared by all components. */
export interface BaseSchema<$Item> extends SchemaFields<$Item> {
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
   * `sourceQuery`, refer to the form, view or dialog that
   * holds the data, not to the field.
   *
   * Reading `context.options` waits while the options
   * load, and is `undefined` when the load fails or its
   * data resolves to nothing, so use `options?.`.
   */
  computeValue?: ItemAccessor<$Item>
  /**
   * Custom CSS class(es) added to the component's container
   * element. Accepts a string or an object of class-boolean
   * pairs.
   */
  class?: string | Record<string, boolean>
  /**
   * Forces a layout line break before, after, or on
   * both sides of the component.
   */
  break?: 'before' | 'after' | 'both'

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
   * Whether to exclude the field's value from the serialized data
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
   * Specifies a function which transforms the edited
   * value into a display format before it is passed
   * to the component for rendering.
   */
  formatValue?: ItemAccessor<$Item, {}, any>
  /**
   * Whether the component is disabled.
   *
   * @defaultValue `false`
   */
  disabled?: OrItemAccessor<$Item, {}, boolean>

  /**
   * Specifies a function which parses the component
   * value when it changes, transforming the raw
   * input before it is written into the data.
   */
  parseValue?: ItemAccessor<$Item, {}>

  /**
   * Specifies a function which converts the stored value to the
   * edited value, when data is loaded, merged from the response
   * of a save or pasted, after the type's own conversion.
   */
  deserializeValue?: ItemAccessor<$Item, {}>

  /**
   * Specifies a function which converts the edited value for
   * the server and the clipboard, after the type's own
   * conversion but before exclusion. Can also modify sibling
   * data via `serializedItem` in the context, even when
   * `exclude` is `true`.
   */
  serializeValue?: ItemAccessor<$Item, {}>

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
   * Called for each edit that changes the value, e.g. per keystroke, while
   * {@link BaseSchema.onChange} is called once the edit is done. Bubbles to
   * the schemas above like `onChange`, unless a handler returns `false`.
   */
  onInput?: ItemEventHandler<$Item>
  /**
   * Grouped event handlers, equivalent to the `on[A-Z]`-style
   * callbacks on the schema (e.g. {@link BaseSchema.onFocus}).
   *
   * @see {@link SchemaFields.onInitialize} and other `on`-
   * prefixed properties for per-event documentation.
   *
   * @deprecated Use the `on…` handlers, e.g. `onChange()`.
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

/** The schema settings shared by lists, objects and trees. */
export interface SourceSettings<$Item> {
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
   * instead of editing a copy that is applied when submitting. Their edits
   * make the data of the parent dirty right away, and their `isDirty` is the
   * parent's.
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
       * `sourceQuery`, refer to the form, view or dialog that
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
       * Either the key of the option property which holds the option's
       * group or a function returning the option's group. Selects and
       * multiselects show the groups in their dropdowns, radio buttons and
       * checkboxes list each group in a fieldset with the group as its
       * legend.
       */
      group?: keyof $Option | ItemAccessor<$Item, { option: $Option }, string>
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

/**
 * The schema settings shared by components that select from options, e.g.
 * selects, radios and checkboxes.
 */
export interface SelectionSettings<$Item, $Option = any> {
  /** The available options for selection. */
  options?: SchemaOptions<$Item, $Option>
  /**
   * Treats options as related objects: the full object is used during
   * editing, but only its id is sent on save. `true` relates by `id`, a
   * string by the key of the id that it names, e.g. `relate: 'code'`.
   */
  relate?: boolean | string
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

/** The schema settings shared by numbers, sliders and progress bars. */
export interface NumberSettings<$Item> {
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
    Omit<NumberSettings<$Item>, 'rules'> & {
      /** Restrict the value to whole numbers. */
      integer?: boolean
    }
}

/** The schema settings shared by text inputs and textareas. */
export interface TextSettings<$Item> {
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

/** The schema settings of components with a prefix and a suffix. */
export interface AffixSettings<$Item> {
  /**
   * Prefix content displayed before the input.
   */
  prefix?: OrArrayOf<SchemaAffix>
  /**
   * Suffix content displayed after the input.
   */
  suffix?: OrArrayOf<SchemaAffix>
}

/**
 * The schema settings of components that resolve their value from data, e.g.
 * computed and hidden components.
 */
export interface DataSettings<$Item> {
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
  /** The value of the component, after `formatValue()`. */
  modelValue: $Value
  /** The id of the element that displays the errors, while there are any. */
  errorsElementId?: string | null
}

/** The events of the custom components of `type: 'component'` schemas. */
export interface CustomComponentEmits<$Value = any> {
  /** Changes the value of the component, through `parseValue()`. */
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
    TextSettings<$Item>,
    AffixSettings<$Item> {
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
    AffixSettings<$Item> {
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
  format?: OrItemAccessor<
    $Item,
    {},
    {
      date?: DateFormat
      time?: TimeFormat
    }
  >
}

export interface ButtonSchema<$Item = any>
  extends BaseSchema<$Item>,
    AffixSettings<$Item> {
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
  /** @deprecated Use the `on…` handlers, e.g. `onChange()`. */
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
  // `rules` comes from `NumberSettings`, which extends `SchemaRules`.
  extends NumberSettings<$Item>,
    Omit<BaseSchema<$Item>, 'rules'>,
    AffixSettings<$Item> {
  /**
   * The type of the component.
   */
  type: 'number' | 'integer'
}

export interface SliderSchema<$Item = any>
  // `rules` comes from `NumberSettings`, which extends `SchemaRules`.
  extends NumberSettings<$Item>,
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
    TextSettings<$Item> {
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
  lines?: OrItemAccessor<$Item, {}, number>
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
  lines?: OrItemAccessor<$Item, {}, number>

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
    DataSettings<$Item> {
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
  multiple?: OrItemAccessor<$Item, {}, boolean>
  /**
   * Allowed file extensions for upload.
   * @example 'zip' // Only files with zip extension
   * @example ['jpg', 'jpeg', 'gif', 'png']
   * @example /\.(gif|jpe?g|png)$/i
   */
  extensions?: OrItemAccessor<$Item, {}, OrArrayOf<RegExp | string>>
  /**
   * One or more unique file type specifiers that describe the type of file
   * that may be selected for upload by the user.
   *
   * @example 'audio/*' // Any type of audio file
   * @example ['image/png', 'image/gif', 'image/jpeg']
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file#Unique_file_type_specifiers }
   */
  accept?: OrItemAccessor<$Item, {}, OrArrayOf<string>>
  /**
   * The maximum size of the file expressed as number of bytes or as a string
   * like `'200kB'`, `'1MB'`, `'3.2GB'`, etc., using base 10 (1 kB = 1000
   * bytes). IEC units like `'1MiB'` use base 2 (1 KiB = 1024 bytes).
   */
  maxSize?: OrItemAccessor<$Item, {}, string | number>
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
    SelectionSettings<$Item, $Option>,
    AffixSettings<$Item> {
  /**
   * The type of the component.
   */
  type: 'multiselect'
  /**
   * Whether more than one option can be selected.
   *
   * @defaultValue `false`
   */
  multiple?: OrItemAccessor<$Item, {}, boolean>
  /**
   * Whether to enable a search input field in the dropdown
   * for filtering options.
   *
   * @defaultValue `false`
   */
  searchable?: OrItemAccessor<$Item, {}, boolean>
  /**
   * Whether the dropdown stays open after selecting an option,
   * useful for making multiple selections without repeated
   * opening.
   *
   * @defaultValue `false`
   */
  stayOpen?: OrItemAccessor<$Item, {}, boolean>
  /**
   * Whether users can create new options by typing and
   * pressing Enter, adding custom tags not in the options
   * list.
   *
   * @defaultValue `false`
   */
  taggable?: OrItemAccessor<$Item, {}, boolean>
}

export interface SelectSchema<$Item = any>
  extends BaseSchema<$Item>,
    SelectionSettings<$Item>,
    AffixSettings<$Item> {
  /**
   * The type of the component.
   */
  type: 'select'
}

export interface RadioSchema<$Item = any>
  extends BaseSchema<$Item>,
    SelectionSettings<$Item> {
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
     *
     * @deprecated Use the `on…` handlers, e.g. `onChange()`.
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
    SelectionSettings<$Item> {
  /**
   * The type of the component.
   */
  type: 'checkboxes'
  /**
   * Whether multiple values can be selected.
   *
   * @defaultValue `true`
   */
  multiple?: OrItemAccessor<$Item, {}, boolean>
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
    AffixSettings<$Item> {
  /**
   * The type of the component.
   */
  type: 'color'
  /**
   * The color format.
   */
  format?: OrItemAccessor<$Item, {}, ColorFormat>
  /**
   * Whether to show the alpha slider in the color picker, to edit the
   * color's alpha component.
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
   * Sort the colum in ascending or descending order, `true` for ascending.
   * Columns are ordered by the first column to specify `defaultSort`.
   */
  defaultSort?: true | 'asc' | 'desc'
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
  extends SourceSettings<$Item>,
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
   *
   * @deprecated Use the `on…` handlers, e.g. `onChange()`.
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
  /**
   * The index of the value in its list, `null` for values that aren't list
   * entries, e.g. of fields, whose item has `itemIndex`.
   */
  valueIndex: number | null
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
   * The item serialized for the server, built when it's
   * read. In `serializeValue()`, the item that is being
   * serialized, allowing modification of sibling fields.
   */
  serializedItem: any
  /**
   * The root item serialized for the server, built when
   * it's read. In nested forms, with the draft in place
   * of the item, like `rootItem`.
   */
  serializedRootItem: any
  /**
   * The form's current data serialized for clipboard
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
   * The options of the field, in the callbacks of fields with options,
   * e.g. selects: also in `formatValue()`, `parseValue()`, events and
   * schema values, but not in its container's, e.g. `label`. In
   * `computeValue()`, they are
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
   * unless they mutate the item of their parent, which
   * tells the parent's. Only data with a button of type
   * `submit`, or of a type with `submitsData`, can be
   * dirty: without one, `isDirty` stays `false`.
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
   * order and filters, or `null` outside of lists, inside
   * forms and in `itemLabel()`.
   */
  sourceQuery: Record<string, any> | null
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

  /**
   * Performs an API request to `url`, or else to `resource`, resolved
   * relative to the nearest form or list with a resource, and resolves with
   * the data of the response.
   */
  request<T>(
    options: {
      /**
       * Caches the response:
       * - 'global': for the admin session, until the user changes.
       * - 'local': while the route of the form or view is shown. Outside of
       *   routes, e.g. in dialogs, responses aren't cached.
       */
      cache?: 'local' | 'global'
      /**
       * @default 'get', or the `method` of `resource`
       */
      method?: HTTPMethod
      query?:
        | Record<string, string | number | (string | number)[]>
        | [string, string | number][]
      data?: unknown
    } & (
      | { url: string; resource?: Resource }
      | { url?: string; resource: Resource }
    )
  ): Promise<T>
  /**
   * Returns a context that inherits from this one, with the members of
   * `values` added or overridden, e.g. the `value` that a callback receives.
   */
  extend<$Values extends Record<string, any>>(
    values: $Values
  ): Merge<SchemaContext<$Item>, $Values>
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
   * Returns the URL of the nearest form or list with a resource: of the item
   * that the form edits, or of the collection that the list loads or the
   * form creates its item in. Throws without such a form or list.
   */
  getResourceUrl(): string
  /**
   * Returns the URL of `resource`, resolved relative to the nearest form or
   * list with a resource, or `null` if it resolves to no path.
   */
  getResourceUrl(resource: Resource): string | null
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
 * The context of the admin, as `DitoAdmin.context`. `user`, `views` and
 * `flattenedViews` change with each login, and are reactive.
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
  showDialog: SchemaContext['showDialog']
  notify: SchemaContext['notify']
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
   *
   * @deprecated Use the `on…` handlers, e.g. `onChange()`.
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
    DataSettings<$Item> {
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
    DataSettings<$Item> {
  /**
   * The type of the component.
   */
  type: 'data'
}

export interface ObjectSchema<$Item = { [key: string]: any }>
  extends SourceSettings<$Item>,
    BaseSchema<$Item>,
    SchemaOpen<$Item> {
  /**
   * The type of the component.
   */
  type: 'object'
  /**
   * Grouped event handlers.
   *
   * @deprecated Use the `on…` handlers, e.g. `onChange()`.
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
  extends SourceSettings<$Item>,
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
   * Whether child nodes are collapsed initially.
   *
   * @defaultValue `true`
   */
  collapsed?: boolean
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
  // `rules` comes from `NumberSettings`, which extends `SchemaRules`.
  extends NumberSettings<$Item>,
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
  SelectionSettings<$Item, $Option> &
  AffixSettings<$Item> &
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
   *
   * @deprecated Use the `on…` handlers, e.g. `onChange()`.
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
  /** The context of the admin. */
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
 * rendered. Its flags are statements about the type, and the defaults of
 * schema settings start with `default`.
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
  readonly defaultExclude?: boolean | ((context: SchemaContext) => boolean)
  /** Don't give values that are missing their defaults, e.g. passwords. */
  readonly ignoresMissingValue?: (context: SchemaContext) => boolean
  /** Give values that are `null` their defaults, e.g. nested sections. */
  readonly treatsNullAsMissing?: (context: SchemaContext) => boolean
  /** The value resolves from `schema.data` or `schema.dataPath`. */
  readonly resolvesValue?: boolean
  /**
   * The type reads `format` from its schema, e.g. the formats of dates.
   * Other types reject it, as the `format()` of 3.x is `formatValue()`.
   */
  readonly hasFormat?: boolean
  /** Generate a label from the name for components without `label`. */
  readonly generatesLabel?: boolean
  /**
   * The container shows the label, `true` if not set. Types that display the
   * label themselves return `false`.
   */
  readonly hasLabel?: (context: SchemaContext) => boolean
  /** Omit the spacing around the component. */
  readonly omitsSpacing?: boolean
  /** The component renders as the label of its container, if it has one. */
  readonly rendersLabel?: boolean
  /**
   * The buttons of the type submit the data of the form, like `submit`, and
   * count for the dirty state of forms and sources.
   */
  readonly submitsData?: boolean
  /** Sources hold their items in a list or an object. */
  readonly sourceType?: 'list' | 'object'
  /**
   * The forms of the items render inside the form or view of their source,
   * instead of in their own routes.
   */
  readonly hasNestedForms?: boolean
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
    // The list that the component renders, e.g. for the panel of its filters:
    source: {
      readonly listQuery: {
        readonly query: Record<string, any>
        update(
          changes: Record<string, any>,
          options?: { resetPage?: boolean }
        ): Promise<unknown>
      }
    } | null
  ): Record<string, any> | null | undefined
  /**
   * The text that cells without `render()` and item labels show for the
   * edited value, e.g. formatted dates. Without it, they show the value.
   */
  getValueText?(context: SchemaContext): any
  getValidations?(
    schema: Record<string, any>,
    context: SchemaContext
  ): Record<string, any>
  /** Sets up the schema, e.g. resolves the schemas that it contains. */
  setupSchema?(
    api: ApiConfig,
    schema: Record<string, any>,
    name: string
  ): Promise<any> | void
  /** Converts the stored value to the edited value, before the schema. */
  deserializeValue?(context: SchemaContext): any
  /** Converts the edited value for storage, before the schema. */
  serializeValue?(context: SchemaContext): any
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
