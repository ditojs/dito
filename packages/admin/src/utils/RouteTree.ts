import type { Component } from 'vue'
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

type Schema = Record<string, any>
type Params = Record<string, string>

interface Api {
  normalizePath(path: string): string
}

// The route of the deepest form that edits the data at a data path:
export interface FormRoute {
  form: FormNode
  params: Params
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
    return this.#walk(dataPath, {
      data: null,
      routeParams: {},
      isTransient: false
    }).source
  }

  getFormRoute(dataPath: string, state: RouteState): FormRoute | null {
    return this.#walk(dataPath, state).route
  }

  getCreateRoute(dataPath: string, state: RouteState): FormRoute | null {
    const { source, params } = this.#walk(dataPath, state)
    const form = source?.form
    return form && !form.isInlined
      ? { form, params: { ...params, [form.param]: 'create' }, dataPath: '' }
      : null
  }

  // Find the item of `form` below this container, through the parameters of
  // its route:
  findItem(
    form: FormNode,
    { data, routeParams, isTransient }: RouteState
  ): ItemLocation | null {
    const nodes: RouteNode[] = []
    for (let node: RouteNode | null = form; node !== this; node = node.parent) {
      // The form isn't below this container, e.g. after the views were
      // resolved again:
      if (!node) return null
      nodes.unshift(node)
    }
    let dataPath = ''
    let parentData = null
    let key: string | number | null = null
    for (const node of nodes) {
      if (node instanceof SourceNode) {
        const segments = parseDataPath(node.dataPath)
        key = segments.pop()!
        parentData = getValueAtDataPath(data, segments, () => null)
        data = parentData?.[key]
        dataPath = appendDataPath(dataPath, node.dataPath)
      } else if (node instanceof FormNode) {
        if (node.source.isList) {
          const { schema, hasResource } = node.source
          const param = routeParams[node.param]
          key =
            param === 'create'
              ? null
              : findItemIndexById(schema, data, param, {
                  isTransient: isTransient || !hasResource
                })
          parentData = data
          data = key !== null ? data?.[key] : null
          dataPath = appendDataPath(dataPath, key ?? param)
        }
        if (!node.isInlined) {
          isTransient ||= isTransientForm(node)
        }
      }
    }
    return { dataPath, data: parentData, key }
  }

  // Walk the data path through the sources below this container, to the
  // deepest form with a route and to the source that the path ends at,
  // collecting the parameters of the forms on the way: the ids of the items of
  // sources with a resource, and the indices of transient ones.
  #walk(dataPath: string, { data, routeParams, isTransient }: RouteState) {
    let route: FormRoute | null = null
    let source: SourceNode | null = null
    let params = this.getParams(routeParams)
    let path = dataPath
    let node: ContainerNode | SourceNode = this
    for (
      let child = findChildSource(node, path);
      child;
      child = findChildSource(node, path)
    ) {
      data = getValueAtDataPath(data, child.dataPath, () => null)
      path = getRelativeDataPath(path, child.dataPath)!
      // The source that the path ends at, if any:
      source = path ? null : child
      const { form } = child
      if (form) {
        if (child.isList) {
          const [key, ...rest] = parseDataPath(path)
          // Paths that end at a list lead to no item:
          if (key === undefined) break
          data = data?.[key]
          params = {
            ...params,
            [form.param]:
              isTransient || !child.hasResource
                ? key
                : (data && getItemId(child.schema, data)) ?? key
          }
          path = rest.join('/')
        }
        node = form
        if (!form.isInlined) {
          isTransient ||= isTransientForm(form)
          route = { form, params, dataPath: path }
        }
      } else {
        // Object sources without forms continue with their sources:
        node = child
      }
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
}

// RouteTree describes the routes of the views, built from their set-up
// schemas, see `setupView()`. Router records are generated from it, carrying
// their node in `meta.node`, and links resolve through the names of its routes.
export class RouteTree {
  readonly nodes: (MenuNode | ViewNode)[]
  readonly #api: Api
  readonly #viewsByName = new Map<string, ViewNode>()
  readonly #sourcesWithRoutes: Set<Schema>

  constructor(views: Record<string, Schema>, api: Api) {
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
  getViewForm(name: string): FormNode | null {
    const view = this.#viewsByName.get(name)
    return view ? findRoutedForm(view) : null
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
      meta: { api: this.#api, schema, node },
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
    const api = this.#api
    const meta = { api, schema: source.schema }
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
        meta: { ...meta, node: form },
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
          ? [{ path: sourcePath, redirect: '.', meta }]
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

// Forms with routes whose sources have no resource edit their items in the data
// of their parent, so the sources below them are transient too:
function isTransientForm(form: FormNode): boolean {
  return !form.source.hasResource
}

function findChildSource(
  node: ContainerNode | SourceNode,
  dataPath: string
): SourceNode | undefined {
  return node.sources.find(
    source => getRelativeDataPath(dataPath, source.dataPath) !== null
  )
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
