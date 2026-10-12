import type { SourceNode } from './RouteTree.ts'

type Schema = Record<string, any>

// The list, object or tree that provides the context.
export interface SourceOwner {
  readonly schema: Schema
  readonly sourceNode: SourceNode | null
  readonly query: Record<string, any>
  readonly dataPath: string
  readonly componentPath: string
  readonly store: Record<string, any>
  readonly disabled: boolean
  createItem(schema: Schema, type?: string | null, index?: number | null): any
  getSourceItemLabel(item: any, index: number | null): any
  reloadData(): void
}

// The context of a list, object or tree, provided to the components that
// display it and its items.
export class SourceContext {
  readonly #owner: SourceOwner

  constructor(owner: SourceOwner) {
    this.#owner = owner
  }

  get schema(): Schema {
    return this.#owner.schema
  }

  // The node of the source in the route tree, if it has routed forms:
  get node(): SourceNode | null {
    return this.#owner.sourceNode
  }

  // The query of lists, e.g. their scope, page, order and filters:
  get query(): Record<string, any> {
    return this.#owner.query
  }

  get dataPath(): string {
    return this.#owner.dataPath
  }

  get componentPath(): string {
    return this.#owner.componentPath
  }

  get store(): Record<string, any> {
    return this.#owner.store
  }

  get isDisabled(): boolean {
    return this.#owner.disabled
  }

  // Create an item with the form `schema`, of `type` if the source has
  // several forms, and insert it at `index`, or else at the end:
  createItem(schema: Schema, type?: string | null, index?: number | null) {
    return this.#owner.createItem(schema, type, index)
  }

  // The label of `item`, an object for inlined items and HTML for others. Each
  // item reads its own, so that edits only update the label of their item:
  getItemLabel(item: any, index: number | null = null) {
    return this.#owner.getSourceItemLabel(item, index)
  }

  // Load the data of the source again, e.g. after its item was saved:
  reload() {
    this.#owner.reloadData()
  }
}
