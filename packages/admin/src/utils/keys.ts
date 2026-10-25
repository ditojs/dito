import type {
  InjectionKey,
  MaybeRef,
  Ref,
  ShallowRef,
  VNodeChild
} from 'vue'
import type { AdminContext } from './AdminContext.ts'
import type { DataContext } from './DataContext.ts'
import type { ResourceContext } from './ResourceContext.ts'
import type { RouteContext } from './RouteContext.ts'
import type { SourceContext } from './SourceContext.ts'
import type { FileDropTargets } from './FileDropTargets.js'
import type { Context } from './schema/types.ts'
import type { Data, Schema } from './types.ts'
import type { SchemaEventsEmitter } from '../composables/useSchemaEvents.ts'
import type { ComponentPath } from '../composables/useComponentPath.ts'

// Type components register the toggle of all their items, which the label of
// their container shows:
export interface LabelToggle {
  readonly collapsed: boolean
  readonly title: string
  toggle(): void
}

// The panes of layout sections provide their components to `DitoSchemaField`
// and `DitoPane`:
export interface Layout {
  readonly props: {
    readonly store: Record<string, any>
    readonly [key: string]: any
  }
  readonly componentPath: Ref<string>
  readonly entries: Ref<Record<string, any>[]>
  getEntry(name: string): Record<string, any>
}

// Renders the components of a layout, see `schemaLayoutKey`:
export type SchemaLayout = () => VNodeChild

// The form of `useDitoForm()`, which `DitoSchemaForm` renders:
export interface SchemaForm {
  readonly dataContext: DataContext
  readonly buttonSchemas: Ref<Record<string, Schema> | null>
  // The form of a page renders as the page's schema, see `DitoView`:
  readonly isPageForm: boolean
}

// The data that widgets edit by the `name` of its written properties: of the
// form, an object or a list item:
export interface PropertyScope {
  readonly properties: Record<string, Schema>
  readonly data: Data
  readonly dataPath: string
  // The name of the scope's own value, e.g. of primitive list items:
  readonly valueName?: string
}

export interface PanelTab {
  readonly tabName: string
  isTabSelected(): boolean
}

// A level of a tree widget, with its current `#form` slot and the levels below
// it that registered:
export interface TreeLevel {
  readonly props: Record<string, any>
  readonly formSlot: ShallowRef<((context: Context) => any) | undefined>
  readonly levels: TreeLevel[]
}

type Key<T> = InjectionKey<T>

export const adminContextKey: Key<AdminContext> = Symbol('adminContext')
export const dataContextKey: Key<DataContext> = Symbol('dataContext')
export const routeContextKey: Key<RouteContext> = Symbol('routeContext')
// Views provide the source of their main component, which changes:
export const sourceContextKey: Key<MaybeRef<SourceContext | null>> =
  Symbol(
    'sourceContext'
  )
// Forms and sources with a resource, which their components continue:
export const resourceContextKey: Key<ResourceContext | null> =
  Symbol(
    'resourceContext'
  )
// The schema of the source of the data's item, e.g. of a form's list:
export const sourceSchemaKey: Key<Ref<Schema | null>> = Symbol('sourceSchema')
export const schemaEventsKey: Key<SchemaEventsEmitter> = Symbol('schemaEvents')
export const schemaContextKey: Key<Context> = Symbol('schemaContext')
export const componentPathKey: Key<ComponentPath> = Symbol('componentPath')
export const labelToggleKey: Key<Ref<LabelToggle | null>> =
  Symbol(
    'labelToggle'
  )
export const layoutKey: Key<Layout | null> = Symbol('layout')
// The layout that the next schema renders in its main pane instead of its
// fields, e.g. the `component` of a section, or the slot of `DitoListField`
// for each item. Provided instead of passed down as slots, as forwarded slots
// render all components on their way again with each render of their origin:
export const schemaLayoutKey: Key<Ref<SchemaLayout | null>> =
  Symbol('schemaLayout')
export const schemaFormKey: Key<SchemaForm> = Symbol('schemaForm')
export const propertyScopeKey: Key<PropertyScope> = Symbol('propertyScope')
export const panelTabKey: Key<PanelTab | null> = Symbol('panelTab')
export const accumulatedBasisKey: Key<MaybeRef<number | null>> =
  Symbol(
    'accumulatedBasis'
  )
// Whether the containers and panels around a component are visible:
export const visibleKey: Key<MaybeRef<boolean>> = Symbol('visible')
export const fileDropTargetsKey: Key<FileDropTargets> =
  Symbol(
    'fileDropTargets'
  )
export const treeLevelsKey: Key<TreeLevel[]> = Symbol('treeLevels')
