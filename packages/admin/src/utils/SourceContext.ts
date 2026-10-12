import type { SourceNode } from './RouteTree.ts'
import type { SubmitButton } from './ResourceContext.ts'
import type { ListQuery } from './ListQuery.js'
import type { Schema } from './types.ts'

// The context that `useSource()` provides to the components of its items.
export interface SourceContext {
  readonly schema: Schema
  readonly node: SourceNode | null
  readonly listQuery: ListQuery
  readonly dataPath: string
  readonly componentPath: string
  readonly store: Record<string, any>
  readonly isDisabled: boolean
  // The transient verbs of sources in nested data, e.g. `remove`:
  readonly verbs: Record<string, string>
  // The paths of the forms that create and edit the items:
  readonly createPath: string | null
  readonly objectPath: string | null
  getItemPath(index: number): string | null
  createItem(schema: Schema, type?: string | null, index?: number | null): any
  // Each item reads its own label, so that edits only update theirs:
  getSourceItemLabel(item: any, index?: number | null): any
  reload(): void
  // Through the resource of the source or of the button:
  submit(button: SubmitButton): Promise<boolean>
}
