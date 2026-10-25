import { toRaw, type Component } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import { parseDataPath } from '@ditojs/utils'
import {
  getFormSchemas,
  getNamedSchemas,
  hasFormSchema
} from './schema/lookup.js'
import {
  getSchemaPath,
  isInlined,
  isListSource,
  isMenu,
  iterateSchemaComponents
} from './schema/structure.js'
import { getItemId } from './schema/data.js'
import { findItemIndexById } from './schema/item.js'
import {
  getSourceType,
  getTypeDescriptor,
  getChildSourceSchemas
} from './schema/types.ts'
import { appendDataPath, getRelativeDataPath } from './data.js'
import type { ItemLocation, RouteClaim } from './RouteContext.ts'
import type { SourceContext } from './SourceContext.ts'
import type { Api, Schema } from './types.ts'

export interface RouteComponents {
  readonly view: Component
}

// A source of the forms of its items: where its value is, and the path of its
// forms in the URL:
export interface SourceRoute {
  readonly schema: Schema
  readonly location: ItemLocation
  readonly path: string
  readonly isTransient: boolean
  // The component of the source, while it's mounted:
  readonly source: SourceContext | null
}

declare module 'vue-router' {
  interface RouteMeta {
    node?: MenuNode | ViewNode
  }
}

type Params = Record<string, string>

export interface Route {
  name: symbol
  params: Params
}

abstract class RouteNode {
  // The parameters in the path of the route, e.g. `id` in `products/:id`:
  readonly params: string[] = []

  constructor(readonly parent: MenuNode | null) {}

  getParams(routeParams: Record<string, any>): Params {
    const params: Params = {}
    for (const name of this.params) {
      if (routeParams[name] != null) {
        params[name] = routeParams[name]
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
    readonly name: string,
    readonly path: string
  ) {
    super(parent)
    parent?.items.push(this)
    this.routeName = Symbol(name)
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

export class ViewNode extends RouteNode {
  readonly routeName: symbol
  // Views with required parameters can't be linked to from the menu:
  readonly hasMenuItem: boolean = true

  constructor(
    readonly schema: Schema,
    parent: MenuNode | null,
    readonly name: string,
    readonly path: string,
    // The path of the forms of the items of the view's first source with
    // forms, e.g. `books` in multi-component views, or `''`:
    readonly itemPath: string | null
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

export class RouteTree {
  // The nodes of the menu:
  readonly nodes: (MenuNode | ViewNode)[]
  // The nodes of the views that have routes but no menu items:
  readonly #hiddenNodes: (MenuNode | ViewNode)[]
  readonly #api: Pick<Api, 'normalizePath'>
  readonly #viewsByName = new Map<string, ViewNode>()

  constructor(
    views: Record<string, Schema>,
    api: Pick<Api, 'normalizePath'>,
    hiddenViews: Record<string, Schema> = {}
  ) {
    this.#api = api
    const createViewNodes = (views: Record<string, Schema>) =>
      Object.entries(views).map(([name, schema]) =>
        this.#createViewNode(schema, name, null)
      )
    this.nodes = createViewNodes(views)
    this.#hiddenNodes = createViewNodes(hiddenViews)
  }

  // Lists and options linked to views edit their items in the view's form:
  getViewItemPath(name: string, key: string): string | null {
    const view = this.#viewsByName.get(name)
    return view && view.itemPath !== null
      ? joinPaths(view.path, view.itemPath, key)
      : null
  }

  getViewRoute(name: string): Route | null {
    const view = this.#viewsByName.get(name)
    return view ? { name: view.routeName, params: {} } : null
  }

  createRouteRecords(components: RouteComponents): RouteRecordRaw[] {
    return [...this.nodes, ...this.#hiddenNodes].map(node =>
      createViewRecord(node, components)
    )
  }

  #createViewNode(
    schema: Schema,
    name: string,
    parent: MenuNode | null
  ): MenuNode | ViewNode {
    const path = `${parent?.path ?? ''}/${
      getSchemaPath(schema, name, this.#api)
    }`
    if (isMenu(schema)) {
      const menu = new MenuNode(schema, parent, name, path)
      for (const [itemName, item] of Object.entries(schema.items as Schema)) {
        this.#createViewNode(item, itemName, menu)
      }
      return menu
    } else {
      const view = new ViewNode(
        schema,
        parent,
        name,
        path,
        this.#getItemPath(schema)
      )
      this.#viewsByName.set(name, view)
      return view
    }
  }

  // Single-component views route the forms of their component under their own
  // path:
  #getItemPath(schema: Schema): string | null {
    let itemPath: string | null = null
    forEachSource(schema, (source, componentPath) => {
      if (itemPath === null && hasFormSchema(source) && !isInlined(source)) {
        itemPath =
          source === schema.field
            ? ''
            : getSourcePath(source, componentPath, this.#api)
      }
    })
    return itemPath
  }
}

// The components of views claim the paths below them, which route the forms of
// their sources. Menus render the routes of their views through a view without
// data:
function createViewRecord(
  node: MenuNode | ViewNode,
  components: RouteComponents
): RouteRecordRaw {
  return {
    path: node.path,
    name: node.routeName,
    component: components.view,
    meta: { node },
    children:
      node instanceof MenuNode
        ? node.items.map(item => createViewRecord(item, components))
        : // Records without components need a name to match:
          [
            {
              path: ':_(.*)*',
              name: Symbol(`${node.name}/*`),
              components: {}
            }
          ]
  }
}

// The URL path of a source within its route: the names of the tabs, sections
// and panels around it, then its own `path`, e.g. `pricing/families`:
export function getSourcePath(
  schema: Schema,
  componentPath: string,
  api: Pick<Api, 'normalizePath'>
): string {
  const segments = parseDataPath(componentPath)
  const name = segments.pop()
  return [
    ...segments.map((segment: string) => api.normalizePath(segment)),
    getSchemaPath(schema, name, api)
  ].join('/')
}

// Dialogs and the forms of `useDitoForm()` outside of pages aren't routes, so
// the forms of their sources can't be routed:
export function hasRoutedForms(
  schema: Schema,
  visited = new Set<Schema>()
): boolean {
  // Inlined sources render their forms, which may contain routed sources:
  const isRouted = (source: Schema): boolean => {
    if (visited.has(source)) return false
    visited.add(source)
    return (
      hasRoutedForm(source) || (
        isInlined(source) &&
        Object.values(getFormSchemas(source)).some(
          form => hasRoutedForms(form as Schema, visited)
        )
      )
    )
  }
  let hasRoutedSource = false
  forEachSource(schema, source => {
    hasRoutedSource ||= isRouted(source)
  })
  return hasRoutedSource
}

// Sources route the forms of their items, trees also of their children:
function hasRoutedForm(schema: Schema): boolean {
  return (
    !isInlined(schema) && (
      hasFormSchema(schema) || (
        routesChildren(schema) &&
        getChildSourceSchemas(schema).some(hasRoutedForm)
      )
    )
  )
}

// The forms of the children of trees continue the ones of their items, or the
// path of objects, which are their own item:
function routesChildren(schema: Schema): boolean {
  return hasFormSchema(schema) || !isListSource(schema)
}

// Also find the sources in tabs, panels and sections, whose names their
// component paths contain, as the rendered components do:
function forEachSource(
  schema: Schema,
  callback: (source: Schema, componentPath: string) => void,
  componentPath = ''
) {
  const forEachPanelSource = (schema: Schema, componentPath: string) => {
    for (const [name, panel] of Object.entries(schema.panels ?? {})) {
      forEachSource(
        panel as Schema,
        callback,
        appendDataPath(componentPath, name)
      )
    }
  }
  const forEachComponentSource = (schema: Schema, componentPath: string) => {
    iterateSchemaComponents([schema], (component: Schema, name: string) => {
      const path = appendDataPath(componentPath, name)
      if (getSourceType(component)) {
        callback(component, path)
      } else if (component.fields) {
        forEachSource(component, callback, path)
      }
      forEachPanelSource(component, path)
    })
  }
  forEachComponentSource(schema, componentPath)
  for (const tab of Object.values(getNamedSchemas(schema.tabs) ?? {})) {
    forEachComponentSource(
      tab as Schema,
      appendDataPath(componentPath, (tab as Schema).name)
    )
  }
  forEachPanelSource(schema, componentPath)
}

function joinPaths(...paths: string[]): string {
  return paths.filter(Boolean).join('/')
}

// Lists address their items by index in transient data, and in sources
// without a resource, whose forms edit transient data too:
function usesIndexKeys(schema: Schema, isTransient: boolean): boolean {
  return isTransient || !schema.resource
}

// The key of an item in the paths of forms, its id or else its index:
export function getItemKey(
  schema: Schema,
  item: any,
  index: string | number,
  isTransient: boolean
): string {
  return usesIndexKeys(schema, isTransient)
    ? String(index)
    : ((item && getItemId(schema, item)) ?? String(index))
}

function getChildPath(schema: Schema, api: Pick<Api, 'normalizePath'>) {
  return getSchemaPath(schema, schema.name, api)
}

// Open the form of the item that `path` leads to below the source, the
// deepest one that has a form, also among the children of trees, e.g.
// `families/0` or `pages/0/subpages/1`:
export function claimSourceRoute(
  sourceRoute: SourceRoute,
  path: string,
  api: Pick<Api, 'normalizePath'>
): RouteClaim | null {
  const rest = getRelativeDataPath(path, sourceRoute.path)
  if (rest === null) return null
  const segments = parseDataPath(rest)
  let { schema, location, path: sourcePath, isTransient } = sourceRoute
  let claimKey = location.componentPath
  let claim: RouteClaim | null = null
  while (true) {
    const value = location.data?.[location.key!]
    let param: string | null = null
    let itemLocation = location
    if (isListSource(schema)) {
      // Paths that end at a list lead to no item:
      param = segments.shift() ?? null
      if (!param) break
      isTransient = usesIndexKeys(schema, isTransient)
      const index =
        param === 'create'
          ? null
          : findItemIndexById(schema, value, param, { isTransient })
      itemLocation = {
        data: value,
        key: index,
        dataPath: appendDataPath(location.dataPath, index ?? param),
        componentPath: appendDataPath(location.componentPath, index ?? param)
      }
    } else if (segments[0] === 'create') {
      param = segments.shift()!
    }
    const formPath = param ? `${sourcePath}/${param}` : sourcePath
    if (hasFormSchema(schema)) {
      claim = {
        schema,
        path: formPath,
        sourcePath,
        param,
        location: itemLocation,
        get source() {
          return sourceRoute.source
        },
        isEmbedded: !!getTypeDescriptor(schema)?.hasEmbeddedForms,
        key: claimKey,
        claimItem: item => {
          const itemPath = findItemPath(sourceRoute, item, api)
          return itemPath ? claimSourceRoute(sourceRoute, itemPath, api) : null
        }
      }
    }
    // The children of new items have no forms yet:
    const [child] = getChildSourceSchemas(schema)
    if (
      child &&
      param !== 'create' &&
      routesChildren(schema) &&
      segments[0] === getChildPath(child, api)
    ) {
      segments.shift()
      schema = child
      sourcePath = `${formPath}/${getChildPath(child, api)}`
      claimKey = appendDataPath(claimKey, child.name)
      const { data, key } = itemLocation
      location = {
        data: key !== null ? (data?.[key] ?? null) : null,
        key: child.name,
        dataPath: appendDataPath(itemLocation.dataPath, child.name),
        componentPath: appendDataPath(itemLocation.componentPath, child.name)
      }
    } else {
      break
    }
  }
  return claim
}

// The route of the form of the item that `componentPath` leads into below the
// source, the deepest one, as `claimSourceRoute()` opens it, with the component
// path that remains within the form:
export function getSourceFormRoute(
  sourceRoute: SourceRoute,
  componentPath: string,
  api: Pick<Api, 'normalizePath'>
): { path: string; componentPath: string } | null {
  const { location } = sourceRoute
  const segments = parseDataPath(
    getRelativeDataPath(componentPath, location.componentPath) ?? ''
  )
  let { schema, path, isTransient } = sourceRoute
  let value = location.data?.[location.key!]
  let route = null
  while (true) {
    let item = value
    if (isListSource(schema)) {
      const index = segments.shift()
      if (index === undefined) break
      item = value?.[index]
      isTransient = usesIndexKeys(schema, isTransient)
      path += `/${getItemKey(schema, item, index, isTransient)}`
    }
    if (hasFormSchema(schema)) {
      route = { path, componentPath: segments.join('/') }
    }
    const [child] = getChildSourceSchemas(schema)
    if (
      child &&
      item &&
      routesChildren(schema) &&
      segments[0] === child.name
    ) {
      segments.shift()
      path += `/${getChildPath(child, api)}`
      schema = child
      value = item[child.name]
    } else {
      break
    }
  }
  return route
}

// Find the path of the form of `item` by its identity, e.g. after it or the
// item of a parent moved:
function findItemPath(
  sourceRoute: SourceRoute,
  item: object,
  api: Pick<Api, 'normalizePath'>
): string | null {
  const find = (
    schema: Schema,
    value: any,
    path: string,
    isTransient: boolean
  ): string | null => {
    const isList = isListSource(schema)
    const [child] = routesChildren(schema) ? getChildSourceSchemas(schema) : []
    if (isList) {
      isTransient = usesIndexKeys(schema, isTransient)
    }
    for (const [index, entry] of isList
      ? Object.entries(value ?? [])
      : [['', value]]) {
      if (entry) {
        const formPath = isList
          ? `${path}/${getItemKey(schema, entry, index, isTransient)}`
          : path
        const itemPath =
          toRaw(entry) === toRaw(item)
            ? formPath
            : child
              ? find(
                  child,
                  entry[child.name],
                  `${formPath}/${getChildPath(child, api)}`,
                  isTransient
                )
              : null
        if (itemPath) return itemPath
      }
    }
    return null
  }
  const { schema, location, path, isTransient } = sourceRoute
  return find(schema, location.data?.[location.key!], path, isTransient)
}
