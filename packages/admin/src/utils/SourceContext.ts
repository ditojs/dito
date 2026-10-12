import type { SourceNode } from './RouteTree.ts'
import type { ResourceContext } from './ResourceContext.ts'
import type { ListQuery } from './ListQuery.js'
import type { Schema } from './types.ts'

// The context that `useSource()` provides to the components of its items.
export interface SourceContext {
  readonly schema: Schema
  readonly node: SourceNode | null
  readonly query: Record<string, any>
  readonly listQuery: ListQuery
  readonly dataPath: string
  readonly componentPath: string
  readonly store: Record<string, any>
  readonly isDisabled: boolean
  createItem(schema: Schema, type?: string | null, index?: number | null): any
  // Each item reads its own label, so that edits only update theirs:
  getSourceItemLabel(item: any, index?: number | null): any
  reload(): void
  // Views provide the resource of their main source:
  readonly resource: ResourceContext
}
