import type { InjectionKey, MaybeRef, Ref } from 'vue'
import type { AdminContext } from './AdminContext.ts'
import type { DataContext } from './DataContext.ts'
import type { FieldRegistry } from './FieldRegistry.ts'
import type { ResourceContext } from './ResourceContext.ts'
import type { RouteContext } from './RouteContext.ts'
import type { SourceContext } from './SourceContext.ts'
import type { FileDropTargets } from './FileDropTargets.js'
import type { Context } from './schema/types.ts'
import type { Schema } from './types.ts'
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
  readonly props: Record<string, any>
  readonly componentPath: Ref<string>
  readonly entries: Ref<Record<string, any>[]>
  getEntry(name: string): Record<string, any>
}

export interface PanelTab {
  readonly tabName: string
  isTabSelected(): boolean
}

type Key<T> = InjectionKey<T>

export const adminContextKey: Key<AdminContext> = Symbol('adminContext')
export const dataContextKey: Key<DataContext> = Symbol('dataContext')
export const routeContextKey: Key<RouteContext> = Symbol('routeContext')
// Containers whose components are the fields that register in them:
export const fieldRegistryKey: Key<FieldRegistry> = Symbol('fieldRegistry')
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
export const panelTabKey: Key<PanelTab | null> = Symbol('panelTab')
export const accumulatedBasisKey: Key<MaybeRef<number | null>> =
  Symbol(
    'accumulatedBasis'
  )
export const fileDropTargetsKey: Key<FileDropTargets> =
  Symbol(
    'fileDropTargets'
  )
