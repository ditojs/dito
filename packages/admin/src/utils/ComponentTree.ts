import {
  computed,
  markRaw,
  nextTick,
  shallowReactive,
  type ComputedRef
} from 'vue'
import { isArray, isObject, parseDataPath } from '@ditojs/utils'
import SchemaContext from '../SchemaContext.js'
import { getChildStore } from '../composables/useStore.ts'
import { ItemStores } from './ItemStores.js'
import { appendDataPath, getRelativeDataPath } from './data.js'
import { hasResource } from './resource.js'
import {
  claimSourceRoute,
  getItemKey,
  getSourceFormRoute,
  getSourcePath,
  ViewNode
} from './RouteTree.ts'
import { getItemUid } from './schema/data.js'
import {
  getFormSchemas,
  getItemFormSchemaFromForms,
  getNamedSchemas,
  getViewSchema,
  hasFormSchema
} from './schema/lookup.js'
import {
  isInlined,
  isListSource,
  isPanel,
  isSingleFieldView
} from './schema/structure.js'
import {
  getChildSourceSchemas,
  getSourceType,
  getTypeDescriptor
} from './schema/types.ts'
import {
  callOrLog,
  getSchemaValue,
  shouldRenderSchema
} from './schema/value.js'
import {
  getFieldNodes,
  getItemNodes,
  getSchemaSource
} from './schema/walk.js'
import type { DataContext } from './DataContext.ts'
import type { RouteClaim, RouteContext, TabClaim } from './RouteContext.ts'
import type { SourceRoute } from './RouteTree.ts'
import type { SourceContext } from './SourceContext.ts'
import type { Data, Schema } from './types.ts'

// The item whose values the components display, and where it is in the data:
interface Scope {
  getItem(): Data | null
  getDataPath(): string
  // The value that wrapped items hold at their own data path:
  readonly wrappedValueName: string | null
}

// A field of a form's field node, or a written property as its own field:
interface Entry {
  readonly fieldNode: any
  readonly field: any
}

// The components that widgets render for a property, while they're mounted:
export interface Leaf {
  readonly componentPath: string
}

export interface Mounted {
  // The source, which provides the items of its forms:
  sourceContext: SourceContext | null
  // The component that focuses its element when its node is revealed:
  focusTarget: { focus(): void } | null
  // The data of panels with their own data:
  dataContext: DataContext | null
}

type Store = Record<string, any>

interface NodeOptions {
  readonly key?: string
  readonly name?: string | null
  // Tabs show their components in the schema of their parent:
  readonly isTab?: boolean
  // The schema of fields that are sources, e.g. lists, under their key, as
  // panes render them:
  readonly sourceSchema?: Schema | null
  // The store of the component in the one of its parent, if it isn't the child
  // store by its key:
  getStore?(parentStore: Store): Store
  getSchema?(): Schema | null
  // The item that holds the component's value, or the item of item nodes:
  getData?(): Data | null
  getDataPath?(): string
  getItemDataPath?(): string
  isRelevant?(): boolean
  isVisible?(): boolean
  // Item nodes are added to `indices`, with their index in their list:
  getChildren?(
    node: ComponentNode,
    indices: Map<ComponentNode, number>
  ): ComponentNode[]
}

// The route state of a source:
interface Source {
  readonly schema: Schema
  readonly linksToView: boolean
  readonly isTransient: boolean
  readonly routePath: string | null
  readonly isBeyondMaxDepth: boolean
  readonly sourceRoute: SourceRoute | null
}

interface Children {
  readonly nodes: ComponentNode[]
  readonly nodesByKey: Map<string, ComponentNode>
  readonly indices: Map<ComponentNode, number>
}

// The components of a data context's data as its schema and data define them,
// mounted or not, with the component paths of `useComponentPath()`: the names
// of fields, sections, tabs and panels, and the indices of items.
export class ComponentTree {
  readonly dataContext: DataContext
  // The store of the schema that displays the data:
  readonly store: Store
  readonly root: ComponentNode

  constructor(dataContext: DataContext, store: Store) {
    markRaw(this)
    this.dataContext = dataContext
    this.store = store
    const scope: Scope = {
      getItem: () => dataContext.data,
      getDataPath: () => dataContext.dataPath,
      wrappedValueName: null
    }
    this.root = new ComponentNode(this, null, {
      getSchema: () => dataContext.schema,
      getData: scope.getItem,
      getDataPath: scope.getDataPath,
      getItemDataPath: scope.getDataPath,
      getChildren: node =>
        node.createScopeNodes(
          scope,
          dataContext.data
            ? getFieldNodes(
                dataContext.schema,
                dataContext.data,
                dataContext.dataPath,
                this.walkOptions
              )
            : null
        )
    })
  }

  get walkOptions() {
    return {
      services: this.dataContext.services,
      rootData: this.dataContext.model.rootData
    }
  }

  // The nodes of the fields that display the value at `dataPath`, in the order
  // of their forms, without the irrelevant and hidden ones:
  getFieldNodes(dataPath: string): ComponentNode[] {
    const nodes: ComponentNode[] = []
    const visit = (node: ComponentNode) => {
      for (const child of node.children) {
        if (
          getRelativeDataPath(dataPath, child.itemDataPath) !== null &&
          child.isShown()
        ) {
          if (
            child.name !== null &&
            getRelativeDataPath(dataPath, child.dataPath) === ''
          ) {
            nodes.push(child)
          }
          visit(child)
        }
      }
    }
    visit(this.root)
    return nodes
  }

  // Open the collapsed schemas and render the tabs that lead to the component
  // at `componentPath`, which `select` also selects, in the stores and routes
  // that hold their state, and render them at once. `focus` also focuses the
  // component once it's rendered:
  async reveal(
    componentPath: string,
    {
      focus = false,
      select = focus
    }: { focus?: boolean; select?: boolean } = {}
  ) {
    let node = this.root
    node.store.opened = true
    for (const key of parseDataPath(
      getRelativeDataPath(componentPath, node.componentPath) ?? ''
    )) {
      const child = node.getNode(key)
      if (!child.isTab) {
        child.store.opened = true
      } else if (child.isShown()) {
        const { store } = node
        getChildStore(store, 'mountedTabs')[key] = true
        if (select) {
          const { routeContext } = this.dataContext.services
          if (node === this.root && routeContext && !isPanel(node.schema)) {
            routeContext.selectedTab = key
          } else {
            store.selectedTab = key
          }
        }
      }
      node = child
    }
    await nextTick()
    if (focus) {
      // Paths inside values that no deeper component displays focus the
      // component of the value:
      for (; node !== this.root; node = node.parent!) {
        const { focusTarget } = node.mounted
        if (focusTarget) {
          focusTarget.focus()
          break
        }
      }
    }
  }

  // The node at the component path `componentPath`:
  getNode(componentPath: string): ComponentNode {
    return this.root.getNode(
      getRelativeDataPath(componentPath, this.root.componentPath) ?? ''
    )
  }

  // The form or tab that the route's `path` opens below the route of this
  // data: the tabs of the route's schema claim their names, the sources the
  // forms of their items, the first one in schema order:
  claimRoute(
    path: string,
    routeContext: RouteContext
  ): RouteClaim | TabClaim | null {
    // Single-component views claim the forms of objects at their own path:
    const rest = getRelativeDataPath(path, routeContext.path)
    if (rest !== null) {
      const { root } = this
      const tab = rest && getNamedSchemas(root.schema?.tabs)?.[rest]
      return (
        tab && (
          !root.data ||
          shouldRenderSchema(
            tab,
            this.createContext(root.schema!, {
              data: root.data,
              dataPath: root.dataPath
            })
          )
        )
      )
        ? { tab: rest }
        : root.claimRoute(path)
    }
    return null
  }

  // The route of the form that shows the component at `componentPath`, of the
  // first routed source on the way, with the component path within the form:
  getFormRoute(
    componentPath: string
  ): { path: string; componentPath: string } | null {
    let node = this.root
    for (const key of parseDataPath(
      getRelativeDataPath(componentPath, node.componentPath) ?? ''
    )) {
      node = node.getNode(key)
      const { sourceRoute } = node
      const route = sourceRoute
        ? getSourceFormRoute(sourceRoute, componentPath, this.api)
        : null
      if (route) return route
    }
    return null
  }

  get api() {
    return this.dataContext.services.adminContext.api
  }

  // The same contexts as the rendered components get:
  createContext(schema: Schema, values: Record<string, any>) {
    const { services, rootData } = this.walkOptions
    return SchemaContext.createForSchema(services, {
      ...values,
      schema,
      rootData
    } as any)
  }
}

// A component in the tree, or below it, e.g. a button or a widget of the same
// value as another one, which continues the path of its parent.
export class ComponentNode {
  readonly tree: ComponentTree
  readonly parent: ComponentNode | null
  // The components that widgets render for the node's property, by the
  // component paths of their layouts, while they're mounted:
  readonly leaves = new Set<Leaf>()
  // What the mounted components of the node provide while they're mounted:
  readonly mounted = shallowReactive<Mounted>({
    sourceContext: null,
    focusTarget: null,
    dataContext: null
  })

  readonly #ownOptions: NodeOptions
  #children: ComputedRef<Children> | null = null
  #componentPath: ComputedRef<string> | null = null
  // The nodes of the children by the objects that they stand for, and of the
  // items by their uids, so that they stay the same, with the widgets attached
  // to them, while the children are computed again:
  #nodesByComponent = new WeakMap<object, ComponentNode>()
  #itemNodesByUid = new Map<string | number, ComponentNode>()
  // Reactive, as the sources of widgets below the tree claim routes too:
  #detachedNodes = shallowReactive(new Map<string, ComponentNode>())
  // Below the tree, the node of the value at the node's key in the data that
  // the path continues, if there is one, which the node mirrors. Values may
  // appear after the node is first asked for, e.g. with the form of a type:
  readonly #value: ComputedRef<ComponentNode | null> | null
  #source: ComputedRef<Source | null> | null = null

  constructor(
    tree: ComponentTree,
    parent: ComponentNode | null,
    options: NodeOptions = {},
    isDetached = false
  ) {
    // Nodes are provided to components in reactive objects, which mustn't
    // wrap them, as proxies have no private fields:
    markRaw(this)
    this.tree = tree
    this.parent = parent
    this.#ownOptions = options
    this.#value = isDetached
      ? computed(() => {
          const value = parent!.#getDataNode().getChild(options.key!)
          return value && !value.isTab ? value : null
        })
      : null
  }

  get #options(): NodeOptions {
    const value = this.#value?.value
    return value ? value.#options : this.#ownOptions
  }

  // The node whose data the node displays, the one of its parent if it only
  // continues the path:
  #getDataNode(): ComponentNode {
    return this.#value && !this.#value.value
      ? this.parent!.#getDataNode()
      : this
  }

  // The name of the component in the path of its parent, or its item's index:
  get key(): string | null {
    return (
      this.#options.key ??
      (this.parent ? getIndexKey(this.parent.#getChildren(), this) : null)
    )
  }

  get componentPath(): string {
    this.#componentPath ??= computed(() =>
      this.parent
        ? appendDataPath(this.parent.componentPath, this.key)
        : this.tree.dataContext.componentPath
    )
    return this.#componentPath.value
  }

  get schema(): Schema | null {
    return this.#options.getSchema?.() ?? null
  }

  // The name of the value of fields and properties, `null` for others:
  get name(): string | null {
    return this.#options.name ?? null
  }

  get dataPath(): string | null {
    return this.#options.getDataPath?.() ?? null
  }

  // The data path of the item that holds the component's value:
  get itemDataPath(): string | null {
    return this.#options.getItemDataPath?.() ?? null
  }

  // The store of the node's component, as the component gets it:
  get store(): Store {
    const { parent } = this
    return parent
      ? (this.#options.getStore?.(parent.store) ??
        getChildStore(parent.store, this.key!))
      : this.tree.store
  }

  get isTab(): boolean {
    return !!this.#options.isTab
  }

  get children(): ComponentNode[] {
    return this.#getChildren().nodes
  }

  // The child at `key`, `null` if it isn't in the tree:
  getChild(key: string): ComponentNode | null {
    return this.#getChildren().nodesByKey.get(key) ?? null
  }

  // Like when rendered, irrelevant components aren't rendered, and hidden ones
  // display nothing:
  isRelevant(): boolean {
    return this.#options.isRelevant?.() ?? true
  }

  isShown(): boolean {
    return this.isRelevant() && (this.#options.isVisible?.() ?? true)
  }

  get data(): Data | null {
    return this.#options.getData?.() ?? null
  }

  // The node's component is mounted while it focuses its element or provides
  // the items of its source:
  get isMounted(): boolean {
    const { focusTarget, sourceContext } = this.mounted
    return !!(focusTarget || sourceContext)
  }

  // The schema of the source at the node: of its field, or of the widget that
  // lays out its property while it's mounted, as only the layout has it:
  get sourceSchema(): Schema | null {
    return (
      this.#options.sourceSchema ??
      this.mounted.sourceContext?.schema ??
      null
    )
  }

  // Sources link to views or load their data through their resource, the
  // others are part of the data around them:
  get linksToView(): boolean {
    return !!this.#getSource()?.linksToView
  }

  get isTransient(): boolean {
    return !!this.#getSource()?.isTransient
  }

  // The path of the source within its route, after the names of the tabs,
  // sections and panels around it, e.g. `pricing/families`, or after the path
  // of the item of the inlined source whose item holds it, e.g. `books/3`:
  get routePath(): string | null {
    return this.#getSource()?.routePath ?? null
  }

  // Forms that contain themselves stop routing their sources after `maxDepth`
  // repetitions:
  get isBeyondMaxDepth(): boolean {
    return !!this.#getSource()?.isBeyondMaxDepth
  }

  // The source and where its value and routes are, for the forms of its items.
  // Inlined sources render the forms of their items themselves:
  get sourceRoute(): SourceRoute | null {
    return this.#getSource()?.sourceRoute ?? null
  }

  // Sources link to the forms of their items, if they have one:
  get formPath(): string | null {
    const { sourceRoute } = this
    return sourceRoute && hasFormSchema(sourceRoute.schema)
      ? sourceRoute.path
      : null
  }

  // The claim of the form that `path` opens below the source at the node, or
  // the sources below it, in schema order. Routed sources show their items in
  // the forms of their routes, and widgets below the tree claim too:
  claimRoute(path: string): RouteClaim | null {
    const { sourceRoute, sourceSchema } = this
    if (sourceRoute) {
      return claimSourceRoute(sourceRoute, path, this.tree.api)
    } else if (!sourceSchema || isInlined(sourceSchema)) {
      for (const node of [...this.children, ...this.#detachedNodes.values()]) {
        const claim = node.isRelevant() ? node.claimRoute(path) : null
        if (claim) return claim
      }
    }
    return null
  }

  // The path of the item at `index` in the routes of the forms below it, also
  // of the items of inlined sources, or the source's own path for objects:
  getItemRoutePath(index: string | number | null): string | null {
    const source = this.#getSource()
    if (source && index !== null) {
      const value = this.data?.[this.name!]
      const items = isArray(value) ? value : (value?.results ?? [])
      return `${source.routePath}/${
        getItemKey(source.schema, items[+index], index, source.isTransient)
      }`
    }
    return source?.routePath ?? null
  }

  #getSource() {
    this.#source ??= computed(() => {
      const schema = this.sourceSchema
      return schema ? this.#createSource(schema) : null
    })
    return this.#source.value
  }

  #createSource(schema: Schema) {
    const { componentPath, tree } = this
    const { adminContext, routeContext } = tree.dataContext.services
    const { api } = adminContext
    const linksToView = !!getViewSchema(
      schema,
      tree.createContext(schema, {
        name: this.name,
        data: this.data,
        dataPath: this.dataPath,
        itemDataPath: this.itemDataPath
      })
    )
    const isTransient = (
      !hasResource(schema) && !linksToView ||
      !!routeContext?.isTransient
    )
    // The source whose inlined items hold this one:
    let parent = this.parent
    while (parent && !parent.sourceSchema) {
      parent = parent.parent
    }
    const getRoutePath = () => {
      const parentPath = parent?.routePath
        ? getRelativeDataPath(componentPath, parent.componentPath)
        : null
      if (parentPath) {
        const segments = parseDataPath(parentPath)
        const index = isListSource(parent!.sourceSchema)
          ? segments.shift()!
          : null
        return `${parent!.getItemRoutePath(index)}/${
          getSourcePath(schema, segments.join('/'), api)
        }`
      }
      const path = routeContext
        ? getRelativeDataPath(
            componentPath,
            routeContext.dataContext.componentPath
          )
        : null
      if (path !== null) {
        // Single-component views route their component under their own path:
        const { node, path: basePath } = routeContext!
        return (
          node instanceof ViewNode &&
          isSingleFieldView(node.schema) &&
          path === node.schema.name
        )
          ? basePath
          : `${basePath}/${getSourcePath(schema, path, api)}`
      }
      return null
    }
    let depth = 1
    for (let route = routeContext; route; route = route.parent) {
      if (route.claim?.schema === schema) depth++
    }
    const isBeyondMaxDepth = depth > (schema.maxDepth ?? 1)
    const routePath = getRoutePath()
    const node = this
    return {
      schema,
      linksToView,
      isTransient,
      routePath,
      isBeyondMaxDepth,
      sourceRoute:
        routePath && !isInlined(schema) && !linksToView && !isBeyondMaxDepth
          ? {
              schema,
              location: {
                data: this.data,
                key: schema.name,
                dataPath: this.dataPath!,
                componentPath
              },
              path: routePath,
              isTransient,
              get source() {
                return node.mounted.sourceContext
              }
            }
          : null
    }
  }

  // The node at the component path `path` below this one. Paths that leave the
  // tree lead to nodes that only continue it:
  getNode(path: string): ComponentNode {
    let node: ComponentNode = this
    for (const key of parseDataPath(path)) {
      node = node.getChild(key) ?? node.#getDetachedNode(key)
    }
    return node
  }

  // The nodes of the field nodes of the item of `scope`:
  createScopeNodes(
    scope: Scope,
    fieldNodes: Map<string, any> | null
  ): ComponentNode[] {
    const entries = [...(fieldNodes?.values() ?? [])].flatMap(fieldNode =>
      // Written properties are their own field:
      fieldNode.fields
        ? fieldNode.fields.map((field: any) => ({ fieldNode, field }))
        : [{ fieldNode, field: null }]
    )
    return this.#createComponentNodes(scope, entries, 0)
  }

  #getChildren(): Children {
    this.#children ??= computed(() => {
      const indices = new Map<ComponentNode, number>()
      const nodes = this.#options.getChildren?.(this, indices) ?? []
      return {
        nodes,
        indices,
        nodesByKey: new Map(
          nodes.map(node => [
            node.#options.key ?? getIndexKey({ indices }, node)!,
            node
          ])
        )
      }
    })
    return this.#children.value
  }

  // Below the tree, values continue the data of the node that the path left,
  // in nodes that mirror the nodes of the values, e.g. the ones of widgets in
  // sections or of several widgets of the same value:
  #getDetachedNode(key: string) {
    let node = this.#detachedNodes.get(key)
    if (!node) {
      node = new ComponentNode(this.tree, this, { key }, true)
      this.#detachedNodes.set(key, node)
    }
    return node
  }

  // The nodes of the components that contain `entries` at `depth` of their
  // containers: fields, and the sections, tabs and panels around fields.
  // Fields that hold the data of their panels contain them too:
  #createComponentNodes(
    scope: Scope,
    entries: Entry[],
    depth: number
  ): ComponentNode[] {
    const entriesByComponent = new Map<object, Entry[]>()
    for (const entry of entries) {
      const { fieldNode, field } = entry
      const component = field?.containers[depth] ?? field ?? fieldNode
      entriesByComponent.set(component, [
        ...(entriesByComponent.get(component) ?? []),
        entry
      ])
    }
    return [...entriesByComponent].map(([component, entries]) => {
      let node = this.#nodesByComponent.get(component)
      if (!node) {
        node = this.#createComponentNode(scope, component, entries, depth)
        this.#nodesByComponent.set(component, node)
      }
      return node
    })
  }

  #createComponentNode(
    scope: Scope,
    component: any,
    entries: Entry[],
    depth: number
  ): ComponentNode {
    const { tree } = this
    // The field of the component itself, if it's one:
    const entry = entries.find(
      ({ fieldNode, field }) => (field ?? fieldNode) === component
    )
    const fieldNode = entry?.fieldNode ?? null
    const field = entry?.field ?? null
    const name: string | null = fieldNode?.name ?? null
    const schema: Schema = component.schema ?? component.property
    const getDataPath = () =>
      name !== null && name !== scope.wrappedValueName
        ? appendDataPath(scope.getDataPath(), name)
        : scope.getDataPath()
    const getEntry = () => ({
      node: fieldNode,
      data: scope.getItem(),
      name,
      dataPath: getDataPath(),
      itemDataPath: scope.getDataPath(),
      ...tree.walkOptions
    })
    const isTab = !fieldNode && component.name === null && !isPanel(schema)
    const getContext = () =>
      tree.createContext(schema, { ...getEntry(), name: component.name })
    // Like when rendered, fields are relevant with their containers, and the
    // containers by themselves:
    const isRelevant = () => {
      if (fieldNode) {
        const relevantNode = fieldNode.getRelevantNode(getEntry())
        return field ? !!relevantNode?.fields.includes(field) : !!relevantNode
      } else {
        return callOrLog(() => shouldRenderSchema(schema, getContext()), true)
      }
    }
    // Like when rendered, tabs have no visibility, and written properties are
    // displayed through the visibility of their widgets:
    const hasVisibility = !!field || !fieldNode && !isTab
    const isVisible = () =>
      callOrLog(
        () =>
          getSchemaValue('visible', {
            type: Boolean,
            schema,
            context: getContext(),
            default: () => getTypeDescriptor(schema)?.defaultVisible ?? true
          }),
        true
      )
    const containedEntries = entries.filter(other => other !== entry)
    return new ComponentNode(tree, this, {
      key: component.key ?? component.name,
      name,
      isTab,
      sourceSchema:
        field && getSourceType(schema)
          ? schema.name === name
            ? schema
            : { ...schema, name }
          : null,
      // Tabs show their components in the schema of their parent, and panels
      // keep their state by their names:
      getStore: isTab
        ? store => store
        : isPanel(schema)
          ? store => getChildStore(store, schema.name)
          : undefined,
      getSchema: () => schema,
      getData: scope.getItem,
      getDataPath,
      getItemDataPath: scope.getDataPath,
      isRelevant,
      isVisible: hasVisibility ? isVisible : undefined,
      getChildren: (node, indices) => [
        ...(
          fieldNode
            ? node.#createItemNodes(scope, fieldNode, field, indices)
            : []
        ),
        ...node.#createComponentNodes(scope, containedEntries, depth + 1)
      ]
    })
  }

  // The nodes of the items in the value of this field node: list items, or the
  // components of an object's item in the node itself.
  #createItemNodes(
    scope: Scope,
    fieldNode: any,
    field: any,
    indices: Map<ComponentNode, number>
  ) {
    const { tree, name } = this
    const source = field ? getSchemaSource(field.schema) : fieldNode.source
    const value = source?.hasForms ? scope.getItem()?.[name!] : null
    const nodes: ComponentNode[] = []
    if (value != null) {
      const { itemAdapter } = source
      const wrap = (value: any) =>
        itemAdapter ? itemAdapter.wrap(value) : value
      const getItemForms = () =>
        field
          ? [
              {
                forms: getFormSchemas(
                  field.schema,
                  tree.createContext(field.schema, {
                    data: scope.getItem(),
                    name,
                    dataPath: this.dataPath,
                    itemDataPath: scope.getDataPath()
                  })
                ),
                childSourceSchemas: getChildSourceSchemas(field.schema)
              }
            ]
          : fieldNode.getItemForms()
      const wrappedValueName = itemAdapter?.name ?? null
      const createItemScopeNodes = (node: ComponentNode, itemScope: Scope) => {
        const item = itemScope.getItem()
        return isObject(item)
          ? node.createScopeNodes(
              itemScope,
              getItemNodes(
                getItemForms(),
                item,
                itemScope.getDataPath(),
                tree.walkOptions
              )
            )
          : []
      }
      if (isArray(value)) {
        const nodesByUid = new Map<string | number, ComponentNode>()
        value.forEach((value, index) => {
          const item = wrap(value)
          if (isObject(item)) {
            // Wrapped values have no identity, their nodes keep their index:
            const uid = itemAdapter ? index : getItemUid(this.schema!, item)
            const node = (
              this.#itemNodesByUid.get(uid) ??
              this.#createItemNode(
                () => scope.getItem()?.[name!] ?? null,
                getItemForms,
                createItemScopeNodes,
                wrap,
                wrappedValueName
              )
            )
            nodesByUid.set(uid, node)
            indices.set(node, index)
            nodes.push(node)
          }
        })
        this.#itemNodesByUid = nodesByUid
      } else if (!source.isList) {
        // Objects are their own item:
        nodes.push(
          ...createItemScopeNodes(this, {
            getItem: () => wrap(scope.getItem()?.[name!]),
            getDataPath: () => this.dataPath!,
            wrappedValueName
          })
        )
      }
    }
    return nodes
  }

  #createItemNode(
    getList: () => any[] | null,
    getItemForms: () => { forms: Record<string, Schema> }[],
    createItemScopeNodes: (
      node: ComponentNode,
      scope: Scope
    ) => ComponentNode[],
    wrap: (value: any) => any,
    wrappedValueName: string | null
  ): ComponentNode {
    // Nodes of removed items may still be read until their components
    // unmount:
    const getItem = () => wrap(getList()?.[node.key as any])
    const getDataPath = () => appendDataPath(this.dataPath!, node.key)
    const node: ComponentNode = new ComponentNode(this.tree, this, {
      getStore: store =>
        ItemStores.getFromStore(store).getStore(
          this.schema,
          getItem(),
          Number(node.key)
        ),
      getSchema: () =>
        getItemFormSchemaFromForms(getItemForms()[0].forms, getItem()),
      getData: getItem,
      getDataPath,
      getItemDataPath: getDataPath,
      getChildren: node =>
        createItemScopeNodes(node, { getItem, getDataPath, wrappedValueName })
    })
    return node
  }
}

// The key of item nodes, by the index that the last computation of their
// parent's children gave them:
function getIndexKey(
  { indices }: Pick<Children, 'indices'>,
  node: ComponentNode
) {
  const index = indices.get(node)
  return index !== undefined ? String(index) : null
}
