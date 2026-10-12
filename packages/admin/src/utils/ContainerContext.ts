import type { DataModel } from './DataModel.ts'

type Schema = Record<string, any>
type Match = string | string[] | RegExp | ((dataPath: string) => boolean)

// The component that owns a data model: a form, view, dialog or panel with its
// own data.
export interface ContainerOwner {
  // The model of its own data, and the one that holds its data, which is the
  // parent's for forms that edit the item of their parent:
  readonly ownDataModel: DataModel
  readonly dataModel: DataModel
  readonly componentPath: string
  readonly isCreating?: boolean
  readonly hasData?: boolean
  readonly mainSchemaComponent: {
    validateAll(match?: Match, notify?: boolean): boolean
  }
  setData(data: any): any
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

  get schema(): Schema | null {
    return this.#owner.ownDataModel.schema
  }

  get dataPath(): string {
    return this.#owner.ownDataModel.dataPath
  }

  get componentPath(): string {
    return this.#owner.componentPath
  }

  get rootData(): Record<string, any> | null {
    return this.#owner.ownDataModel.rootData
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
    return this.#owner.mainSchemaComponent.validateAll(match)
  }

  // Like `validate()`, but without showing the errors:
  verify(match?: Match): boolean {
    return this.#owner.mainSchemaComponent.validateAll(match, false)
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
