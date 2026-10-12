import { toRaw, type Component } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import { getValueAtDataPath, parseDataPath } from '@ditojs/utils'
import DitoComponent from '../DitoComponent.js'
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
import { getSourceType, getTypeOptions } from './schema/types.js'
import { getItemId } from './schema/data.js'
import { findItemIndexById } from './schema/item.js'
import { appendDataPath, getRelativeDataPath } from './data.js'
import type { Api, Schema } from './types.ts'

// The records that the route tree creates carry their node:
declare module 'vue-router' {
  interface RouteMeta {
    node?: MenuNode | ViewNode | FormNode
  }
}

type Params = Record<string, string>

// The route of a form, which the router resolves by its name:
export interface Route {
  name: symbol
  params: Params
}

// The route of the deepest form that edits the data at a data path:
export interface FormRoute extends Route {
  // The data path that remains within the form:
  dataPath: string
}

// The state of a route component that its routes depend on: its data, the
// parameters of its route, and whether its sources are transient, e.g. in
// forms that create their item:
export interface RouteState {
  data: any
  routeParams: Record<string, any>
  isTransient: boolean
}

// The item that a form edits, in the data of its parent route component:
export interface ItemLocation {
  dataPath: string
  // The data that holds the item at `key`, which is `null` for new items of
  // lists:
  data: any
  key: string | number | null
}

abstract class RouteNode {
  constructor(readonly parent: RouteNode | null) {}

  abstract get children(): RouteNode[]

  // Pick the parameters of the forms on the route to this node:
  getParams(routeParams: Record<string, any>): Params {
    const params: Params = {}
    for (let node: RouteNode | null = this; node; node = node.parent) {
      if (node instanceof FormNode && routeParams[node.param] != null) {
        params[node.param] = routeParams[node.param]
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

  // Menus link to their first item:
  get linkRouteName(): symbol {
    return this.items[0].linkRouteName
  }
}

// Views and forms are containers, which hold one object of data, and the
// sources in it. Containers and sources alternate in every route.
abstract class ContainerNode extends RouteNode {
  readonly sources: SourceNode[] = []

  get children(): RouteNode[] {
    return this.sources
  }

  findSource(dataPath: string): SourceNode | null {
    let node: ContainerNode | SourceNode = this
    for (
      let step = stepIntoSource(node, dataPath);
      step;
      step = stepIntoSource(node, step.path)
    ) {
      const { source, key, path } = step
      if (key === undefined && !path) return source
      node = source.form ?? source
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

  // Find the item of `form` below this container, through the parameters of
  // its route:
  findItem(form: FormNode, state: RouteState): ItemLocation | null {
    return this.#findItem(form, state, null)?.location ?? null
  }

  // Find the parameters of the route of `form` that lead to `item`, by its
  // identity, e.g. after it or the item of a parent form moved:
  findItemParams(
    form: FormNode,
    state: RouteState,
    item: object
  ): Params | null {
    return this.#findItem(form, state, item)?.params ?? null
  }

  // Descend to the item of `form` through the parameters of its route, or
  // search the items of lists with index keys for `item`, if it's given.
  #findItem(
    form: FormNode,
    { data, routeParams, isTransient }: RouteState,
    item: object | null
  ) {
    const nodes: RouteNode[] = []
    for (let node: RouteNode | null = form; node !== this; node = node.parent) {
      // The form isn't below this container, e.g. after the views were
      // resolved again:
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

  // Walk the data path through the sources below this container, to the
  // deepest form with a route and to the source that the path ends at,
  // collecting the parameters of the forms on the way: the ids of the items of
  // sources with a resource, and the indices of transient ones.
  #walk(dataPath: string, { data, routeParams, isTransient }: RouteState) {
    let route: FormRoute | null = null
    let source: SourceNode | null = null
    let params = this.getParams(routeParams)
    let node: ContainerNode | SourceNode = this
    for (
      let step = stepIntoSource(node, dataPath);
      step;
      step = stepIntoSource(node, step.path)
    ) {
      const { source: child, key, path } = step
      data = getValueAtDataPath(data, child.dataPath, () => null)
      // The source that the path ends at, if any:
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
      // Object sources without forms continue with their sources:
      node = form ?? child
    }
    return { route, source, params }
  }
}

export class ViewNode extends ContainerNode {
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

  get linkRouteName(): symbol {
    return this.routeName
  }
}

export class FormNode extends ContainerNode {
  readonly routeName: symbol
  // The route parameter that holds the item of list forms, and `create` in
  // object forms, numbered along the route so they don't clash:
  readonly param: string

  constructor(
    readonly source: SourceNode,
    readonly schemas: Schema[],
    // Forms that render inside the form or view of their parent route:
    readonly isNestedForm: boolean,
    // Forms of inlined sources, which render without a route:
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
  // The sources of object sources without forms, like the children of tree
  // objects:
  readonly sources: SourceNode[] = []

  constructor(
    readonly schema: Schema,
    parent: ContainerNode | SourceNode,
    // The data path relative to the container, e.g. `contents/notes` for a
    // list in a nested section:
    readonly dataPath: string,
    // Sources routed next to the form of their parent item instead of inside
    // it, like the children of tree items:
    readonly isFlattened: boolean,
    // Sources where the recursion of forms that contain themselves stops after
    // `maxDepth` repetitions, without forms or routes of their own:
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

  get hasResource(): boolean {
    return !!this.schema.resource
  }

  // Lists address their items by index in transient data, and in sources
  // without a resource, which edit their items in the data of their parent,
  // so the sources below their routed forms are transient too:
  usesIndexKeys(isTransient: boolean): boolean {
    return isTransient || !this.hasResource
  }
}

// RouteTree describes the routes of the views, built from their set-up
// schemas, see `setupView()`. Router records are generated from it, carrying
// their node in `meta.node`, and links resolve through the names of its routes.
export class RouteTree {
  readonly nodes: (MenuNode | ViewNode)[]
  readonly #api: Pick<Api, 'normalizePath'>
  readonly #viewsByName = new Map<string, ViewNode>()
  readonly #sourcesWithRoutes: Set<Schema>

  constructor(
    views: Record<string, Schema>,
    api: Pick<Api, 'normalizePath'>
  ) {
    this.#api = api
    this.#sourcesWithRoutes = findSourcesWithRoutes(views)
    this.nodes = Object.entries(views).map(([name, schema]) =>
      this.#createViewNode(schema, name, null)
    )
  }

  // Dialogs don't support forms with routes.
  hasRoutedForms(): boolean {
    return this.nodes.some(node => !!findRoutedForm(node))
  }

  // Lists and options linked to views edit their items in the form of the
  // view.
  getViewItemRoute(name: string, key: string): Route | null {
    const view = this.#viewsByName.get(name)
    const form = view && findRoutedForm(view)
    return form ? { name: form.routeName, params: { [form.param]: key } } : null
  }

  createRouteRecords(viewComponent: Component): RouteRecordRaw[] {
    return this.nodes.map(node => this.#createViewRecord(node, viewComponent))
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
          !!getTypeOptions(schema)?.hasNestedForms,
          isInlined(schema)
        )
        for (const formSchema of form.schemas) {
          this.#addSources(form, formSchema)
        }
        this.#addChildSources(form, schema)
      } else if (isObjectSource(schema)) {
        // Object sources without forms, like tree objects, route the forms of
        // their children under their own path. List sources can't, as their
        // items need the parameter of the form route.
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
    viewComponent: Component,
    basePath = ''
  ): RouteRecordRaw {
    const { schema, name } = node
    const path = `${basePath}/${getSchemaPath(schema, name, this.#api)}`
    return {
      path,
      name: node.routeName,
      component: viewComponent,
      meta: { node },
      children:
        node instanceof MenuNode
          ? node.items.map(item =>
              this.#createViewRecord(item, viewComponent, path)
            )
          : this.#createSourceRecords(node.sources, '')
    }
  }

  // The paths of the records are relative to the record of their container,
  // prefixed with `basePath`.
  #createSourceRecords(
    sources: SourceNode[],
    basePath: string
  ): RouteRecordRaw[] {
    return sources.flatMap(source => {
      const sourcePath = joinPaths(basePath, this.#getSourcePath(source))
      const { form } = source
      return form && !form.isInlined
        ? this.#createFormRecords(form, sourcePath)
        : this.#createSourceRecords(
            form?.sources ?? source.sources,
            getItemPathPattern(source, sourcePath)
          )
    })
  }

  #createFormRecords(form: FormNode, sourcePath: string): RouteRecordRaw[] {
    const { source } = form
    return [
      {
        // Object forms take `create` as their optional parameter:
        path: joinPaths(
          sourcePath,
          `:${form.param}${source.isList ? '' : '?'}`
        ),
        name: form.routeName,
        component: DitoComponent.component(
          form.isNestedForm ? 'DitoFormNested' : 'DitoForm'
        ),
        meta: { node: form },
        children: this.#createSourceRecords(
          form.sources.filter(child => !child.isFlattened),
          ''
        )
      },
      ...this.#createSourceRecords(
        form.sources.filter(child => child.isFlattened),
        getItemPathPattern(source, sourcePath)
      ),
      // Lead the paths of lists without an item back to their container:
      ...(
        source.isList && sourcePath
          ? [{ path: sourcePath, redirect: '.' }]
          : []
      )
    ]
  }

  // The component of single-component views uses the path of its view, all
  // other sources replace the last segment of their data path with their own
  // `path`.
  #getSourcePath(source: SourceNode): string {
    const { parent, schema, dataPath } = source
    if (
      parent instanceof ViewNode &&
      isSingleComponentView(parent.schema) &&
      schema === parent.schema.component
    ) {
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

// Call `callback` with the sources in the components of a view or form, also in
// its tabs, panels and sections, with their data paths relative to it.
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
    } else if (component.components) {
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

// The sources that types route next to the forms of their items, like the
// children of tree items:
function getChildSourceSchemas(schema: Schema): Schema[] {
  return getTypeOptions(schema)?.getChildSourceSchemas?.(schema) ?? []
}

// Find the sources through which forms with routes can be reached: Collect the
// graph of all sources once, then follow it back from the sources with routed
// forms. This takes linear time, while expanding all inlined sources along
// every route grows with their combinations, e.g. with nested content.
function findSourcesWithRoutes(views: Record<string, Schema>): Set<Schema> {
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
  Object.values(views).forEach(addView)
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

// The items of lists are addressed by the parameter of their form, objects
// are their own item.
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

// The forms of sources, which setup keeps, unlike the `forms` objects that hold
// them. Inlined sources use the object of their components as their form:
function getForms(schema: Schema): Schema[] {
  return schema.forms
    ? Object.values(schema.forms)
    : [schema.form ?? schema.components].filter(Boolean)
}

// Step from `node` into the source that `dataPath` leads to, with the key of
// the item in lists with forms, and the path that remains below them:
function stepIntoSource(node: ContainerNode | SourceNode, dataPath: string) {
  for (const source of node.sources) {
    const path = getRelativeDataPath(dataPath, source.dataPath)
    if (path !== null) {
      if (source.form && source.isList) {
        const [key, ...rest] = parseDataPath(path)
        return { source, key, path: rest.join('/') }
      } else {
        return { source, key: undefined, path }
      }
    }
  }
  return null
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
