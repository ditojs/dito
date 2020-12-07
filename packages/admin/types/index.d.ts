// Type definitions for Dito.js admin
// Project: <https://github.com/ditojs/dito/>

import { AxiosResponse as Response } from 'axios'
import {
  format as utilsFormat,
  DateFormat,
  NumberFormat,
  TimeFormat
} from '@ditojs/utils'
import Vue from 'vue'

declare global {
  const dito: DitoGlobal
}

export default DitoAdmin
export interface DitoGlobal {
  api?: ApiConfig
  base?: string
  settings?: {
    [k: string]: any
  }
}
export type PerformRequest = <T>({
  url,
  method,
  data,
  params,
  headers
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

export interface BaseSchema<$State extends State>
  extends SchemaDitoMixin<$State>,
    SchemaTypeMixin<$State> {
  default?: OrItemAccessor<$State>
  compute?: ItemAccessor<$State>
  data?: OrItemAccessor<$State, {}, {[key: string]: any}>
  omitPadding?: boolean
}

// TODO: finish off DitoMixin docs
// (methods / computed / watch / events / `on[A-Z]`-style callbacks)
export interface SchemaDitoMixin<$State extends State> {
  /**
   * Only displays the component if the schema accessor returns `true`
   */
  if?: OrItemAccessor<$State, {}, boolean | string[] | string>

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
export type ItemEventHandler<$State extends State = CreateState> = (
  // this: ComponentByType<$State>[$State['component']],
  itemParams: DitoContext<$State>
) => void | false

export interface SchemaTypeMixin<$State extends State> {
  /**
   * The label of the component.
   *
   * @defaultValue The title-cased component name.
   */
  label?: OrItemAccessor<$State, {}, string | boolean>

  /**
   * The width of the component. The value can either be given in percent
   * (e.g. '20%' or a value between 0 and 1), or as 'auto' to have the width
   * depend on its contents or as 'fill' to fill left over space. A line will
   * contain multiple components until their widths exceed 100%.
   */
  width?: OrItemAccessor<$State, {}, 'auto' | 'fill' | string | number>

  /**
   * Whether the component is visible.
   *
   * @defaultValue `true`
   */
  visible?: OrItemAccessor<$State, {}, boolean>

  /**
   * @defaultValue `false`
   */
  // TODO: document exclude
  exclude?: OrItemAccessor<$State, {}, boolean>

  /**
   * Whether the field is required.
   * @defaultValue `false`
   */
  required?: OrItemAccessor<$State, {}, boolean>

  /**
   * Whether the value is read only.
   *
   * @defaultValue `false`
   */
  readonly?: OrItemAccessor<$State, {}, boolean>

  /**
   * Whether to autofocus the field.
   * @defaultValue `false`
   */
  autofocus?: OrItemAccessor<$State, {}, boolean>

  /**
   * Whether the field can be cleared.
   * @defaultValue `false`
   */
  clearable?: OrItemAccessor<$State, {}, boolean>

  /**
   * Specifies a short hint intended to aid the user with data entry when the
   * input has no value.
   */
  placeholder?: OrItemAccessor<$State, {}, any>

  /**
   * Whether the input field should have autocomplete enabled.
   */
  autocomplete?: OrItemAccessor<$State, {}, 'on' | 'off'>

  /**
   * Specifies a function which changes the item value into another format,
   * before it is passed to the component.
   */
  format?: ItemAccessor<$State, {}, any>
  disabled?: OrItemAccessor<$State, {}, boolean>

  /**
   * Specifies a function which parses the component value when it changes,
   *
   */
  parse?: ItemAccessor<$State, any>

  // TODO: document process
  process?: OrItemAccessor<$State>

  // TODO: document name
  name?: string

  onFocus?: ItemEventHandler<$State>
  onBlur?: ItemEventHandler<$State>
  onChange?: ItemEventHandler<$State>
  onInput?: ItemEventHandler<$State>
  events?: {
    focus?: ItemEventHandler<$State>
    blur?: ItemEventHandler<$State>
    change?: ItemEventHandler<$State>
    input?: ItemEventHandler<$State>
  }
}

export interface SchemaSourceMixin<$State extends State> {
  /**
   * The number of items displayed per page. When not provided, all items are
   * rendered.
   *
   * @defaultValue `false`
   */
  paginate?: OrItemAccessor<$State, {}, number>
  // TODO: document inlined
  /**
   * @defaultValue `false`
   */
  inlined?: OrItemAccessor<$State, {}, boolean>
  /**
   * Whether to add a button to create list items.
   *
   * @defaultValue `false`
   */
  creatable?: OrItemAccessor<
    $State,
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
    $State,
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
    $State,
    {},
    | boolean
    | {
        label: string
      }
  >
  /**
   * @defaultValue `false`
   */
  draggable?: OrItemAccessor<$State, {}, boolean>
  /**
   * Whether an inlined form is collapsible.
   * @defaultValue `null`
   */
  collapsible?: OrItemAccessor<$State, {}, boolean | null>
  /**
   * Whether an inlined form is collapsed.
   */
  collapsed?: OrItemAccessor<$State, {}, boolean>
  resource?: Resource
}

export type SchemaOptionsOption<$Value> =
  | { label: string; value: $Value }
  | $Value
export type SchemaOptions<$State extends State, $Option = any> =
  | SchemaOptionsOption<$Option[]>
  | {
      /**
       * The function which is called to load the options.
       */
      data?: OrItemAccessor<
        $State,
        {},
        OrItemAccessor<$State, {}, OrPromiseOf<SchemaOptionsOption<$Option>[]>>
      >
      /**
       * Either the key of the option property which should be treated as
       * the option label or a function returning the option label.
       *
       * @defaultValue `'label'` when no label is supplied and the options are
       * objects
       */
      label?: keyof $Option | ItemAccessor<$State, { option: $Option }, string>
      /**
       * Either the key of the option property which should be treated as
       * the value or a function returning the option value.
       *
       * @defaultValue `'value'` when no label is supplied and the options are
       * objects
       */
      // TODO: when relate is set, the default value is 'id'
      value?: keyof $Option | ItemAccessor<$State, { option: $Option }>
      /**
       * The key of the option property which should used to group the options.
       */
      groupBy?: keyof $Option
    }

export interface SchemaOptionsMixin<$State extends State, $Option = any> {
  options?: SchemaOptions<$State, $Option>
  relate?: boolean
}

export interface SchemaNumberMixin<$State extends State> {
  /**
   * The minimum value.
   */
  min?: OrItemAccessor<$State, {}, number>

  /**
   * The maximum value.
   */
  max?: OrItemAccessor<$State, {}, number>

  /**
   * The minimum and maximum value.
   */
  range?: OrItemAccessor<$State, {}, [number, number]>
  /**
   * When defined, buttons with up and down arrows are added next to the input
   * field. Which when pressed will add or subtract `step` from the value.
   */
  step?: OrItemAccessor<$State, {}, number>
  /**
   * The amount of decimals to round to.
   */
  decimals?: OrItemAccessor<$State, {}, number>
  rules?: Omit<SchemaNumberMixin<$State>, 'rules'> & {
    integer?: boolean
  }
}

export type ComponentSchema<$State extends State> = BaseSchema<$State> & {
  type: 'component'
  /**
   * Use a Vue component to render the component. The component is specified
   * like this: import(...).
   */
  component: OrPromiseOf<Vue>
}

export type InputSchema<$State extends State> = BaseSchema<$State> & {
  /**
   * The type of the component.
   */
  type:
    | 'text'
    | 'email'
    | 'url'
    | 'hostname'
    | 'tel'
    | 'password'
    | 'creditcard'
    | 'computed'
  rules?: {
    text?: boolean
    email?: boolean
    url?: boolean
    hostname?: boolean
    // TODO: check why there is no 'tel' validation
    // tel: boolean,
    password?: boolean
    creditcard?: boolean
  }
}

export type DateSchema<
  $InputState extends State = CreateState,
  $State extends State = $InputState
> = BaseSchema<$State> & {
  /**
   * The type of the component.
   */
  type: 'date' | 'datetime' | 'time'
  /**
   * @defaultValue `En/US`
   */
  locale?: string
  dateFormat?: OrItemAccessor<$State, {}, DateFormat>
}

export type ButtonSchema<
  $State extends State = CreateState,
  $EventHandler = ItemEventHandler<$State>
> = BaseSchema<$State> & {
  /**
   * The type of the component.
   */
  type: 'button' | 'submit'
  closeForm?: OrItemAccessor<$State, {}, boolean>
  text?: string
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

export type SwitchSchema<
  $State extends State = CreateState
> = BaseSchema<$State> & {
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

export type NumberSchema<
  $State extends State = CreateState
> = SchemaNumberMixin<$State> &
  BaseSchema<$State> & {
    /**
     * The type of the component.
     */
    type: 'number' | 'integer'
  }

export type SliderSchema<
  $State extends State = CreateState
> = SchemaNumberMixin<$State> &
  BaseSchema<$State> & {
    /**
     * The type of the component.
     */
    type: 'slider'
    // TODO: document what the input SliderSchema option does
    input?: OrItemAccessor<$State>
  }

export type TextareaSchema<
  $State extends State = CreateState
> = BaseSchema<$State> & {
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

export type CodeSchema<
  $State extends State = CreateState
> = BaseSchema<$State> & {
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

export type MarkupSchema<
  $State extends State = CreateState
> = BaseSchema<$State> & {
  /**
   * The type of the component.
   */
  type: 'markup'
  /**
   * Whether the input element is resizable.
   */
  resizable?: OrItemAccessor<$State, {}, boolean>
  /**
   * @defaultValue `'collapse'`
   */
  whitespace?: OrItemAccessor<
    $State,
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
    $State,
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

export type UploadSchema<
  $State extends State = CreateState
> = BaseSchema<$State> & {
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

export type MultiselectSchema<
  $State extends State = CreateState,
  $Option = any
> = BaseSchema<$State> &
  SchemaOptionsMixin<$State, $Option> & {
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
      filter?: ItemAccessor<$State, { query: string }, OrPromiseOf<$Option[]>>
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

export type SelectSchema<
  $State extends State = CreateState
> = BaseSchema<$State> &
  SchemaOptionsMixin<$State> & {
    /**
     * The type of the component.
     */
    type: 'select'
  }

export type RadioSchema<
  $State extends State = CreateState
> = BaseSchema<$State> &
  SchemaOptionsMixin<$State> & {
    /**
     * The type of the component.
     */
    type: 'radio'
    /**
     * @defaultValue `'vertical'`
     */
    layout?: 'horizontal' | 'vertical'
  }

export type CheckboxSchema<
  $State extends State = CreateState
> = BaseSchema<$State> & {
  /**
   * The type of the component.
   */
  type: 'checkbox'
}

export type CheckboxesSchema<
  $State extends State = CreateState
> = BaseSchema<$State> &
  SchemaOptionsMixin<$State> & {
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
export type ColorSchema<
  $State extends State = CreateState
> = BaseSchema<$State> & {
  /**
   * The type of the component.
   */
  type: 'color'
  /**
   * The color format.
   */
  format?: OrItemAccessor<$State, {}, ColorFormat>
  /**
   * Whether the color may contain an alpha component.
   *
   * @defaultValue `false`
   */
  alpha?: OrItemAccessor<$State, {}, boolean>
  /**
   * @defaultValue true
   */
  // TODO: document inputs
  /**
   * @defaultValue `true`
   */
  inputs?: OrItemAccessor<$State, {}, boolean>
  /**
   * Color presets as an array of color values as strings in any css
   * compatible format.
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/CSS/color_value}
   */
  presets?: OrItemAccessor<$State, {}, string[]>
}

export type ColumnSchema<$State extends State = State> = {
  /**
   * The label of the column.
   * @defaultValue The labelized column key.
   */
  label?: string
  /**
   * Use a Vue component to render the cell. The component is specified
   * like this: import(...).
   */
  component?: Promise<Vue>
  /**
   * Whether the column should be sortable.
   */
  sortable?: boolean
  /**
   * A function of the value and the item returning the displayed name.
   * If the column is sortable, the column is sorted by value and not by
   * rendered name.
   */
  render?: ItemAccessor<$State, {}, string>
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
}

export type ResolvableForm<$Item = any> = Resolvable<Form<$Item>>

type ListSchemaItemState<$State extends State = CreateState> = CreateState<
  AnyAlternative<$State['name'], any, Unpacked<$State['item'][$State['name']]>>
>

type ItemFormByType<$Item extends { type: string }, $Type> = $Item extends {
  type: $Type
}
  ? Form<Omit<$Item, 'type'>>
  : never

export type ListSchema<
  $State extends State = CreateState,
  $ListItemState extends State = ListSchemaItemState<$State>
> = SchemaSourceMixin<$State> &
  BaseSchema<$State> & {
    /**
     * The type of the view
     */
    type: 'list'
    /**
     * The form.
     */
    form?: ResolvableForm<$ListItemState['item']>
    /**
     * The forms.
     */
    forms?: {
      [$Type in $ListItemState['item']['type']]: ItemFormByType<
        $ListItemState['item'],
        $Type
      >
    }
    /**
     * The label given to the items. If no itemLabel is given, the default is
     * the 'name' property of the item, followed by label of the form of the
     * view (plus item id) and other defaults.
     */
    itemLabel?: OrItemAccessor<$ListItemState, {}, string>
    /**
     * The columns displayed in the table. While columns can be supplied as an
     * array where each entry is the name of a property of the item, it is
     * usually beneficial to assign an object with further options to the
     * columns property.
     */
    columns?:
      | {
          [$Key: string]: ColumnSchema<$ListItemState>
        }
      | SelectItemKeys<$ListItemState['item']>[]
    /**
     * Scope names as defined on the model. When set, the admin renders a set of
     * scope buttons, allowing the user to switch between them while editing.
     */
    scopes?:
      | string[]
      | {
          [scopeName: string]: {
            label?: string
            defaultScope?: boolean
          }
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
  $State extends State,
  $Params extends {} = {},
  $ReturnValue = $State['value']
> = ItemAccessor<$State, $Params, $ReturnValue> | $ReturnValue

export type ItemAccessor<
  $State extends State = CreateState,
  $Params extends {} = {},
  $ReturnValue = $State['value']
> = (params: DitoContext<$State> & $Params) => $ReturnValue

export type DitoContext<$State extends State> = {
  value: $State['value']
  name: $State['name']
  dataPath: string
  item: {
    [$Key in SelectItemKeys<$State['item']>]: $State['item'][$Key]
  }
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
  list: any
  index: any
  user: any
  api: ApiConfig
  itemLabel: string | null
  formLabel: string | null
  component: any
  schemaComponent: Vue | null
  formComponent: any
  viewComponent: any
  dialogComponent: any
  panelComponent: Vue | null
  sourceComponent: Vue | null
  options: any
  query: string
  error: any | null
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
  navigate(location: string | { path: string }): Promise<boolean>
  download: {
    (url: string): void
    (options: { url: string; filename: string }): void
  }
  notify(options: {
    type?: StringSuggestions<'warning' | 'error' | 'info' | 'success'>
    title?: string
    text: OrArrayOf<string>
  }): void
  format: typeof utilsFormat
  wasNotified: boolean
}

export type View<$Item = any> =
  | InputSchema<CreateState<$Item>>
  | RadioSchema<CreateState<$Item>>
  | CheckboxSchema<CreateState<$Item>>
  | CheckboxesSchema<CreateState<$Item>>
  | ColorSchema<CreateState<$Item>>
  | SelectSchema<CreateState<$Item>>
  | MultiselectSchema<CreateState<$Item>>
  | ListSchema<CreateState<$Item>, CreateState<$Item>>
  | TextareaSchema<CreateState<$Item>>
  | CodeSchema<CreateState<$Item>>
  | NumberSchema<CreateState<$Item>>
  | SliderSchema<CreateState<$Item>>
  | UploadSchema<CreateState<$Item>>
  | MarkupSchema<CreateState<$Item>>
  | ButtonSchema<CreateState<$Item>>
  | SwitchSchema<CreateState<$Item>>
  | DateSchema<CreateState<$Item>>

export type Component<$State extends State = CreateState> =
  | InputSchema<$State>
  | RadioSchema<$State>
  | CheckboxSchema<$State>
  | CheckboxesSchema<$State>
  | ColorSchema<$State>
  | SelectSchema<$State>
  | MultiselectSchema<$State>
  | ListSchema<$State>
  | TextareaSchema<$State>
  | CodeSchema<$State>
  | NumberSchema<$State>
  | SliderSchema<$State>
  | UploadSchema<$State>
  | MarkupSchema<$State>
  | ButtonSchema<$State>
  | SwitchSchema<$State>
  | DateSchema<$State>
  | ComponentSchema<$State>

export type Components<$State extends State> = {
  [$name in SelectItemKeys<$State['item']>]?: Component<
    CreateState<$State['item'], $name, $State['item'][$name]>
  >
}

export type Buttons<$Item> = {
  [name: string]: Optional<ButtonSchema<CreateState<$Item>>, 'type'>
}

export type Form<$Item = any, $State extends State = CreateState<$Item>> = {
  /**
   * The name of the item model produced by the form.
   */
  name?: OrItemAccessor<$State, {}, string>
  /**
   * The label of the form.
   */
  label?: OrItemAccessor<$State, {}, string | boolean>
  /**
   * @defaultValue `false`
   */
  compact?: boolean
  resource?: Resource
  /**
   * Display several forms in different tabs within the form.
   */
  tabs?: {
    [name: string]: Omit<Form<$Item>, 'tabs'> & { defaultTab?: boolean }
  }
  // TODO: document components
  components?: Components<CreateState<$Item>>
  // TODO: document clipboard
  clipboard?:
    | boolean
    | {
        copy?: (...args: any[]) => any
        paste?: (...args: any[]) => any
      }
  buttons?: Buttons<$Item>
  if?: OrItemAccessor<$State, {}, boolean | string[] | string>
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
  $Views extends { [name: string]: any } = { [name: string]: View }
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

export type SchemaByType<$State extends State = CreateState> = {
  button: ButtonSchema<$State>
  checkbox: CheckboxSchema<$State>
  checkboxes: CheckboxesSchema<$State>
  code: CodeSchema<$State>
  color: ColorSchema<$State>
  component: ComponentSchema<$State>
  date: DateSchema<$State>
  list: ListSchema<$State>
  markup: MarkupSchema<$State>
  multiselect: MultiselectSchema<$State>
  number: NumberSchema<$State>
  radio: RadioSchema<$State>
  select: SelectSchema<$State>
  slider: SliderSchema<$State>
  switch: SwitchSchema<$State>
  text: InputSchema<$State>
  textarea: TextareaSchema<$State>
  upload: UploadSchema<$State>
  unknown: never
}

export type CreateState<
  $Item = any,
  $Name = any,
  $Value = any,
  $Schema extends keyof SchemaByType = 'unknown'
> = {
  item: Required<$Item>
  name: $Name
  value: $Value
  schema: $Schema
}

export type State = {
  item: any
  name: any
  value: any
  schema: keyof SchemaByType
}

export type SchemaAccessorReturnType<T> = T extends ItemAccessor
  ? ReturnType<T>
  : never
export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>
// Allow auto-complete suggestions for string-literal / string unions:
// https://github.com/microsoft/TypeScript/issues/29729#issuecomment-471566609
export type StringSuggestions<T extends U, U = string> =
  | T
  | (U & { _ignore_me?: never })
export type NonNullable<T> = Exclude<T, null | undefined>
export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<
  T,
  Exclude<keyof T, Keys>
> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>
  }[Keys]

export type AnyAlternative<
  $Type,
  $WhenAny,
  $WhenNotAny
> = IsAny<$Type> extends 1 ? $WhenAny : $WhenNotAny

export type FilteredKeys<T, U> = keyof {
  [P in keyof T]: T[P] extends U ? never : P
}

export type ItemNameKeys<$State extends State> = IsAny<
  $State['item'][$State['name']]
> extends 1
  ? string
  : SelectItemKeys<Unpacked<$State['item'][$State['name']]>>

// Wrap individual types when T is a discriminated union by using conditional
// type check:
export type WithoutMethods<T> = IsAny<T> extends 1
  ? any
  : T extends any
  ? {
      [K in SelectKeysNotExtending<T, Function>]: T[K]
    }
  : never

export type Extends<$A extends any, $B extends any> = IsAny<$A> extends 1
  ? 0 // anything `any` is false
  : $A extends $B
  ? 1
  : 0

export type SelectItemKeys<T> = Exclude<
  keyof WithoutMethods<T>,
  `$${string}` | 'QueryBuilderType' | 'foreignKeyId'
>

export type SelectKeysNotExtending<
  $Object,
  $Extending extends any
> = IsAny<$Object> extends 0
  ? {
      [K in keyof $Object]-?: {
        1: never
        0: K
      }[Extends<$Object[K], $Extending>]
    }[keyof $Object]
  : any

export type OrObjectOf<T> = T | { [k: string]: T }
export type OrPromiseOf<T> = T | Promise<T>
export type OrFunctionReturning<T> = (() => T) | T
export type OrArrayOf<T> = T | T[]
export type Resolvable<T> = OrFunctionReturning<OrPromiseOf<OrObjectOf<T>>>

// https://stackoverflow.com/questions/49927523/disallow-call-with-any/49928360#49928360
export type IsAny<T> = 0 extends 1 & T ? 1 : 0

// https://stackoverflow.com/a/52331580/825205
export type Unpacked<T> = T extends (infer U)[] ? U : T
