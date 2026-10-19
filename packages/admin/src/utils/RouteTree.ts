import { toRaw, type Component } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import { getValueAtDataPath, parseDataPath } from '@ditojs/utils'
import { getFormSchemas, hasFormSchema } from './schema/lookup.js'
import {
  getPanelSchemas,
  getSchemaPath,
  isInlined,
  isListSource,
  isMenu,
  hasNestedData,
  isObjectSource,
  isSingleComponentView,
  iterateNestedSchemaComponents
} from './schema/structure.js'
import {
  getSourceType,
  getTypeDescriptor,
  getChildSourceSchemas
} from './schema/types.ts'
import { getItemId } from './schema/data.js'
import { findItemIndexById } from './schema/item.js'
import { appendDataPath, getRelativeDataPath } from './data.js'
import type { Api, Schema } from './types.ts'

export interface RouteComponents {
  readonly view: Component
  readonly form: Component
  readonly embeddedForm: Component
}

declare module 'vue-router' {
  interface RouteMeta {
    node?: MenuNode | ViewNode | FormNode
  }
}

type Params = Record<string, string>

export interface Route {
  name: symbol
  params: Params
}

export interface FormRoute extends Route {
  // The data path that remains within the form:
  dataPath: string
}

export interface RouteState {
  data: any
  routeParams: Record<string, any>
  isTransient: boolean
}

export interface ItemLocation {
  dataPath: string
  // `key` is `null` for new items of lists:
  data: any
  key: string | number | null
}

abstract class RouteNode {
  constructor(readonly parent: RouteNode | null) {}

  abstract get children(): RouteNode[]

  getParams(routeParams: Record<string, any>): Params {
    const params: Params = {}
    const addParam = (name: string) => {
      if (routeParams[name] != null) {
        params[name] = routeParams[name]
      }
    }
    for (let node: RouteNode | null = this; node; node = node.parent) {
      if (node instanceof FormNode) {
        addParam(node.param)
      } else if (node instanceof ViewNode) {
        node.params.forEach(addParam)
      }
    }
    return params
  }
}

export class MenuNode extends RouteNode {
  readonly items: (MenuNode | ViewNode)[] = []
  readonly routeName: symbol

  constructor(
    readonly schema: Schema,
    parent: MenuNode | null,
    readonly name: string
  ) {
    super(parent)
    parent?.items.push(this)
    this.routeName = Symbol(name)
  }

  get children() {
    return this.items
  }

  get hasMenuItem(): boolean {
    return this.items.some(item => item.hasMenuItem)
  }

  // Menus link to their first item in the menu:
  get linkRouteName(): symbol {
    return (
      this.items.find(item => item.hasMenuItem)?.linkRouteName ??
      this.routeName
    )
  }
}

// Containers and sources alternate in every route:
abstract class ContainerNode extends RouteNode {
  readonly sources: SourceNode[] = []

  get children(): RouteNode[] {
    return this.sources
  }

  findSource(dataPath: string): SourceNode | null {
    for (const { source, key, path } of walkSources(this, dataPath)) {
      if (key === undefined && !path) return source
    }
    return null
  }

  getFormRoute(dataPath: string, state: RouteState): FormRoute | null {
    return this.#walk(dataPath, state).route
  }

  getCreateRoute(dataPath: string, state: RouteState): Route | null {
    const { source, params } = this.#walk(dataPath, state)
    const form = source?.form
    return form && !form.isInlined
      ? { name: form.routeName, params: { ...params, [form.param]: 'create' } }
      : null
  }

  findItem(form: FormNode, state: RouteState): ItemLocation | null {
    return this.#findItem(form, state, null)?.location ?? null
  }

  // Find `item` by its identity, e.g. after it or the item of a parent moved:
  findItemParams(
    form: FormNode,
    state: RouteState,
    item: object
  ): Params | null {
    return this.#findItem(form, state, item)?.params ?? null
  }

  #findItem(
    form: FormNode,
    { data, routeParams, isTransient }: RouteState,
    item: object | null
  ) {
    const nodes: RouteNode[] = []
    for (let node: RouteNode | null = form; node !== this; node = node.parent) {
      // The form isn't below this container after the views were resolved:
      if (!node) return null
      nodes.unshift(node)
    }
    const params: Params = {}
    const find = (
      index: number,
      value: any,
      { dataPath, data, key }: ItemLocation,
      isTransient: boolean
    ): ItemLocation | null => {
      for (; index < nodes.length; index++) {
        const node = nodes[index]
        if (node instanceof SourceNode) {
          const segments = parseDataPath(node.dataPath)
          key = segments.pop()!
          data = getValueAtDataPath(value, segments, () => null)
          value = data?.[key]
          dataPath = appendDataPath(dataPath, node.dataPath)
        } else if (node instanceof FormNode) {
          const { source } = node
          const usesIndexKeys = source.usesIndexKeys(isTransient)
          if (!node.isInlined) {
            isTransient = usesIndexKeys
          }
          if (source.isList) {
            data = value
            if (item && usesIndexKeys) {
              // Indices change when items move, so search all of them:
              for (const key of Object.keys(data ?? [])) {
                params[node.param] = key
                const location = find(
                  index + 1,
                  data[key],
                  { dataPath: appendDataPath(dataPath, key), data, key },
                  isTransient
                )
                if (location) return location
              }
              return null
            } else {
              const param = routeParams[node.param]
              key =
                param === 'create'
                  ? null
                  : findItemIndexById(source.schema, data, param, {
                      isTransient: usesIndexKeys
                    })
              params[node.param] = param
              value = key !== null ? data?.[key] : null
              dataPath = appendDataPath(dataPath, key ?? param)
            }
          }
        }
      }
      return !item || toRaw(value) === toRaw(item)
        ? { dataPath, data, key }
        : null
    }
    const location = find(
      0,
      data,
      { dataPath: '', data: null, key: null },
      isTransient
    )
    return location && { location, params }
  }

  // Walk to the deepest form with a route and to the source that the path ends
  // at, collecting the ids or indices of the items on the way:
  #walk(dataPath: string, { data, routeParams, isTransient }: RouteState) {
    let route: FormRoute | null = null
    let source: SourceNode | null = null
    let params = this.getParams(routeParams)
    for (const { source: child, key, path } of walkSources(this, dataPath)) {
      data = getValueAtDataPath(data, child.dataPath, () => null)
      source = key === undefined && !path ? child : null
      const { form } = child
      if (form) {
        const usesIndexKeys = child.usesIndexKeys(isTransient)
        if (child.isList) {
          // Paths that end at a list lead to no item:
          if (key === undefined) break
          data = data?.[key]
          params = {
            ...params,
            [form.param]: usesIndexKeys
              ? key
              : (data && getItemId(child.schema, data)) ?? key
          }
        }
        if (!form.isInlined) {
          isTransient = usesIndexKeys
          route = { name: form.routeName, params, dataPath: path }
        }
      }
    }
    return { route, source, params }
  }
}

export class ViewNode extends ContainerNode {
  readonly routeName: symbol
  // The parameters in the path of the view, e.g. `id` in `products/:id`:
  readonly params: string[] = []
  // Views with required parameters can't be linked to from the menu:
  readonly hasMenuItem: boolean = true

  constructor(
    readonly schema: Schema,
    parent: MenuNode | null,
    readonly name: string
  ) {
    super(parent)
    parent?.items.push(this)
    this.routeName = Symbol(name)
    // Parameters are optional with the `?` and `*` modifiers of vue-router:
    const matches = (schema.path ?? '').matchAll(
      /:(\w+)(?:\([^)]*\))?([?*+]?)/g
    )
    for (const [, name, modifier] of matches) {
      this.params.push(name)
      if (!['?', '*'].includes(modifier)) {
        this.hasMenuItem = false
      }
    }
  }

  get linkRouteName(): symbol {
    return this.routeName
  }
}

export class FormNode extends ContainerNode {
  readonly routeName: symbol
  // The item of list forms, or `create` in object forms, numbered by depth:
  readonly param: string

  constructor(
    readonly source: SourceNode,
    readonly schemas: Schema[],
    readonly isEmbeddedForm: boolean,
    // Forms of inlined sources render without a route:
    readonly isInlined: boolean
  ) {
    super(source)
    source.form = this
    let count = 1
    for (let node = source.parent; node; node = node.parent) {
      if (node instanceof FormNode) count++
    }
    this.param = `id${count}`
    this.routeName = Symbol(`${source.dataPath}/:${this.param}`)
  }
}

export class SourceNode extends RouteNode {
  form: FormNode | null = null
  // The sources of object sources without forms, like tree objects:
  readonly sources: SourceNode[] = []

  constructor(
    readonly schema: Schema,
    parent: ContainerNode | SourceNode,
    // Relative to the container, e.g. `contents/notes` in a nested section:
    readonly dataPath: string,
    // Routed next to the form of their parent item, like tree children:
    readonly isFlattened: boolean,
    // Recursive forms stop after `maxDepth` repetitions, without routes:
    readonly isBeyondMaxDepth: boolean
  ) {
    super(parent)
    parent.sources.push(this)
  }

  get children(): RouteNode[] {
    return this.form ? [this.form] : this.sources
  }

  get isList(): boolean {
    return isListSource(this.schema)
  }

  // The single component of a view, routed under the path of its view:
  get isViewComponent(): boolean {
    const { parent, schema } = this
    return (
      parent instanceof ViewNode &&
      isSingleComponentView(parent.schema) &&
      schema === parent.schema.field
    )
  }

  // Lists address their items by index in transient data, and in sources
  // without a resource, whose forms edit transient data too:
  usesIndexKeys(isTransient: boolean): boolean {
    return isTransient || !this.schema.resource
  }
}

export class RouteTree {
  // The nodes of the menu:
  readonly nodes: (MenuNode | ViewNode)[]
  // The nodes of the views that have routes but no menu items:
  readonly #hiddenNodes: (MenuNode | ViewNode)[]
  readonly #api: Pick<Api, 'normalizePath'>
  readonly #viewsByName = new Map<string, ViewNode>()
  readonly #sourcesWithRoutes: Set<Schema>

  constructor(
    views: Record<string, Schema>,
    api: Pick<Api, 'normalizePath'>,
    hiddenViews: Record<string, Schema> = {}
  ) {
    this.#api = api
    this.#sourcesWithRoutes = findSourcesWithRoutes([
      ...Object.values(views),
      ...Object.values(hiddenViews)
    ])
    const createViewNodes = (views: Record<string, Schema>) =>
      Object.entries(views).map(([name, schema]) =>
        this.#createViewNode(schema, name, null)
      )
    this.nodes = createViewNodes(views)
    this.#hiddenNodes = createViewNodes(hiddenViews)
  }

  // Dialogs and forms of `useDitoForm()` don't support forms with routes:
  hasRoutedForms(): boolean {
    return this.nodes.some(node => !!findRoutedForm(node))
  }

  // Lists and options linked to views edit their items in the view's form:
  getViewItemRoute(name: string, key: string): Route | null {
    const view = this.#viewsByName.get(name)
    const form = view && findRoutedForm(view)
    return form ? { name: form.routeName, params: { [form.param]: key } } : null
  }

  getViewRoute(name: string): Route | null {
    const view = this.#viewsByName.get(name)
    return view ? { name: view.routeName, params: {} } : null
  }

  createRouteRecords(components: RouteComponents): RouteRecordRaw[] {
    return [...this.nodes, ...this.#hiddenNodes].map(node =>
      this.#createViewRecord(node, components)
    )
  }

  #createViewNode(
    schema: Schema,
    name: string,
    parent: MenuNode | null
  ): MenuNode | ViewNode {
    if (isMenu(schema)) {
      const menu = new MenuNode(schema, parent, name)
      for (const [itemName, item] of Object.entries(schema.items as Schema)) {
        this.#createViewNode(item, itemName, menu)
      }
      return menu
    } else {
      const view = new ViewNode(schema, parent, name)
      this.#viewsByName.set(name, view)
      this.#addSources(view, schema)
      return view
    }
  }

  #addSources(container: ContainerNode, schema: Schema) {
    forEachSource(schema, (source, dataPath) =>
      this.#addSource(container, source, dataPath)
    )
  }

  #addSource(
    parent: ContainerNode | SourceNode,
    schema: Schema,
    dataPath: string,
    isFlattened = false
  ) {
    // Inlined sources render their forms without routes, and only need nodes
    // if forms with routes can be reached through them:
    if (isInlined(schema) && !this.#sourcesWithRoutes.has(schema)) return
    const source = new SourceNode(
      schema,
      parent,
      dataPath,
      isFlattened,
      isBeyondMaxDepth(parent, schema)
    )
    if (!source.isBeyondMaxDepth) {
      if (hasFormSchema(schema)) {
        const form = new FormNode(
          source,
          Object.values(getFormSchemas(schema)),
          !!getTypeDescriptor(schema)?.hasEmbeddedForms,
          isInlined(schema)
        )
        for (const formSchema of form.schemas) {
          this.#addSources(form, formSchema)
        }
        this.#addChildSources(form, schema)
      } else if (isObjectSource(schema)) {
        // Object sources without forms, like tree objects, route the forms of
        // their children. Lists can't, as their items need a form parameter:
        this.#addChildSources(source, schema)
      }
    }
  }

  #addChildSources(parent: ContainerNode | SourceNode, schema: Schema) {
    for (const childSchema of getChildSourceSchemas(schema)) {
      this.#addSource(parent, childSchema, childSchema.name, true)
    }
  }

  #createViewRecord(
    node: MenuNode | ViewNode,
    components: RouteComponents,
    basePath = ''
  ): RouteRecordRaw {
    const { schema, name } = node
    const path = `${basePath}/${getSchemaPath(schema, name, this.#api)}`
    return {
      path,
      name: node.routeName,
      component: components.view,
      meta: { node },
      children:
        node instanceof MenuNode
          ? node.items.map(item =>
              this.#createViewRecord(item, components, path)
            )
          : this.#createSourceRecords(node.sources, '', components)
    }
  }

  #createSourceRecords(
    sources: SourceNode[],
    basePath: string,
    components: RouteComponents
  ): RouteRecordRaw[] {
    return sources.flatMap(source => {
      const sourcePath = joinPaths(basePath, this.#getSourcePath(source))
      const { form } = source
      return form && !form.isInlined
        ? this.#createFormRecords(form, sourcePath, components)
        : this.#createSourceRecords(
            form?.sources ?? source.sources,
            getItemPathPattern(source, sourcePath),
            components
          )
    })
  }

  #createFormRecords(
    form: FormNode,
    sourcePath: string,
    components: RouteComponents
  ): RouteRecordRaw[] {
    const { source } = form
    return [
      {
        // Object forms take `create` as their optional parameter:
        path: joinPaths(
          sourcePath,
          `:${form.param}${source.isList ? '' : '?'}`
        ),
        name: form.routeName,
        component: form.isEmbeddedForm
          ? components.embeddedForm
          : components.form,
        meta: { node: form },
        children: this.#createSourceRecords(
          form.sources.filter(child => !child.isFlattened),
          '',
          components
        )
      },
      ...this.#createSourceRecords(
        form.sources.filter(child => child.isFlattened),
        getItemPathPattern(source, sourcePath),
        components
      ),
      // Lead the paths of lists without an item back to their container:
      ...(
        source.isList && sourcePath
          ? [{ path: sourcePath, redirect: '.' }]
          : []
      )
    ]
  }

  // Single-component views use the path of their view, all other sources
  // replace the last segment of their data path with their own `path`:
  #getSourcePath(source: SourceNode): string {
    const { schema, dataPath } = source
    if (source.isViewComponent) {
      return ''
    } else {
      const segments = parseDataPath(dataPath)
      const name = segments.pop()
      return [
        ...segments.map((segment: string) => this.#api.normalizePath(segment)),
        getSchemaPath(schema, name, this.#api)
      ].join('/')
    }
  }
}

// Also find the sources in tabs, panels and sections:
function forEachSource(
  schema: Schema,
  callback: (source: Schema, dataPath: string) => void,
  dataPath = ''
) {
  const forEachPanelSource = (schema: Schema) => {
    for (const panel of getPanelSchemas(schema)) {
      forEachSource(panel, callback, dataPath)
    }
  }
  iterateNestedSchemaComponents(schema, (component: Schema, name: string) => {
    const componentDataPath = appendDataPath(dataPath, name)
    if (getSourceType(component)) {
      callback(component, componentDataPath)
    } else if (component.fields) {
      // Only nested sections hold the data of their components:
      forEachSource(
        component,
        callback,
        hasNestedData(component) ? componentDataPath : dataPath
      )
    }
    forEachPanelSource(component)
  })
  forEachPanelSource(schema)
}

// Collect the graph of all sources once, then follow it back from the sources
// with routed forms, in linear time, unlike expanding all inlined sources:
function findSourcesWithRoutes(views: Schema[]): Set<Schema> {
  const parentsBySource = new Map<Schema, Set<Schema>>()
  const routedSources: Schema[] = []
  const addSource = (source: Schema, parent: Schema | null) => {
    let parents = parentsBySource.get(source)
    const isNew = !parents
    if (!parents) {
      parents = new Set()
      parentsBySource.set(source, parents)
    }
    if (parent) parents.add(parent)
    if (isNew) {
      const hasForm = hasFormSchema(source)
      if (hasForm && !isInlined(source)) {
        routedSources.push(source)
      }
      const addChild = (child: Schema) => addSource(child, source)
      if (hasForm) {
        for (const form of Object.values(getFormSchemas(source))) {
          forEachSource(form as Schema, addChild)
        }
      }
      getChildSourceSchemas(source).forEach(addChild)
    }
  }
  const addView = (schema: Schema) => {
    if (isMenu(schema)) {
      Object.values(schema.items as Schema).forEach(addView)
    } else {
      forEachSource(schema, source => addSource(source, null))
    }
  }
  views.forEach(addView)
  const sourcesWithRoutes = new Set<Schema>()
  const markSource = (source: Schema) => {
    if (!sourcesWithRoutes.has(source)) {
      sourcesWithRoutes.add(source)
      parentsBySource.get(source)?.forEach(markSource)
    }
  }
  routedSources.forEach(markSource)
  return sourcesWithRoutes
}

function getItemPathPattern(source: SourceNode, sourcePath: string): string {
  return source.form && source.isList
    ? joinPaths(sourcePath, `:${source.form.param}`)
    : sourcePath
}

function isBeyondMaxDepth(
  parent: ContainerNode | SourceNode,
  schema: Schema
): boolean {
  // Lists with routed forms that contain themselves occur again themselves.
  // Inlined content occurs again through other lists that share its forms,
  // the first of which isn't a repetition yet:
  const isInlinedSource = isInlined(schema)
  const isRepetition = (node: SourceNode) =>
    isInlinedSource
      ? getForms(node.schema).some(form => getForms(schema).includes(form))
      : node.schema === schema
  let depth = isInlinedSource ? 0 : 1
  for (let node: RouteNode | null = parent; node; node = node.parent) {
    if (node instanceof SourceNode && isRepetition(node)) depth++
  }
  return depth > (schema.maxDepth ?? 1)
}

// Setup keeps the forms, unlike the `forms` objects. Inlined sources use their
// components as their form:
function getForms(schema: Schema): Schema[] {
  return schema.forms
    ? Object.values(schema.forms)
    : [schema.form ?? schema.fields].filter(Boolean)
}

// Step through the sources that `dataPath` leads to, with the key of the item
// in lists with forms, and the path that remains below them. Object sources
// without forms continue with their own sources:
function* walkSources(
  node: ContainerNode | SourceNode,
  dataPath: string
): Generator<{ source: SourceNode; key?: string; path: string }> {
  for (const source of node.sources) {
    let path = getRelativeDataPath(dataPath, source.dataPath)
    if (path !== null) {
      let key: string | undefined
      if (source.form && source.isList) {
        const [first, ...rest] = parseDataPath(path)
        key = first
        path = rest.join('/')
      }
      yield { source, key, path }
      yield* walkSources(source.form ?? source, path)
      break
    }
  }
}

function findRoutedForm(node: RouteNode): FormNode | null {
  for (const child of node.children) {
    const form =
      child instanceof FormNode && !child.isInlined
        ? child
        : findRoutedForm(child)
    if (form) return form
  }
  return null
}

function joinPaths(...paths: string[]): string {
  return paths.filter(Boolean).join('/')
}
