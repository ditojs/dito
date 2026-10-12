import type { DataModel } from './DataModel.ts'

type Match = string | string[] | RegExp | ((dataPath: string) => boolean)

// The schema component that renders the data, which shows its errors:
interface SchemaComponent {
  validateAll(match?: Match, notify?: boolean): boolean
  showValidationErrors(
    errors: Record<string, any>,
    dataPath?: string
  ): Promise<void>
  revealErrors(): Promise<void>
}

// The component that owns a data model: a form, view, dialog or panel with its
// own data.
export interface ContainerOwner {
  // The model that holds the data, which is the parent's for forms that edit
  // the item of their parent:
  readonly dataModel: DataModel
  readonly isCreating?: boolean
  readonly hasData?: boolean
  readonly $refs: { schema?: SchemaComponent }
  setData(data: any): any
  // Take over the errors of the item in the parent's data, in forms:
  copyErrors?(): void
}

export interface DialogOwner extends ContainerOwner {
  resolve(value: unknown): void
}

// The context of a component that owns a data model, provided to the
// components that display its data.
export class ContainerContext {
  readonly #owner: ContainerOwner

  constructor(owner: ContainerOwner) {
    this.#owner = owner
  }

  get model(): DataModel {
    return this.#owner.dataModel
  }

  get #schema(): SchemaComponent {
    return this.#owner.$refs.schema!
  }

  get isDirty(): boolean {
    return this.model.isDirty
  }

  get isEdited(): boolean {
    return this.model.isEdited
  }

  // Whether the data is there to display: Forms load or create their item,
  // the others always have their data:
  get hasData(): boolean {
    return this.#owner.hasData ?? true
  }

  // Only forms that create their item are creating:
  get isCreating(): boolean {
    return !!this.#owner.isCreating
  }

  // Validate the data, or only the values whose data paths match `match`, and
  // show their errors. Return whether they're valid:
  validate(match?: Match): boolean {
    return this.#schema.validateAll(match)
  }

  // Like `validate()`, but without showing the errors:
  verify(match?: Match): boolean {
    return this.#schema.validateAll(match, false)
  }

  // Show the errors of the server for the data that was sent, which is at
  // `dataPath`, by default the root data:
  showValidationErrors(errors: Record<string, any>, dataPath?: string) {
    return this.#schema.showValidationErrors(errors, dataPath)
  }

  // Reveal the errors of the data, e.g. once the form that edits them opened.
  // Forms take over the errors of their item first, also when they're open
  // already, e.g. when their parent shows its errors:
  revealErrors() {
    this.#owner.copyErrors?.()
    return this.#schema.revealErrors()
  }

  markEdited() {
    this.model.markEdited()
  }

  // Forms merge `data` into their item, the others replace their data with it,
  // which their data model sets up with the defaults right away:
  replaceItem(data: any): any {
    return this.#owner.setData(data)
  }
}

export class DialogContext extends ContainerContext {
  readonly #owner: DialogOwner

  constructor(owner: DialogOwner) {
    super(owner)
    this.#owner = owner
  }

  // Close the dialog, resolving `showDialog()` with `value`:
  close(value?: unknown) {
    this.#owner.resolve(value)
  }
}
