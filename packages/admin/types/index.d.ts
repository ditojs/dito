// Type definitions for Dito.js admin
// Project: <https://github.com/ditojs/dito/>

import { AxiosResponse as Response } from 'axios'
import { format as utilsFormat, DateFormat, NumberFormat, TimeFormat } from '@ditojs/utils'
import Vue from 'vue'

declare global {
  const dito: DitoGlobal
}

export default DitoAdmin
// export as namespace DitoAdmin;

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
    number?: NumberFormat,
    date?: DateFormat,
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
  /**
   * Use a Vue component to render the component. The component is specified
   * like this: import(...).
   */
  component?: Promise<Vue>

  default?: any
  // compute?: V extends never ? never : SchemaAccessor<C, V> | undefined
}

// TODO: finish off DitoMixin docs
// (methods / computed / watch / events / `on[A-Z]`-style callbacks)
export interface SchemaDitoMixin<$State extends State> {
  /**
   * Only displays the component if the schema accessor returns `true`
   */
  if?: ItemAccessor<$State, boolean>

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
  this: ComponentByType<$State>[$State['component']],
  itemParams: DitoContext<$State>
) => void | false

export interface SchemaTypeMixin<$State extends State> {
  /**
   * The label of the component.
   *
   * @defaultValue The title-cased component name.
   */
  label?: OrItemAccessor<$State, string | boolean>

  /**
   * The width of the component. The value can either be given in percent
   * (e.g. '20%' or a value between 0 and 1), or as 'auto' to have the width
   * depend on its contents or as 'fill' to fill left over space. A line will
   * contain multiple components until their widths exceed 100%.
   */
  width?: OrItemAccessor<$State, 'auto' | 'fill' | string | number>

  /**
   * Whether the component is visible.
   *
   * @defaultValue `true`
   */
  visible?: OrItemAccessor<$State, boolean>

  /**
   * @defaultValue `false`
   */
  // TODO: document exclude
  exclude?: OrItemAccessor<$State, boolean>

  /**
   * Whether the field is required.
   * @defaultValue `false`
   */
  required?: OrItemAccessor<$State, boolean>

  /**
   * Whether the value is read only.
   *
   * @defaultValue `false`
   */
  readonly?: OrItemAccessor<$State, boolean>

  /**
   * Whether to autofocus the field.
   * @defaultValue `false`
   */
  autofocus?: OrItemAccessor<$State, boolean>

  /**
   * Whether the field can be cleared.
   * @defaultValue `false`
   */
  clearable?: OrItemAccessor<$State, boolean>

  /**
   * Specifies a short hint intended to aid the user with data entry when the
   * input has no value.
   */
  placeholder?: OrItemAccessor<$State, any>

  /**
   * Whether the input field should have autocomplete enabled.
   */
  autocomplete?: OrItemAccessor<$State, 'on' | 'off'>

  /**
   * Specifies a function which changes the item value into another format,
   * before it is passed to the component.
   */
  format?: ItemAccessor<$State, any>

  disabled?: OrItemAccessor<$State, boolean>

  /**
   * Specifies a function which parses the component value when it changes,
   *
   */
  parse?: ItemAccessor<$State, any>

  // TODO: document process
  process?: OrItemAccessor<$State, any>

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
  paginate?: OrItemAccessor<$State, number>
  // TODO: document inlined
  /**
   * @defaultValue `false`
   */
  inlined?: OrItemAccessor<$State, boolean>
  /**
   * Whether to add a button to create list items.
   *
   * @defaultValue `false`
   */
  creatable?: OrItemAccessor<
    $State,
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
    | boolean
    | {
        label: string
      }
  >
  /**
   * @defaultValue `false`
   */
  draggable?: OrItemAccessor<$State, boolean>
  /**
   * Whether an inlined form is collapsible.
   * @defaultValue `null`
   */
  collapsible?: OrItemAccessor<$State, boolean | null>
  /**
   * Whether an inlined form is collapsed.
   */
  collapsed?: OrItemAccessor<$State, boolean>
  resource?: Resource
}

export type Options = ({ label: string; value: any } | any)[]
export interface SchemaOptionsMixin<$State extends State> {
  options?:
    | ({ label: string; value: any } | any)[]
    | {
        /**
         * The function which is called to load the options.
         */
        data?: ItemAccessor<$State, OrFunctionReturning<OrPromiseOf<Options>>>
        /**
         * Either the key of the option property which should be treated as
         * the option label or a function returning the option label.
         *
         * @defaultValue `'label'` when no label is supplied and the options are
         * objects
         */
        label?: (option: any) => string
        /**
         * Either the key of the option property which should be treated as
         * the value or a function returning the option value.
         *
         * @defaultValue `'value'` when no label is supplied and the options are
         * objects
         */
        // TODO: when relate is set, the default value is 'id'
        value?: OrItemAccessor<$State, string>
        /**
         * The key of the option property which should used to group the options.
         */
        groupBy?: string
      }
  relate?: boolean
  /**
   * When defined, a search input field will be added to allow searching for
   * specific options.
   */
  search?: {
    filter?: ItemAccessor<$State, string>
    // filter: (
    //   this: ComponentByType[$State['component']],
    //   query: string,
    //   options: any[]
    // ) => OrPromiseOf<any[]> | Response<any[]>
    debounce?:
      | number
      | {
          delay: number
          immediate?: boolean
        }
  }
}

export interface SchemaNumberMixin<$State extends State> {
  /**
   * The minimum value.
   */
  min?: OrItemAccessor<$State, number>

  /**
   * The maximum value.
   */
  max?: OrItemAccessor<$State, number>

  /**
   * The minimum and maximum value.
   */
  range?: OrItemAccessor<$State, [number, number]>
  /**
   * When defined, buttons with up and down arrows are added next to the input
   * field. Which when pressed will add or subtract `step` from the value.
   */
  step?: OrItemAccessor<$State, number>
  /**
   * The amount of decimals to round to.
   */
  decimals?: OrItemAccessor<$State, number>
  rules?: Omit<SchemaNumberMixin<$State>, 'rules'> & {
    integer?: boolean
  }
}

export type InputSchema<$State extends State> = BaseSchema<
  AddComponent<$State, 'text'>
> & {
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

export type ComputedSchema<
  $InputState extends State = CreateState,
  $State extends State = AddComponent<$InputState, 'computed'>
> = BaseSchema<$State> & {
  /**
   * The type of the component.
   */
  type: 'computed'
}

export type DateSchema<
  $InputState extends State = CreateState,
  $State extends State = AddComponent<$InputState, 'date'>
> = BaseSchema<$State> & {
  /**
   * The type of the component.
   */
  type: 'date' | 'datetime' | 'time'
  /**
   * @defaultValue `En/US`
   */
  locale?: string
  dateFormat?: OrItemAccessor<$State, DateFormat>
}

export type ButtonSchema<
  $InputState extends State = CreateState,
  $State extends State = AddComponent<$InputState, 'button'>,
  $EventHandler = ItemEventHandler<$State>
> = BaseSchema<$State> & {
  /**
   * The type of the component.
   */
  type: 'button' | 'submit'
  closeForm?: OrItemAccessor<$State, boolean>
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
  $InputState extends State = CreateState,
  $State extends State = AddComponent<$InputState, 'switch'>
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
  $InputState extends State = CreateState,
  $State extends State = AddComponent<$InputState, 'number'>
> = SchemaNumberMixin<$State> &
  BaseSchema<$State> & {
    /**
     * The type of the component.
     */
    type: 'number' | 'integer'
  }

export type SliderSchema<
  $InputState extends State = CreateState,
  $State extends State = AddComponent<$InputState, 'slider'>
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
  $InputState extends State = CreateState,
  $State extends State = AddComponent<$InputState, 'textarea'>
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
  $InputState extends State = CreateState,
  $State extends State = AddComponent<$InputState, 'code'>
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
  $InputState extends State = CreateState,
  $State extends State = AddComponent<$InputState, 'markup'>
> = BaseSchema<$State> & {
  /**
   * The type of the component.
   */
  type: 'markup'
  /**
   * Whether the input element is resizable.
   */
  resizable?: OrItemAccessor<$State, boolean>
  /**
   * @defaultValue `'collapse'`
   */
  whitespace?: OrItemAccessor<$State, 'collapse' | 'preserve' | 'preserve-all'>
  /**
   * The amount of visible lines.
   *
   * @defaultValue `10`
   */
  lines?: number

  // TODO: document enableRules
  enableRules?: OrItemAccessor<
    $State,
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
  $InputState extends State = CreateState,
  $State extends State = AddComponent<$InputState, 'upload'>
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

export type MultiselectSchemaMixin = {
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
   * @defaultValue `false`
   */
  // TODO: document searchable
  searchable?: boolean
  /**
   * @defaultValue `false`
   */
  // TODO: document taggable
  taggable?: boolean
}

export type MultiSelectSchema<
  $InputState extends State = CreateState,
  $State extends State = AddComponent<$InputState, 'multiselect'>
> = BaseSchema<$State> & SchemaOptionsMixin<$State> & MultiselectSchemaMixin

export type SelectSchema<
  $InputState extends State = CreateState,
  $State extends State = AddComponent<$InputState, 'select'>
> = BaseSchema<$State> &
  SchemaOptionsMixin<$State> & {
    /**
     * The type of the component.
     */
    type: 'select'
  }

export type RadioSchema<
  $InputState extends State = CreateState,
  $State extends State = AddComponent<$InputState, 'radio'>
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
  $InputState extends State = CreateState,
  $State extends State = AddComponent<$InputState, 'checkbox'>
> = BaseSchema<$State> & {
  /**
   * The type of the component.
   */
  type: 'checkbox'
}

export type CheckboxesSchema<
  $InputState extends State = CreateState,
  $State extends State = AddComponent<$InputState, 'checkboxes'>
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
export type ColorSchema<$State extends State = CreateState> = BaseSchema<
  AddComponent<$State, 'color'>
> & {
  /**
   * The type of the component.
   */
  type: 'color'
  /**
   * The color format.
   */
  format?: OrItemAccessor<AddComponent<$State, 'color'>, ColorFormat>
  /**
   * Whether the color may contain an alpha component.
   *
   * @defaultValue `false`
   */
  alpha?: OrItemAccessor<AddComponent<$State, 'color'>, boolean>
  /**
   * @defaultValue true
   */
  // TODO: document inputs
  /**
   * @defaultValue `true`
   */
  inputs?: OrItemAccessor<AddComponent<$State, 'color'>, boolean>
  /**
   * Color presets as an array of color values as strings in any css
   * compatible format.
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/CSS/color_value}
   */
  presets?: OrItemAccessor<AddComponent<$State, 'color'>, string[]>
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
  render?: ItemAccessor<$State, string>
  /**
   * The provided string is applied to the class property of the column
   * cell html elements.
   */
  class?: string
  /**
   * The provided string is applied to the style property of the column
   * cell html elements.
   */
  style?: string
}

export type WrapResolvableForm<U> = U extends any
  ? Resolvable<Resolvable<Form<U>>>
  : never

export type ListSchema<
  $InputState extends State = CreateState,
  $State extends State = AddComponent<$InputState, 'list'>,
  $ListItem = WithoutMethods<Unpacked<$State['item'][$State['name']]>>
> = SchemaSourceMixin<$State> &
  BaseSchema<$State> & {
    /**
     * The type of the view
     */
    type: 'list'
    /**
     * The form.
     */
    form?: WrapResolvableForm<$ListItem>
    /**
     * The forms.
     */
    forms?: WrapResolvableForm<$ListItem>
    /**
     * The label given to the items. If no itemLabel is given, the default is
     * the 'name' property of the item, followed by label of the form of the
     * view (plus item id) and other defaults.
     */
    itemLabel?: ItemNameKeys<$State> | ItemAccessor<$State, string>
    /**
     * The columns displayed in the table. While columns can be supplied as an
     * array where each entry is the name of a property of the item, it is
     * usually beneficial to assign an object with further options to the
     * columns property.
     */
    columns?:
      | ItemNameKeys<$State>[]
      | AnyAlternative<
          $State['item'],
          {
            [name: string]: ColumnSchema<$State>
          },
          Partial<
            {
              [$ItemName in keyof $ListItem]:
                | ColumnSchema<
                    CreateState<
                      $ListItem,
                      $ItemName,
                      $ListItem[$ItemName]
                    >
                  >
                | never
            }
          >
        >
    /**
     * Scope names as defined on the model. When set, the admin renders a set of
     * scope buttons, allowing the user to switch between them while editing.
     */
    scopes?:
      | string[]
      | {
          [scopeName: string]: {
            label?: string
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
            operators?: readonly (
              | 'contains'
              | 'equals'
              | 'starts-with'
              | 'ends-with'
            )[]
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

export type OrItemAccessor<$State extends State, $ReturnValue = $State['value']> =
  | ItemAccessor<$State, $ReturnValue>
  | $ReturnValue

export type ItemAccessor<
  $State extends State = CreateState,
  $ReturnValue = $State['value']
> = (
  this: ComponentByType[$State['component']],
  params: DitoContext<$State>
) => $ReturnValue

export interface ValidatorMixin {
  // computed
  mainSchemaComponent: any
  errors: null | string[]
  isTouched: boolean
  isDirty: boolean
  isValid: boolean
  isValidated: boolean

  // methods
  validateAll(match: any, notify?: boolean): boolean
  verifyAll(match: any): boolean
  resetValidation(): void
  clearErrors(): void
  showValidationErrors(): void
}

export interface ValidationMixin {
  data: {
    isTouched: boolean
    isDirty: boolean
    isValidated: boolean
    isValid: boolean
    errors: null | any[]
  }

  // computed
  events: {
    focus: () => void
    blur: () => void
    change: () => void
    input: () => void
  }

  // methods
  resetValidation(): void
  validate(notify?: boolean): boolean
  verify(): boolean
  markDirty(): void
  addError(error: string, addLabel?: boolean): void
  showValidationErrors(errors: string[], focus?: boolean): true
  getErrors(): string[] | null
  clearErrors(): void
}

export interface RouteMixin {
  data: {
    reload: boolean
    store: any
    loadCache: any
  }

  // computed
  routeComponent: Vue
  routeRecord: any
  isLastRoute: boolean
  isLastUnnestedRoute: boolean
  isNestedRoute: boolean
  meta?: any
  path: string
  label: string
  breadcrumb: string
  breadcrumbPrefix: string
  param: any | null
  doesMutate: boolean

  // methods
  beforeRouteChange(to: any, from: any, next: any): void
  getRoutePath(templatePath: string): string
  getChildPath(path: string): string
  isFullRouteChange(to: any, from: any): boolean
}

export interface ItemMixin {
  // // methods
  getItemForm(schema: any, item: any): any

  getItemId(sourceSchema: any, item: any, uid: any): string | undefined

  getItemDataPath(sourceSchema: any, index: any): string

  findItemIdIndex(sourceSchema: any, data: any, itemId: any): number | null

  getItemLabel(
    sourceSchema: any,
    item: any,
    options?: {
      index?: string | null
      extended?: boolean
      asObject?: boolean
    }
  ): { text: string; prefix: string; suffix: string } | string
}

export type LoadingMixin = {
  data: {
    isLoading: boolean
  }

  // methods
  setLoading(
    isLoading: boolean,
    options?: { updateRoot?: boolean; updateView?: boolean }
  ): void
}
export type ResourceMixin = ItemMixin &
  LoadingMixin & {
    data: {
      loadedData: any
      isResource: boolean
    }

    // computed
    resource: any
    providesData: boolean
    isTransient: boolean
    transientNote: string
    shouldLoad: boolean
    hasData: string
    verbs: {
      [k: string]: string
    }
    paginationRange: [number, number]
    queryParams: {
      [k: string]: any
    }

    // methods
    getResource(): any
    getVerbs: {
      [k: string]: string
    }
    clearData(): void
    setData(data: any): void
    setupData(): void
    ensureData(): void
    reloadData(): void
    loadData(clear?: boolean): void
    createData(schema: any, type: any): void
    requestData(): void
    isValidationError(response: { status: number }): boolean
    isUnauthorizedError(response: { status: number }): boolean
    handleRequest(
      method: HTTPVerb,
      resource: any,
      data: any,
      params: any
    ): Promise<any>
    getPayloadData(button: any, method: HTTPVerb): any
    submit(button: any): Promise<boolean>
    submitResource(
      button: any,
      resource: any,
      method: HTTPVerb,
      data: any,
      options?: {
        setData?: boolean
        notifySuccess?: () => void
        notifyError?: (error: any) => void
      }
    ): Promise<boolean>
    emitButtonEvent(
      button: any,
      event: string,
      options: {
        notify?: () => void
        error: any
      }
    ): Promise<void>
  }

export interface SchemaParentMixin {
  //data
  schemaComponents: any[]
  // provide
  $schemaParentComponent: Vue
}

export type DomEventHandler = <T extends Event>(e: T) => void

export interface DomMixin {
  data: {
    domHandlers: { remove: () => void }[]
  }

  // methods
  domOn(
    element: Element,
    handlersByEvent: { [eventName: string]: DomEventHandler }
  ): void
  domOn(element: Element, type: string, handler?: DomEventHandler): void
}

export interface EmitterMixin {
  data: {
    $events: null | {
      [eventName: string]: {
        callbacks: ((...args: any[]) => void)[]
        queue: { args: any[]; resolve: (result: any) => void }[]
      }
    }
  }

  // methods
  on(event: string, callback: (...args: any[]) => void): this
  once(event: string, callback: (...args: any[]) => void): this
  off(event: string, callback: (...args: any[]) => void): this
  emit(event: string, ...args: any[]): void
  responds(event: string): boolean
  delegate<T extends EmitterMixin>(event: OrArrayOf<string>, target: T): this
}

export type DitoMixin<$State> = EmitterMixin & {
  $dataComponent?: () => Vue
  $sourceComponent?: () => Vue
  $resourceComponent?: () => Vue

  data: {
    appState: {
      title: string
      routeComponents: any[]
      user: any | null
      loadCache: any
      activeLabel: string | null
    }
    overrides: any | null
  }

  // computed
  sourceSchema: any
  user: any
  verbs: {
    [k: string]: string
  }
  isPopulated: boolean
  locale: string
  rootComponent: DitoRoot
  schemaComponent: Vue
  routeComponent: Vue
  formComponent: DitoForm | null
  viewComponent: DitoView | null
  dataComponent: Vue
  sourceComponent: Vue
  resourceComponent: Vue
  parentSchemaComponent: Vue | undefined
  parentRouteComponent: Vue | undefined
  parentFormComponent: Vue | undefined
  rootData: any | undefined

  // methods
  getStore(key: string): any
  setStore<T>(key: string, value: T): T
  getChildStore<T extends any>(key: string): T
  getSchemaValue(
    keyOrDataPath: OrArrayOf<string>,
    options?: {
      type?: OrArrayOf<string>
      default?: (params: any) => any
      schema?: any
    }
  ): any
  getLabel(schema: any, name?: string): string
  labelize(string: string): string
  getButtonAttributes(
    name: string,
    button: any
  ): {
    class: string
    title: string
  }
  getDragOptions(
    draggable: boolean
  ): {
    animation: number
    disabled: boolean
    handle: string
    dragClass: string
    chosenClass: string
    ghostClass: string
  }
  getQueryLink<T extends any>(
    query: T
  ): {
    query: T
    hash: string
  }
  shouldRender(schema?: any): boolean
  showDialog<$Item>(options: {
    components: Components<any>
    buttons?: Buttons<$Item>
    data: any
    settings?: {
      width: number
      height: number | string
      clickToClose: boolean
    }
  }): Promise<$Item>
  getResourcePath(resource: any): string | null
  request<T extends any>(options: {
    cache?: 'local' | 'global'
    url: string
    /**
     * @defaultValue `'get'`
     */
    method?: HTTPVerb
    params?: any
    data?: any
  }): T
  navigate(location: string | { path: string }): Promise<boolean>
  download: {
    (url: string): void
    (options: { url: string; filename: string }): void
  }
  notify(options: {
    type: StringSuggestions<'warning' | 'error' | 'info' | 'success'>
    title: string
    text: OrArrayOf<string>
  }): void
  closeNotifications(): void
  setupSchemaFields(): void
  setupMethods(): void
  setupComputed(): void
  setupEvents(): void
  // emitEvent<T extends BaseSchema<any, any, any, any>>(
  //   event: string,
  //   options?: {
  //     params?: OrFunctionReturning<
  //       Partial<DitoContext<$State>>
  //     >
  //     parent?: T
  //   }
  // ): Promise<any | boolean>
  sendRequest(options: {
    method: HTTPVerb
    url?: string
    resource: any
    data: any
    params: any
    internal?: boolean
  }): Promise<any>
}

export type MixinComponent<$State extends State> = ValidationMixin & {
  data: {
    focused: boolean
  }

  // computed
  name: $State['name']
  type: string
  value: $State['value']
  item: $State['item']
  parentItem: any
  rootItem: any
  processedItem: any
  validations: any
  dataProcessor: any
  label: SchemaAccessorReturnType<SchemaTypeMixin<$State>['label']>
  width: SchemaAccessorReturnType<SchemaTypeMixin<$State>['width']>
  visible: SchemaAccessorReturnType<SchemaTypeMixin<$State>['visible']>
  exclude: SchemaAccessorReturnType<SchemaTypeMixin<$State>['exclude']>
  required: SchemaAccessorReturnType<SchemaTypeMixin<$State>['required']>
  autofocus: SchemaAccessorReturnType<SchemaTypeMixin<$State>['autofocus']>
  clearable: SchemaAccessorReturnType<SchemaTypeMixin<$State>['clearable']>
  placeholder: SchemaAccessorReturnType<SchemaTypeMixin<$State>['placeholder']>
  autocomplete: SchemaAccessorReturnType<
    SchemaTypeMixin<$State>['autocomplete']
  >

  // methods
  getValidations(): any[] | null
  getDataProcessor(): any | null
  focus(): void
  clear(): void
}

export type NumberMixin<$State extends State> = {
  // computed
  inputValue: string
  isInteger: boolean
  stepValue: 'any' | number
  decimals: SchemaAccessorReturnType<NumberSchema<$State>['decimals']>
  step: SchemaAccessorReturnType<NumberSchema<$State>['step']>
  min: SchemaAccessorReturnType<NumberSchema<$State>['min']>
  max: SchemaAccessorReturnType<NumberSchema<$State>['max']>
  range: SchemaAccessorReturnType<NumberSchema<$State>['range']>

  // validations
  getValidations(): any[] | null
}

export type SourceMixin<$State extends State> = ResourceMixin &
  SchemaParentMixin & {
    data: {
      isSource: boolean
      wrappedPrimitives: any | null
      unwrappingPrimitives: boolean
      ignoreRouteChange: boolean
    }

    // computed
    isObjectSource: boolean
    isListSource: boolean
    isReady: boolean
    isInView: boolean
    wrapPrimitives: any
    listData: any
    objectData: any
    sourceSchema: any
    path: string
    defaultQuery: { order?: string }
    query: any
    total: any
    columns: any
    scopes: any
    defaultScope: any
    defaultOrder: any
    nestedMeta: any
    forms: any[]
    buttonSchemas: any
    hasLabels: boolean
    isCompact: boolean
    paginate: SchemaAccessorReturnType<SchemaSourceMixin<$State>['paginate']>
    /**
     * @defaultValue `false`
     */
    inlined: SchemaAccessorReturnType<SchemaSourceMixin<$State>['inlined']>
    /**
     * @defaultValue `false`
     */
    creatable: SchemaAccessorReturnType<SchemaSourceMixin<$State>['creatable']>
    /**
     * @defaultValue `false`
     */
    editable: SchemaAccessorReturnType<SchemaSourceMixin<$State>['editable']>
    /**
     * @defaultValue `false`
     */
    deletable: SchemaAccessorReturnType<SchemaSourceMixin<$State>['deletable']>
    /**
     * @defaultValue `false`
     */
    draggable: SchemaAccessorReturnType<SchemaSourceMixin<$State>['draggable']>
    /**
     * @defaultValue `false`
     */
    collapsible: SchemaAccessorReturnType<
      SchemaSourceMixin<$State>['collapsible']
    >
    /**
     * @defaultValue `false`
     */
    collapsed: SchemaAccessorReturnType<SchemaSourceMixin<$State>['collapsed']>

    // methods
    setupData(): void
    clearData(): void
    unwrapListData(data: any): any[] | undefined
    createItem(schema: any, type: any): any
    removeItem(item: any): void
    deleteItem(item: any, index: any): void
    openSchemaComponent(index: any): void
    navigateToComponent(
      dataPath: OrArrayOf<string>,
      onComplete: (routeComponent: Vue) => void
    ): boolean
    processSchema(
      api: any,
      schema: any,
      name: any,
      routes: any,
      level: number,
      nested?: boolean,
      flatten?: boolean,
      process?: (routes: any[], level: number) => Promise<void>
    ): Promise<void>
  }

export type OptionsMixin<$State extends State> = {
  data: {
    loadedOptions: any | null
    hasOptions: boolean
  }

  // computed
  selectedValue: any
  selectedOption: any
  options: any
  activeOptions: any
  relate: boolean
  groupBy: any
  groupByLabel: any
  groupByOptions: any
  optionLabel: any
  optionValue: any
  searchFilter: any

  // methods
  getDataProcessor(): any | null
  getOptionKey(key: string): any
  loadOptions<T extends any>(
    load: () => Promise<T>,
    settings?: { updateRoot?: boolean; updateView?: boolean }
  ): Promise<T>
  processOptions(options: any): any
  hasOption(option: any): boolean
  getOptionForValue(value: any): any
  getValueForOption(option: any): any | undefined
  getLabelForOption(option: any): string
}

export type OrderedMixin<$State> = {
  data: {
    dragging: false
  }

  // methods
  onStartDrag(): void
  onEndDrag(): void
  updateOrder(list: any, schema: any, draggable: boolean): any[] | undefined
}

export class BaseComponent<$State> extends DitoComponent<$State> {
  data: DitoComponent<$State>['data'] & MixinComponent<$State>['data']
  component: Vue
  static register(types: OrArrayOf<string>, definition: any): Vue
  static get(type: string): Vue
}
export interface BaseComponent<$State extends State> extends MixinComponent<$State> {}

export class NumberComponent<
  $InputState extends State,
  $State extends State = $InputState & {
    component: NumberComponent<$InputState>
  }
> extends BaseComponent<$State> {
  schema: NumberSchema<$State>

  // computed:
  isInteger: boolean
}
export interface NumberComponent<
  $InputState extends State = CreateState,
  $State extends State = $InputState & {
    component: NumberComponent<$InputState>
  }
> extends NumberMixin<$State> {}

export class ButtonComponent<
  $InputState extends State = CreateState,
  $State extends State = AddComponent<$InputState, 'button'>
> extends BaseComponent<$State> {
  schema: ButtonSchema<$State>

  // computed
  verb: string
  text: string
  closeForm: SchemaAccessorReturnType<ButtonSchema<$State>['closeForm']>

  // methods
  onClick(): Promise<void>
  submit(): Promise<any>
}

export class CheckboxComponent<
  $InputState extends State = CreateState,
  $State extends State = AddComponent<$InputState, 'button'>
> extends BaseComponent<$State> {
  schema: CheckboxSchema
}

export class CheckboxesComponent<
  $InputState extends State = CreateState,
  $State extends State = AddComponent<$InputState, 'button'>
> extends BaseComponent<$State> {
  schema: CheckboxesSchema
  data: BaseComponent<$State>['data'] & OptionsMixin<$State>['data']
}
export interface CheckboxesComponent<
  $InputState extends State,
  $State extends State = AddComponent<$InputState, 'button'>
> extends OptionsMixin<$State> {}

export class CodeComponent<
  $InputState extends State = CreateState,
  $State extends State = AddComponent<$InputState, 'code'>
> extends BaseComponent<$State> {
  schema: SchemaByType<$State>[$State['component']]

  // computed
  lines: number
  style: string

  /**
   * Focuses the textarea element.
   */
  focus(): void
}

export class ColorComponent<
  $InputState extends State = CreateState,
  $State extends State = AddComponent<$InputState, 'color'>
> extends BaseComponent<$State> {
  schema: ColorSchema<$State>

  data: BaseComponent<$State>['data'] & {
    showPopup: boolean
    convertedHexValue: string | null
  }

  // computed
  colorValue: string
  hexValue: string
  format: SchemaAccessorReturnType<ColorSchema['format']>
  alpha: SchemaAccessorReturnType<ColorSchema['alpha']>
  inputs: SchemaAccessorReturnType<ColorSchema['inputs']>
  presets: SchemaAccessorReturnType<ColorSchema['presets']>
}

export class ComputedComponent<
  $InputState extends State,
  $State extends State = AddComponent<$InputState, 'list'>
> extends BaseComponent<$State> {}

export class DateComponent<
  $InputState extends State,
  $State extends State = AddComponent<$InputState, 'list'>
> extends BaseComponent<$State> {
  schema: DateSchema<$State>

  // computed
  dateValue: Date
  dateFormat: SchemaAccessorReturnType<DateSchema<$State>['dateFormat']>

  // methods
  getComponent<T extends 'date' | 'time' | 'datetime'>(
    type: T
  ): T extends 'date'
    ? 'date-picker'
    : T extends 'time'
    ? 'time-picker'
    : T extends 'datetime'
    ? 'date-time-picker'
    : never
  getDataProcessor(): any | null
}

export class ListComponent<
  $InputState extends State,
  $State extends State = AddComponent<$InputState, 'list'>
> extends BaseComponent<$State> {
  schema: ListSchema<$State>

  data: BaseComponent<$State>['data'] & OrderedSourceMixin<$State>['data']

  // computed
  hasListButtons: boolean
  hasEditButtons: boolean
  hasCellEditButtons: boolean
  hasEventCount: boolean
  numColumns: number

  // methods
  getDataPath(index: number): string
  getEditPath(item: any, index: any): string | null
  getCellClass(cell: { name: string }): string
  getDitoContext(item: any, index: any): any
  onFilterErrors(errors: string[]): true | undefined
}
export interface ListComponent<
  $InputState extends State = CreateState,
  $State extends State = AddComponent<$InputState, 'list'>
> extends OrderedSourceMixin<$State> {}

export class MarkupComponent<
  $InputState extends State,
  $State extends State = AddComponent<$InputState, 'list'>
> extends BaseComponent<$State> {
  schema: MarkupSchema
  data: BaseComponent<$State>['data'] &
    DomMixin['data'] & {
      editor: null
      height: null
    }
  // computed
  lines: number
  styles: {
    height: any | null
  }
  markButtons: any
  basicNodeButtons: any
  otherNodeButtons: any
  toolButtons: any
  groupedButtons: any
  parseOptions: {
    preserveWhitespace: boolean | 'full'
  }
  editorOptions: {
    editable: boolean
    autoFocus: boolean
    disableInputRules: boolean
    disablePasteRules: boolean
    parseOptions: MarkupComponent<$State>['parseOptions']
  }
  resizable: SchemaAccessorReturnType<MarkupSchema<$State>['resizable']>
  whitespace: SchemaAccessorReturnType<MarkupSchema<$State>['whitespace']>
  enableRules: SchemaAccessorReturnType<MarkupSchema<$State>['enableRules']>

  // methods
  onDragResize(event: { clientX: number; clientY: number }): void
  updateEditorOptions(): void
  onClickLink(command: (command: { href: string; title: string }) => void): void
  createExtensions(): void
  getButtons(settingsName: string, descriptions: any): any
  /**
   * Scrolls the editor into view and focuses it.
   */
  focus(): void
}
export interface MarkupComponent<$InputState extends State> extends DomMixin {}

export class RadioComponent<
  $InputState extends State,
  $State extends State = AddComponent<$InputState, 'radio'>
> extends BaseComponent<$State> {
  schema: RadioSchema<$State>

  data: BaseComponent<$State>['data'] & OptionsMixin<$State>['data']
}
export interface RadioComponent<
  $InputState extends State,
  $State extends State = AddComponent<$InputState, 'radio'>
> extends OptionsMixin<$State> {}

// // TODO: TypeSection

export class SelectComponent<
  $InputState extends State,
  $State extends State = AddComponent<$InputState, 'list'>
> extends BaseComponent<$State> {
  schema: SelectSchema<$State>

  data: BaseComponent<$State>['data'] &
    OptionsMixin<$State>['data'] & {
      populate: true
    }
}
export interface SelectComponent<
  $InputState extends State,
  $State extends State = AddComponent<$InputState, 'list'>
> extends OptionsMixin<$State> {}

export class SliderComponent<
  $InputState extends State = CreateState,
  $State extends State = AddComponent<$InputState, 'slider'>
> extends BaseComponent<$State> {
  schema: SliderSchema<$State>

  // computed
  input: ItemAccessor<$State, boolean>
}
export interface SliderComponent<
  $InputState extends State = CreateState,
  $State = AddComponent<$InputState, 'slider'>
> extends NumberMixin<$State> {}

export class SwitchComponent<
  $InputState extends State = CreateState,
  $State extends State = AddComponent<$InputState, 'text'>
> extends BaseComponent<$State> {
  schema: SwitchSchema<$State>

  // computed
  labels: SwitchSchema<$State>['labels']
}

export class TextComponent<
  $InputState extends State = CreateState,
  $State extends State = AddComponent<$InputState, 'text'>
> extends BaseComponent<$State> {
  schema: InputSchema<$State>

  // computed
  inputType: 'text' | 'password'
  inputValue?: string

  // methods:
  // TODO: getValidations()
}

export class TextareaComponent<
  $InputState extends State = CreateState,
  $State extends State = AddComponent<$InputState, 'textarea'>
> extends BaseComponent<$State> {
  schema: SchemaByType[$State['component']]
  // computed
  lines: number
  resizable: ItemAccessor<$State, boolean>
}

// // TODO: TypeTreeList

export class UploadComponent<
  $InputState extends State = CreateState,
  $State extends State = AddComponent<$InputState, 'upload'>
> extends BaseComponent<$State> {
  schema: UploadSchema
  data: BaseComponent<$State>['data'] & OrderedMixin<$State>['data']
  // computed
  upload: any
  files: any
  multiple: ItemAccessor<$State>
  extensions: NonNullable<UploadSchema['extensions']>
  // TODO: finish off
  // accept:
}
export interface UploadComponent<
  $InputState extends State = CreateState,
  $State extends State = AddComponent<$InputState, 'upload'>
> extends OrderedMixin<$State> {}

export type OrderedSourceMixin<$State extends State> = SourceMixin<$State> &
  OrderedMixin<$State>

export class DitoComponent<$State extends State> extends Vue {
  // schema: BaseSchema<any, any>
  // methods
  getTypeComponent(type: string): Vue
  resolveTypeComponent<T extends any>(
    component: OrFunctionReturning<
      OrPromiseOf<T extends { default: infer R } ? R : T>
    >
  ): T & {
    mixins: any[]
    components: any
  }
}
export interface DitoComponent<$State extends State = CreateState>
  extends DitoMixin<$State> {}

export class MultiselectComponent<
  $InputState extends State = CreateState,
  $State extends State = AddComponent<$InputState, 'multiselect'>
> extends BaseComponent<$State> {
  data: BaseComponent<$State>['data'] & OptionsMixin<$State>['data']

  // computed
  selectedOptions: any
  activeOptions: any
  multiple: boolean
  searchable: boolean
  taggable: boolean

  // methods
  addTagOption(tag: any): void
  onAddTag(tag: any): void
  onSearchChange(query: any): Promise<void>
}
export interface MultiselectComponent<
  $InputState extends State = CreateState,
  $State extends State = AddComponent<$InputState, 'multiselect'>
> extends OptionsMixin<$State> {}

export class DitoRoot<$State extends State = CreateState> extends DitoComponent<
  $State
> {
  data: DitoComponent<$State>['data'] &
    DomMixin['data'] & {
      allowLogin: boolean
      resolvedViews: any
      notificationCount: number
      loadingCount: number
    }

  // computed
  notifications: any
  isLoading: boolean

  // methods
  closeNotifications(): void
  registerLoading(isLoading: boolean): void
  login(): Promise<void>
  logout(): Promise<void>
  navigateHome(): Promise<void>
  fetchUser(): Promise<any>
  setUser(user: any): void
  ensureUser(): Promise<void>
  resolveViews(): Promise<void>
}
export interface DitoRoot extends DomMixin {}

export class DitoForm extends DitoComponent {
  data: DitoComponent['data'] &
    RouteMixin['data'] &
    ResourceMixin['data'] & {
      createdData: any | null
      clonedData?: any
      sourceKey: any | null
      isForm: true
    }

  // computed
  schema: any
  buttonSchemas: any
  isActive: boolean
  isTransient: boolean
  isCreating: boolean
  isDirty: boolean
  selectedTab: any | null
  doesMutate: boolean
  type: any
  itemId: any | null
  method: 'post' | 'patch'
  resource: any
  breadcrumbPrefix: string
  // data: any | null
  dataPath: string
  sourceData: any
  inheritedData: any

  // methods
  getDataPathFrom(route: any): any
  setSourceData(data: any): boolean
  addSourceData(data: any): boolean
  clearClonedData(newValue: any, oldValue: any): void
  cancel(): Promise<any>
  close(): Promise<any>
  submit(
    button: any,
    options?: { validate?: boolean; closeForm?: boolean }
  ): Promise<boolean>
  submitTransient(
    button: any,
    resource: any,
    method: HTTPVerb,
    data: any,
    options: {
      notifyError?: (error: any) => void
      notifySuccess?: () => void
    }
  ): Promise<boolean>
}
export interface DitoForm extends RouteMixin, ResourceMixin {}

export class DitoView extends DitoComponent {
  data: DitoComponent['data'] &
    RouteMixin['data'] & {
      isView: true
      isLoading: false
      data: any
    }

  // computed
  schema: any
  name: string
  isSingleComponentView: boolean
  mainComponent: Vue
  viewSchema: any
  providesData: boolean

  // methods
  setData(data: any): void
  getChildPath(path: string): string
  setLoading(isLoading: boolean): void
}
export interface DitoView extends RouteMixin {}

export class DitoDialog extends DitoComponent {
  data: DitoComponent['data'] & {
    windowEvents: any | null
  }

  // computed
  name: string
  schema: any
  buttonSchemas: any
  hasCancel: boolean
  meta: any

  // methods
  hide(): void
  resolve(value: any): void
  reject(value: any): void
  accept(): void
  cancel(): void
}

export interface DitoContext<$State extends State> {
  value: $State['value']
  name: $State['name']
  dataPath: string
  item: $State['item']
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
  component: $State['component']
  schemaComponent: Vue | null
  formComponent: DitoForm | null
  viewComponent: DitoView | null
  dialogComponent: DitoDialog | null
  panelComponent: Vue | null
  sourceComponent: Vue | null
  option: any
  options: any
  query: string
  error: any | null
  request: DitoMixin<$State>['request']
  navigate: DitoMixin<$State>['navigate']
  download: DitoMixin<$State>['download']
  notify: DitoMixin<$State>['notify']
  format: typeof utilsFormat
  wasNotified: boolean
}

export type ComponentSchema<$State extends State = CreateState> =
  | InputSchema<$State>
  | RadioSchema<$State>
  | CheckboxSchema<$State>
  | CheckboxesSchema<$State>
  | ColorSchema<$State>
  | SelectSchema<$State>
  | MultiSelectSchema<$State>
  | ListSchema<$State>
  | TextareaSchema
  | CodeSchema<$State>
  | NumberSchema<$State>
  | SliderSchema<$State>
  | UploadSchema<$State>
  | MarkupSchema<$State>
  | ButtonSchema<$State>
  | SwitchSchema<$State>
  | DateSchema<$State>
  | ComputedSchema<$State>

export type Components<$State extends State> = AnyAlternative<
  $State['item'],
  {
    [name: string]: ComponentSchema<$State>
  },
  {
    [$ItemName in keyof $State['item']]?:
      | ComponentSchema<
          CreateState<$State['item'], $ItemName, $State['item'][$ItemName]>
        >
      | never
  }
>

export type Buttons<$Item> = AnyAlternative<
  $Item,
  {
    [name: string]: Optional<ButtonSchema, 'type'>
  },
  {
    [name: string]: Optional<ButtonSchema<CreateState<$Item>>, 'type'>
  }
>

export type Form<$InputItem = any, $Item = WithoutMethods<$InputItem>> = {
  /**
   * The label of the form.
   */
  label?: OrItemAccessor<CreateState<$Item>, string | boolean>
  /**
   * @defaultValue `false`
   */
  compact?: boolean
  resource?: Resource
  /**
   * Display several forms in different tabs within the form.
   */
  tabs?: {
    [name: string]: Omit<Form<$Item>, 'tabs'>
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
}

export type View<$InputItem = any, $Item = WithoutMethods<$InputItem>> = ListSchema<
  CreateState<$Item>
> & {
  /**
   * The route of the view. If no path is given, the hyphenated export name
   * is used.
   */
  path?: string
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

export type ComponentByType<$State extends State = CreateState> = {
  button: ButtonComponent<$State>
  checkbox: CheckboxComponent<$State>
  checkboxes: CheckboxesComponent<$State>
  code: CodeComponent<$State>
  color: ColorComponent<$State>
  computed: ComputedComponent<$State>
  date: DateComponent<$State>
  list: ListComponent<$State>
  markup: MarkupComponent<$State>
  multiselect: MultiselectComponent<$State>
  number: NumberComponent<$State>
  radio: RadioComponent<$State>
  select: SelectComponent<$State>
  slider: SliderComponent<$State>
  switch: SwitchComponent<$State>
  text: TextComponent<$State>
  textarea: TextareaComponent<$State>
  upload: UploadComponent<$State>
  unknown: never
}

export type SchemaByType<$State extends State = CreateState> = {
  button: ButtonSchema<$State>
  checkbox: CheckboxSchema<$State>
  checkboxes: CheckboxesSchema<$State>
  code: CodeSchema<$State>
  color: ColorSchema<$State>
  computed: ComputedSchema<$State>
  date: DateSchema<$State>
  list: ListSchema<$State>
  markup: MarkupSchema<$State>
  multiselect: MultiSelectSchema<$State>
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
  $Component extends keyof ComponentByType = 'unknown',
  $Schema extends keyof SchemaByType = 'unknown'
> = {
  item: $Item
  name: $Name
  value: $Value
  component: $Component
  schema: $Schema
}

export type State = {
  item: any
  name: any
  value: any
  component: keyof ComponentByType
  schema: keyof SchemaByType
}

export type AddComponent<
  $State extends State,
  $Component extends keyof ComponentByType
> = {
  item: $State['item']
  name: $State['name']
  value: $State['value']
  schema: $State['schema']
  component: $Component
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

export type AnyAlternative<$Type, $WhenAny, $WhenNotAny> = IsAny<$Type> extends 1
  ? $WhenAny
  : $WhenNotAny

export type FilteredKeys<T, U> = keyof { [P in keyof T]: T[P] extends U ? never : P }

export type ItemNameKeys<$State extends State> = IsAny<$State['item'][$State['name']]> extends 1
  ? string
  : keyof WithoutMethods<Unpacked<$State['item'][$State['name']]>>;

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

export type SelectKeysNotExtending<$Object, $Extending extends any> = IsAny<
  $Object
> extends 0
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
