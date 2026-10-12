import { nextTick } from 'vue'
import {
  isEmpty,
  labelize,
  normalizeDataPath,
  parseDataPath
} from '@ditojs/utils'
import SchemaContext from '../SchemaContext.js'
import { appendDataPath } from './data.js'
import {
  getSchemaValue,
  getComponentPathByDataPath
} from './schema/data.js'
import {
  getDataValidationErrors,
  getMatchingValidationErrors
} from './schema/validation.js'
import type { DataModel } from './DataModel.ts'
import type { Services } from './services.ts'
import type { Data, Schema } from './types.ts'

type Match = string | string[] | RegExp | ((dataPath: string) => boolean)

type Errors = Record<string, { message: string }[]>

export interface DataOwner {
  // The parent's model, in forms that edit the item of their parent:
  readonly dataModel: DataModel
  // The services of the components of the data:
  readonly services: Services
  // The schema that displays the data at `dataPath`, at `componentPath`:
  readonly schema: Schema
  readonly data: Data | null
  readonly dataPath: string
  readonly componentPath: string
  readonly isCreating?: boolean
  readonly hasData?: boolean
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
    const errors = this.#getValidationErrors(match)
    this.#showErrors(errors ?? {}).catch(console.error)
    return !errors
  }

  verify(match?: Match): boolean {
    return !this.#getValidationErrors(match)
  }

  // Show the server's errors of the data that was sent, at `dataPath`. Their
  // paths in property access notation lack the data path of the sent data:
  showValidationErrors(
    errors: Errors,
    dataPath: string = this.#owner.dataPath
  ) {
    return this.#showErrors(
      Object.fromEntries(
        Object.entries(errors).map(([path, errs]) => [
          normalizeDataPath(appendDataPath(dataPath, path)),
          errs
        ])
      ),
      { dataPath, server: true }
    )
  }

  // Forms take over the errors of their item first, also when they're open
  // already, e.g. when their parent shows its errors:
  revealErrors() {
    this.#owner.copyErrors?.()
    return this.#revealErrors(
      this.model.getErrorDataPaths(this.#owner.dataPath)
    )
  }

  markEdited() {
    this.model.markEdited()
  }

  // Forms merge `data` into their item, the others replace their data with it:
  replaceItem(data: any): any {
    return this.#owner.setData(data)
  }

  // Validate the data, not the mounted components, to include collapsed
  // schemas and closed nested forms:
  #getValidationErrors(match?: Match): Errors | null {
    const { schema, data, dataPath, services } = this.#owner
    const errors = data
      ? getDataValidationErrors(schema, data, {
          dataPath,
          services,
          rootData: this.model.rootData
        })
      : null
    return match ? getMatchingValidationErrors(errors, match) : errors
  }

  // Notify the errors that no field displays:
  async #showErrors(
    errors: Errors,
    { dataPath = this.#owner.dataPath, server = false } = {}
  ) {
    const unmatchedErrors = this.model.replaceErrors(errors, {
      dataPath,
      server
    })
    await this.#revealErrors(
      Object.keys(errors).filter(dataPath => !unmatchedErrors?.[dataPath])
    )
    if (!isEmpty(errors)) {
      const { schema, data, services } = this.#owner
      const label = (
        getSchemaValue('label', {
          type: String,
          schema,
          context: new SchemaContext(services, { schema, data, dataPath })
        }) ||
        labelize(schema.name)
      )
      const messages = Object.entries(unmatchedErrors ?? {}).flatMap(
        ([dataPath, errs]) => {
          const field = labelize(parseDataPath(dataPath).pop())
          const prefix = field ? `The field ${field}` : `The ${label}`
          return errs.map(({ message }) => `${prefix} ${message}`)
        }
      )
      services.adminContext.notify({
        type: 'error',
        title: 'Validation Errors',
        text: messages.join('\n') || 'Please correct the highlighted errors.'
      })
    }
  }

  // Fields in the forms of nested routes open the form, which reveals the
  // errors that it takes over from its item:
  async #revealErrors(dataPaths: string[]) {
    const { schema, data, dataPath, componentPath, services } = this.#owner
    const { adminContext, routeContext } = services
    const [firstDataPath] = dataPaths
    // Dialogs and panels with their own data aren't part of routes:
    const formRoute =
      firstDataPath && routeContext?.dataContext === this
        ? routeContext.getFormRoute(firstDataPath)
        : null
    if (formRoute) {
      const { router, ui } = adminContext
      // The form may be open already, e.g. a nested form:
      const failure =
        router.currentRoute.value.path !== formRoute.path
          ? await router.push({ path: formRoute.path })
          : null
      if (!failure) {
        await nextTick()
        const level = router.currentRoute.value.matched.length - 1
        await ui.routes[level].dataContext.revealErrors()
      }
    } else {
      for (const errorDataPath of dataPaths) {
        const path = getComponentPathByDataPath(schema, data, errorDataPath, {
          dataPath,
          componentPath,
          services,
          rootData: this.model.rootData
        })
        await adminContext.ui.reveal(this, path, {
          focus: errorDataPath === firstDataPath
        })
      }
    }
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
