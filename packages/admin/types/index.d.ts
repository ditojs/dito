// Type definitions for Dito.js admin
// Project: <https://github.com/ditojs/dito/>

import {
  DateFormat,
  format as utilsFormat,
  NumberFormat,
  TimeFormat
} from '@ditojs/utils'
import { AxiosResponse as Response } from 'axios'
import { RequireAtLeastOne, SetOptional } from 'type-fest'
import Vue, { VueConstructor } from 'vue'

declare global {
  const dito: DitoGlobal
}

export default DitoAdmin
export interface DitoGlobal {
  api?: ApiConfig
  base?: string
  settings?: Record<string, any>
}
export type PerformRequest = <T>({
  url,
  method,
  data,
  params,
  headers,
}: {
  url: string
  /**
   * @default 'get'
   */
  method: HTTPVerb
  data: any
  params: any
  headers: any
}) => Promise<Response<T>>

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
  formats?: {
    number?: NumberFormat
    date?: DateFormat
    time?: TimeFormat
  }
  request?: PerformRequest
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
   * camelized strings and `api.denormalizePath` to do the opposite.
   *
   * @default Defaults to Application.config.app.normalizePaths and then
   * `false` when missing.
   */
  normalizePaths?: boolean
  /**
   * @default When `api.normalizePaths = true` (plural),
   * `require('@ditojs/utils').hyphenate` is used for path normalization.
   * Otherwise paths are left unchanged.
   */
  normalizePath?: (path: string) => string
  /**
   * @default When `api.normalizePaths = true` (plural),
   * `require('@ditojs/utils').camelize` is used for path denormalization.
   * Otherwise paths are left unchanged.
   */
  denormalizePath?: (path: string) => string
  /**
   * Auth resources
   */
  users?: {
    path: string
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

  /**
   * Configures how urls passed to `DitoAdmin.request` are checked to see if
   * they are an API request.
   *
   * By default (if `api.request` is not overridden) API requests include
   * `api.url` as their base url, `api.headers` in their headers. If
   * `api.cors.credentials` is set to `true`, cross-site `Access-Control`
   * requests are made using credentials.
   */
  isApiRequest?: (url: string) => boolean
}

export interface BaseSchema<$Item>
  extends SchemaDitoMixin<$Item>,
    SchemaTypeMixin<$Item> {
  default?: OrItemAccessor<$Item>
  compute?: ItemAccessor<$Item>
  data?: OrItemAccessor<$Item, {}, Record<string, any>>
  omitPadding?: boolean
}

// TODO: finish off DitoMixin docs
// (methods / computed / watch / events / `on[A-Z]`-style callbacks)
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

export interface SchemaTypeMixin<$Item> {
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
  width?: OrItemAccessor<$Item, {}, 'auto' | 'fill' | string | number>

  /**
   * Whether the component is visible.
   *
   * @defaultValue `true`
   */
  visible?: OrItemAccessor<$Item, {}, boolean>

  /**
   * @defaultValue `false`
   */
  // TODO: document exclude
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
   * Specifies a short hint intended to aid the user with data entry when the
   * input has no value.
   */
  placeholder?: OrItemAccessor<$Item, {}, any>

  /**
   * Whether the input field should have autocomplete enabled.
   */
  autocomplete?: OrItemAccessor<$Item, {}, 'on' | 'off'>

  /**
   * Specifies a function which changes the item value into another format,
   * before it is passed to the component.
   */
  format?: ItemAccessor<$Item, {}, any>
  disabled?: OrItemAccessor<$Item, {}, boolean>

  /**
   * Specifies a function which parses the component value when it changes,
   *
   */
  parse?: ItemAccessor<$Item, any>

  // TODO: document process
  process?: OrItemAccessor<$Item>

  // TODO: document name
  name?: string

  onFocus?: ItemEventHandler<$Item>
  onBlur?: ItemEventHandler<$Item>
  onChange?: ItemEventHandler<$Item>
  onInput?: ItemEventHandler<$Item>
  events?: {
    focus?: ItemEventHandler<$Item>
    blur?: ItemEventHandler<$Item>
    change?: ItemEventHandler<$Item>
    input?: ItemEventHandler<$Item>
  }
}

export interface SchemaSourceMixin<$Item> {
  /**
   * The number of items displayed per page. When not provided, all items are
   * rendered.
   *
   * @defaultValue `false`
   */
  paginate?: OrItemAccessor<$Item, {}, number>
  // TODO: document inlined
  /**
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
        label: string
      }
  >
  /**
   * Whether to add edit buttons next to the list items.
   *
   * @defaultValue `false`
   */
  editable?: OrItemAccessor<
    $Item,
    {},
    | boolean
    | {
        label: string
      }
  >
  /**
   * Whether to add delete buttons next to the list items.
   *
   * @defaultValue `false`
   */
  deletable?: OrItemAccessor<
    $Item,
    {},
    | boolean
    | {
        label: string
      }
  >
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
  /**
   * Whether an inlined form is collapsed.
   */
  collapsed?: OrItemAccessor<$Item, {}, boolean>
  resource?: Resource
}

export type SchemaOptionsOption<$Value> =
  | { label: string; value: $Value }
  | $Value
export type SchemaOptions<$Item, $Option = any> =
  | SchemaOptionsOption<$Option[]>
  | {
      /**
       * The function which is called to load the options.
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
       * Either the key of the option property which should be treated as
       * the value or a function returning the option value.
       *
       * @defaultValue `'value'` when no label is supplied and the options are
       * objects
       */
      // TODO: when relate is set, the default value is 'id'
      value?: keyof $Option | ItemAccessor<$Item, { option: $Option }>
      /**
       * The key of the option property which should used to group the options.
       */
      groupBy?: keyof $Option
    }

export interface SchemaOptionsMixin<$Item, $Option = any> {
  options?: SchemaOptions<$Item, $Option>
  relate?: boolean
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
  rules?: Omit<SchemaNumberMixin<$Item>, 'rules'> & {
    integer?: boolean
  }
}

export type ComponentSchema<$Item = any> = BaseSchema<$Item> & {
  type: 'component'
  /**
   * Use a Vue component to render the component. The component is specified
   * like this: import(...).
   */
  component: Resolvable<VueConstructor<Vue>>
}

export type InputSchema<$Item = any> = BaseSchema<$Item> & {
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
    | 'computed'
  rules?: {
    text?: boolean
    email?: boolean
    url?: boolean
    hostname?: boolean
    domain?: boolean
    // TODO: check why there is no 'tel' validation
    // tel: boolean,
    password?: boolean
    creditcard?: boolean
  }
}

export type DateSchema<$Item = any> = BaseSchema<$Item> & {
  /**
   * The type of the component.
   */
  type: 'date' | 'datetime' | 'time'
  /**
   * @defaultValue `En/US`
   */
  locale?: string
  dateFormat?: OrItemAccessor<$Item, {}, DateFormat>
}

export type ButtonSchema<
  $Item,
  $EventHandler = ItemEventHandler<$Item>
> = BaseSchema<$Item> & {
  /**
   * The type of the component.
   */
  type: 'button' | 'submit'
  closeForm?: OrItemAccessor<$Item, {}, boolean>
  text?: OrItemAccessor<$Item, {}, string>
  resource?: Resource
  onClick?: $EventHandler
  onSuccess?: $EventHandler
  onError?: $EventHandler
  events?: {
    click?: $EventHandler
    success?: $EventHandler
    error?: $EventHandler
  }
}

export type SwitchSchema<$Item = any> = BaseSchema<$Item> & {
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

export type NumberSchema<$Item = any> = SchemaNumberMixin<$Item> &
  BaseSchema<$Item> & {
    /**
     * The type of the component.
     */
    type: 'number' | 'integer'
  }

export type SliderSchema<$Item = any> = SchemaNumberMixin<$Item> &
  BaseSchema<$Item> & {
    /**
     * The type of the component.
     */
    type: 'slider'
    // TODO: document what the input SliderSchema option does
    input?: OrItemAccessor<$Item>
  }

export type TextareaSchema<$Item = any> = BaseSchema<$Item> & {
  /**
   * The type of the component.
   */
  type: 'textarea'
  /**
   * Whether the input element is resizable.
   */
  resizable?: boolean
  /**
   * The amount of visible lines.
   *
   * @defaultValue `4`
   */
  lines?: number
}

export type CodeSchema<$Item = any> = BaseSchema<$Item> & {
  /**
   * The type of the component.
   */
  type: 'code'
  /**
   * The code language.
   *
   * @defaultValue `js`
   */
  language?: string
  /**
   * The indent size.
   *
   * @defaultValue `2`
   */
  indentSize?: number
  /**
   * The amount of visible lines.
   *
   * @defaultValue `3`
   */
  lines?: number
}

export type MarkupSchema<$Item = any> = BaseSchema<$Item> & {
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

  // TODO: document enableRules
  enableRules?: OrItemAccessor<
    $Item,
    {},
    | boolean
    | {
        input: boolean
        paste: boolean
      }
  >
  marks?: {
    bold?: boolean
    italic?: boolean
    underline?: boolean
    strike?: boolean
    small?: boolean
    code?: boolean
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
  }
}

export type LabelSchema<$Item = any> = BaseSchema<$Item> & {
  /**
   * The type of the component.
   */
  type: 'label'
}

export type UploadSchema<$Item = any> = BaseSchema<$Item> & {
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
  // TODO: UploadSchema draggable type
  draggable?: boolean
  /**
   * Whether files can be deleted.
   */
  deletable?: boolean
}

export type MultiselectSchema<$Item = any, $Option = any> = BaseSchema<$Item> &
  SchemaOptionsMixin<$Item, $Option> & {
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
    // TODO: document searchable
    /**
     * @defaultValue `false`
     */
    searchable?: boolean
    // TODO: document stayOpen
    /**
     * @defaultValue `false`
     */
    stayOpen?: boolean
    /**
     * When defined, a search input field will be added to allow searching for
     * specific options.
     */
    search?: {
      filter?: ItemAccessor<$Item, { query: string }, OrPromiseOf<$Option[]>>
      debounce?:
        | number
        | {
            delay: number
            immediate?: boolean
          }
    }
    /**
     * @defaultValue `false`
     */
    // TODO: document taggable
    taggable?: boolean
  }

export type SelectSchema<$Item = any> = BaseSchema<$Item> &
  SchemaOptionsMixin<$Item> & {
    /**
     * The type of the component.
     */
    type: 'select'
  }

export type RadioSchema<$Item = any> = BaseSchema<$Item> &
  SchemaOptionsMixin<$Item> & {
    /**
     * The type of the component.
     */
    type: 'radio'
    /**
     * @defaultValue `'vertical'`
     */
    layout?: 'horizontal' | 'vertical'
  }

export type SectionSchema<$Item = any> = BaseSchema<$Item> & {
  /**
   * The type of the component.
   */
  type: 'section'
  components?: Components<$Item>
}

export type CheckboxSchema<$Item = any> = BaseSchema<$Item> & {
  /**
   * The type of the component.
   */
  type: 'checkbox'
}

export type CheckboxesSchema<$Item = any> = BaseSchema<$Item> &
  SchemaOptionsMixin<$Item> & {
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
export type ColorSchema<$Item = any> = BaseSchema<$Item> & {
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
   * @defaultValue true
   */
  // TODO: document inputs
  /**
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

export type ColumnSchema<$Item = any> = {
  /**
   * The label of the column.
   * @defaultValue The labelized column key.
   */
  label?: string
  /**
   * Use a Vue component to render the cell. The component is specified
   * like this: import(...).
   */
  component?: Resolvable<VueConstructor<Vue>>
  /**
   * Whether the column should be sortable.
   */
  sortable?: boolean
  /**
   * A function of the value and the item returning the displayed name.
   * If the column is sortable, the column is sorted by value and not by
   * rendered name.
   */
  render?: ItemAccessor<$Item, {}, string>
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
  /**
   * Only displays the column if the item accessor returns `true`
   */
  if?: ItemAccessor<$Item, {}, boolean>
}

export type ResolvableForm<$Item = any> = Resolvable<Form<$Item>>

export type ListSchema<$Item = { [key: string]: any }> = SchemaSourceMixin<$Item> &
  BaseSchema<$Item> & {
    /**
     * The type of the view
     */
    type: 'list'
    /**
     * The form.
     */
    form?: ResolvableForm
    /**
     * The forms.
     */
    forms?: {
      [key: string]: ResolvableForm
    }
    /**
     * The label given to the items. If no itemLabel is given, the default is
     * the 'name' property of the item, followed by label of the form of the
     * view (plus item id) and other defaults.
     */
    itemLabel?: OrItemAccessor<any, {}, string>
    /**
     * The columns displayed in the table. While columns can be supplied as an
     * array where each entry is the name of a property of the item, it is
     * usually beneficial to assign an object with further options to the
     * columns property.
     */
    columns?: Record<string, ColumnSchema<$Item>> | (keyof $Item)[]
    /**
     * Scope names as defined on the model. When set, the admin renders a set of
     * scope buttons, allowing the user to switch between them while editing.
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
     * Default scope name as defined on the model.
     */
    scope?: string

    // TODO: document filters
    filters?: {
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
            components: Components<any>
          }
    }
  }

export type OrItemAccessor<
  $Item = any,
  $Params extends {} = {},
  $ReturnValue = any
> = ItemAccessor<$Item, $Params, $ReturnValue> | $ReturnValue

export type ItemAccessor<
  $Item = any,
  $Params extends {} = {},
  $ReturnValue = any
> = (params: DitoContext<$Item> & $Params) => $ReturnValue

export type DitoContext<$Item = any> = {
  /**
   * `nested` is `true` when the data-path points a value inside an item, and
   * `false` when it points to the item itself.
   */
  nested: boolean
  value: any
  dataPath: string
  name: string
  index: any
  itemDataPath: any
  parentItemDataPath: any
  itemIndex: any
  parentItemIndex: any
  item: $Item
  /**
   * NOTE: `parentItem` isn't the closest data parent to `item`, it's the
   * closest parent that isn't an array, e.g. for relations or nested JSON
   * data.  This is why the term `item` was chosen over `data`, e.g. VS the
   * use of `parentData` in server-sided validation, which is the closest
   * parent. If needed, we could expose this data here too, as we can do all
   * sorts of data processing with `rootData` and `dataPath`.
   */
  parentItem: any
  rootItem: any
  processedItem: any
  clipboardItem: any
  user: any
  api: ApiConfig
  views: any
  itemLabel: string | null
  formLabel: string | null
  component: any
  schemaComponent: Vue | null
  formComponent: any
  viewComponent: any
  dialogComponent: any
  panelComponent: Vue | null
  resourceComponent: Vue | null
  sourceComponent: Vue | null
  option: any
  options: any
  query: string
  error: any | null
  wasNotified: boolean

  // Helper Methods

  request<T extends any>(options: {
    /**
     * Allows caching of loaded data on two levels:
     * - 'global': cache globally, for the entire admin session
     * - 'local': cache locally within the closest route component that is
     *   associated with a resource and loads its own data.
     */
    cache?: 'local' | 'global'
    url: string
    /**
     * @defaultValue `'get'`
     */
    method?: HTTPVerb
    params?: any
    data?: any
  }): Promise<T>
  format: typeof utilsFormat
  navigate(location: string | { path: string }): Promise<boolean>
  download: {
    (url: string): void
    (options: { url: string; filename: string }): void
  }
  getResourceUrl: any
  notify(options: {
    type?: LiteralUnion<'warning' | 'error' | 'info' | 'success'>
    title?: string
    text: OrArrayOf<string>
  }): void
}

export type View<$Item = any> = {
  resource?: Form['resource'];
  clipboard?: Form['clipboard']
} & (
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
  | SectionSchema<$Item>
)

export type Component<$Item = any> =
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
  | SectionSchema<$Item>

export type Components<$Item = any> = {
  [$name: string]: Component<$Item>
}

export type Buttons<$Item> = Record<
  string,
  SetOptional<ButtonSchema<$Item>, 'type'>
>

export type Form<$Item = any> = {
  /**
   * The name of the item model produced by the form.
   */
  name?: OrItemAccessor<$Item, {}, string>
  /**
   * The label of the form.
   */
  label?: OrItemAccessor<$Item, {}, string | boolean>
  /**
   * @defaultValue `false`
   */
  compact?: boolean
  resource?: Resource
  /**
   * Display several forms in different tabs within the form.
   */
  tabs?: Record<
    string,
    Omit<Form<$Item>, 'tabs'> & {
      defaultTab?: OrItemAccessor<$Item, {}, boolean>
    }
  >
  // TODO: document components
  components?: Components<$Item>
  // TODO: document clipboard
  clipboard?:
    | boolean
    | {
        copy?: (...args: any[]) => any
        paste?: (...args: any[]) => any
      }
  buttons?: Buttons<$Item>
  if?: OrItemAccessor<$Item, {}, boolean>
}

export type Resource =
  | string
  | RequireAtLeastOne<{
      path?: string
      method?: HTTPVerb
      // TODO: type Resource['data']
      data?: any
    }>

export class DitoAdmin<
  $Views extends Record<string, any> = Record<string, OrPromiseOf<View>>
> {
  api: ApiConfig
  // TODO: finish off Vue types
  root: Vue
  constructor(
    element: Element | string,
    options?: {
      // `dito` contains the base and api settings passed from `AdminController`
      dito?: DitoGlobal
      api?: ApiConfig
      views: OrFunctionReturning<OrPromiseOf<$Views>>
      // TODO: options rest type
      // ...options: any
    }
  )

  // TODO: options and return type
  register(type: OrArrayOf<string>, options: any): any
  request: PerformRequest
}
export type HTTPVerb = 'get' | 'post' | 'put' | 'delete' | 'patch'

export type SchemaByType<$Item = any> = {
  button: ButtonSchema<$Item>
  checkbox: CheckboxSchema<$Item>
  checkboxes: CheckboxesSchema<$Item>
  code: CodeSchema<$Item>
  color: ColorSchema<$Item>
  component: ComponentSchema<$Item>
  date: DateSchema<$Item>
  list: ListSchema<$Item>
  markup: MarkupSchema<$Item>
  multiselect: MultiselectSchema<$Item>
  number: NumberSchema<$Item>
  radio: RadioSchema<$Item>
  select: SelectSchema<$Item>
  slider: SliderSchema<$Item>
  switch: SwitchSchema<$Item>
  text: InputSchema<$Item>
  textarea: TextareaSchema<$Item>
  upload: UploadSchema<$Item>
  label: LabelSchema<$Item>
  section: SectionSchema<$Item>
  unknown: never
}

type OrRecordOf<T> = T | Record<string, T>
type OrPromiseOf<T> = T | Promise<T>
type OrFunctionReturning<T> = (() => T) | T
type OrArrayOf<T> = T | T[]
type Resolvable<T> = OrFunctionReturning<OrPromiseOf<OrRecordOf<T>>>

// https://stackoverflow.com/questions/49927523/disallow-call-with-any/49928360#49928360
type AnyGate<
  $CheckType,
  $TypeWhenNotAny,
  $TypeWhenAny = $CheckType
> = 0 extends 1 & $CheckType ? $TypeWhenAny : $TypeWhenNotAny

type LiteralUnion<T extends U, U = string> = T | (U & Record<never, never>)
