import type { DataModel } from './DataModel.ts'

type Match = string | string[] | RegExp | ((dataPath: string) => boolean)

interface SchemaComponent {
  validateAll(match?: Match, notify?: boolean): boolean
  showValidationErrors(
    errors: Record<string, any>,
    dataPath?: string
  ): Promise<void>
  revealErrors(): Promise<void>
}

export interface DataOwner {
  // The parent's model, in forms that edit the item of their parent:
  readonly dataModel: DataModel
  readonly isCreating?: boolean
  readonly hasData?: boolean
  readonly schemaComponent: SchemaComponent | null
  setData(data: any): any
  // Forms take over the errors of their item in the parent's data:
  copyErrors?(): void
}

export class DataContext {
  readonly #owner: DataOwner

  constructor(owner: DataOwner) {
    this.#owner = owner
  }

  get model(): DataModel {
    return this.#owner.dataModel
  }

  get #schema(): SchemaComponent {
    return this.#owner.schemaComponent!
  }

  get isDirty(): boolean {
    return this.model.isDirty
  }

  get isEdited(): boolean {
    return this.model.isEdited
  }

  // Forms load or create their data, the others always have it:
  get hasData(): boolean {
    return this.#owner.hasData ?? true
  }

  get isCreating(): boolean {
    return !!this.#owner.isCreating
  }

  validate(match?: Match): boolean {
    return this.#schema.validateAll(match)
  }

  verify(match?: Match): boolean {
    return this.#schema.validateAll(match, false)
  }

  // Show the server's errors of the data that was sent, at `dataPath`:
  showValidationErrors(errors: Record<string, any>, dataPath?: string) {
    return this.#schema.showValidationErrors(errors, dataPath)
  }

  // Forms take over the errors of their item first, also when they're open
  // already, e.g. when their parent shows its errors:
  revealErrors() {
    this.#owner.copyErrors?.()
    return this.#schema.revealErrors()
  }

  markEdited() {
    this.model.markEdited()
  }

  // Forms merge `data` into their item, the others replace their data with it:
  replaceItem(data: any): any {
    return this.#owner.setData(data)
  }
}

export class DialogContext extends DataContext {
  readonly #resolve: (value: unknown) => void

  constructor(owner: DataOwner & { resolve(value: unknown): void }) {
    super(owner)
    this.#resolve = owner.resolve
  }

  close(value?: unknown) {
    this.#resolve(value)
  }
}
