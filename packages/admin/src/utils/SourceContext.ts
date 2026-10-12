import type { SourceNode } from './RouteTree.ts'
import type { ResourceContext } from './ResourceContext.ts'
import type { ListQuery } from './ListQuery.js'
import type { Schema } from './types.ts'

// The context of a list, object or tree, provided to the components that
// display it and its items, see `useSource()`.
export interface SourceContext {
  readonly schema: Schema
  // The node of the source in the route tree, if it has routed forms:
  readonly node: SourceNode | null
  // The query of lists, e.g. their scope, page, order and filters:
  readonly query: Record<string, any>
  readonly listQuery: ListQuery
  readonly dataPath: string
  readonly componentPath: string
  readonly store: Record<string, any>
  readonly isDisabled: boolean
  // Create an item with the form `schema`, of `type` if the source has
  // several forms, and insert it at `index`, or else at the end:
  createItem(schema: Schema, type?: string | null, index?: number | null): any
  // The label of `item`, an object for inlined items and HTML for others. Each
  // item reads its own, so that edits only update the label of their item:
  getSourceItemLabel(item: any, index?: number | null): any
  // Load the data of the source again, e.g. after its item was saved:
  reload(): void
  // The resource of the source, which views provide with their main source:
  readonly resource: ResourceContext
}
