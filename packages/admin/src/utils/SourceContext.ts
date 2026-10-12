import type { SourceNode } from './RouteTree.ts'
import type { ResourceContext, SubmitButton } from './ResourceContext.ts'
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
  // Through the resource of the source or of the button:
  submit(button: SubmitButton): Promise<boolean>
  // The transient verbs of sources in nested data, e.g. `remove`:
  readonly verbs: Record<string, string>
  // Only sources with a resource of their own have it:
  readonly resourceContext: ResourceContext | null
}
