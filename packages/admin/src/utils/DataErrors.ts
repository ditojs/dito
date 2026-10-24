import {
  effectScope,
  watch,
  shallowRef,
  triggerRef,
  type EffectScope
} from 'vue'
import {
  isArray,
  isPlainObject,
  parseDataPath,
  getValueAtDataPath
} from '@ditojs/utils'
import { getRelativeDataPath } from './data.js'
import { getOriginal } from './uid.js'
import { isEmptySchema } from './schema/lookup.js'
import { walkData, type DataEntry } from './schema/walk.js'
import { WeakEntryMap, type FieldKey } from './EntryMap.ts'
import type { DataModel } from './DataModel.ts'

export interface ValueError {
  message: string
  // Server errors also tell their keyword and its parameters:
  keyword?: string
  params?: Record<string, any>
  // The path of the error inside the value, if no deeper field displays it:
  path?: string
}

interface ValueErrors {
  validation: ValueError[]
  server: ValueError[]
  // Any change of the value clears its errors for good:
  stopWatching?: () => void
}

// The errors of the values in the data of a model, and of their fields.
export class DataErrors {
  readonly model: DataModel
  readonly #errors = shallowRef(new WeakEntryMap<ValueErrors>())
  readonly #fieldErrors = shallowRef(new WeakEntryMap<string[]>())
  // The watchers that clear the errors of values, which the data holds:
  #scope!: EffectScope

  constructor(model: DataModel) {
    this.model = model
  }

  #getFieldKey(dataPath: string): FieldKey {
    const { data, dataPath: modelDataPath } = this.model
    const path = parseDataPath(getRelativeDataPath(dataPath, modelDataPath)!)
    const name = path.pop()!
    return { data: getValueAtDataPath(data, path, () => null), name }
  }

  get(dataPath: string): ValueError[] | null {
    const { data, name } = this.#getFieldKey(dataPath)
    const errors = this.#errors.value.get({ data, name })
    return errors ? [...errors.validation, ...errors.server] : null
  }

  // The errors of the field itself, e.g. of options that failed to load:
  getFieldMessages(dataPath: string): string[] | null {
    return this.#fieldErrors.value.get(this.#getFieldKey(dataPath)) ?? null
  }

  set(dataPath: string, errors: ValueError[] | null) {
    this.#setErrors(this.#getFieldKey(dataPath), 'validation', errors)
  }

  // Replace the validation errors of the value at `dataPath` with the ones of
  // its node, e.g. when its component is blurred, also in the items of sources
  // with a resource. Return whether it's valid:
  validate(dataPath: string): boolean {
    const { schema, data } = this.model
    let errors: ValueError[] = []
    if (data && !isEmptySchema(schema)) {
      walkData(schema!, data, {
        ...this.model.walkOptions,
        dataPath: this.model.dataPath,
        shouldSkipIrrelevant: true,
        // Only walk the values that contain the value:
        shouldVisit: entry => (
          getRelativeDataPath(dataPath, entry.dataPath) !== null
        ),
        visit: entry => {
          if (entry.dataPath === dataPath) {
            const propertyNode = entry.node.getPropertyNode(entry)
            errors = propertyNode?.getValidationErrors(entry) ?? []
          }
        }
      })
    }
    this.set(dataPath, errors.length > 0 ? errors : null)
    return errors.length === 0
  }

  add(dataPath: string, message: string) {
    const key = this.#getFieldKey(dataPath)
    const messages = this.#fieldErrors.value.get(key) ?? []
    if (!messages.includes(message)) {
      this.#fieldErrors.value.set(key, [...messages, message])
      triggerRef(this.#fieldErrors)
    }
  }

  remove(dataPath: string, message: string) {
    const key = this.#getFieldKey(dataPath)
    const messages = this.#fieldErrors.value.get(key) ?? []
    if (messages.includes(message)) {
      if (messages.length > 1) {
        this.#fieldErrors.value.set(
          key,
          messages.filter(error => error !== message)
        )
      } else {
        this.#fieldErrors.value.delete(key)
      }
      triggerRef(this.#fieldErrors)
    }
  }

  // Errors inside values that no deeper field displays go to the field of the
  // value, with their path in it, e.g. of objects edited as code. With
  // `isMatchingDataPath()`, only the errors of the matching fields are
  // replaced. Return the data paths of the fields that hold the errors, by the
  // data paths of the errors, without the ones that no field holds.
  replace(
    errors: Record<string, ValueError[]>,
    {
      dataPath = this.model.dataPath,
      server = false,
      isMatchingDataPath = null
    }: {
      dataPath?: string
      server?: boolean
      isMatchingDataPath?: ((dataPath: string) => boolean) | null
    } = {}
  ): Record<string, string> {
    const entries: DataEntry[] = []
    this.#walkFieldEntries(dataPath, entry => entries.push(entry))
    const errorsByDataPath: Record<string, ValueError[]> = {}
    const fieldDataPaths: Record<string, string> = {}
    for (const [errorDataPath, valueErrors] of Object.entries(errors)) {
      // The deepest field that displays the value or contains it:
      let field: { dataPath: string; path: string } | null = null
      for (const { dataPath } of entries) {
        const path = getRelativeDataPath(errorDataPath, dataPath)
        if (
          path !== null &&
          dataPath!.length > (field?.dataPath.length ?? -1)
        ) {
          field = { dataPath: dataPath!, path }
        }
      }
      if (field) {
        const { dataPath, path } = field
        errorsByDataPath[dataPath] = [
          ...(errorsByDataPath[dataPath] ?? []),
          ...valueErrors.map(error => (path ? { ...error, path } : error))
        ]
        fieldDataPaths[errorDataPath] = dataPath
      }
    }
    for (const { dataPath } of entries) {
      const errors = errorsByDataPath[dataPath!] ?? null
      if (errors || !isMatchingDataPath || isMatchingDataPath(dataPath!)) {
        this.#setErrors(
          this.#getFieldKey(dataPath!),
          server ? 'server' : 'validation',
          errors
        )
      }
    }
    return fieldDataPaths
  }

  // The errors of the fields stay until their sources remove them.
  clear(dataPath = this.model.dataPath) {
    this.#walkFieldEntries(dataPath, entry => {
      this.#setValueErrors(this.#getFieldKey(entry.dataPath!), null)
    })
  }

  reset() {
    this.#scope?.stop()
    this.#scope = effectScope(true)
    this.#errors.value = new WeakEntryMap()
  }

  stop() {
    this.#scope.stop()
  }

  getDataPaths(dataPath = this.model.dataPath): string[] {
    const dataPaths: string[] = []
    this.#walkFieldEntries(dataPath, entry => {
      if (this.get(entry.dataPath!) || this.getFieldMessages(entry.dataPath!)) {
        dataPaths.push(entry.dataPath!)
      }
    })
    return dataPaths
  }

  // Return whether `data` or the data nested in it hold fields with errors,
  // also where they aren't displayed, e.g. in the items of nested forms.
  hasWithin(data: any): boolean {
    // Optimization: Skip the deep walk, and with it the tracking of all nested
    // values, while there are no errors at all:
    if (this.#errors.value.size === 0 && this.#fieldErrors.value.size === 0) {
      return false
    }
    // Computed values can hold their ancestors, e.g. `parentItem`:
    const visited = new Set()
    const hasErrors = (data: any): boolean => {
      if ((isPlainObject(data) || isArray(data)) && !visited.has(data)) {
        visited.add(data)
        return (
          this.#errors.value.hasEntriesOf(data) ||
          this.#fieldErrors.value.hasEntriesOf(data) ||
          Object.values(data).some(hasErrors)
        )
      }
      return false
    }
    return hasErrors(data)
  }

  // Copy the errors of the originals of `data` and of the data nested in it,
  // e.g. from the errors of the parent's model to the draft of a nested form.
  copy(errors: DataErrors, data: any) {
    const visited = new Set()
    const copy = (data: any) => {
      if ((isPlainObject(data) || isArray(data)) && !visited.has(data)) {
        visited.add(data)
        const entries = errors.#errors.value.entriesOf(getOriginal(data))
        for (const [name, { validation, server }] of entries) {
          this.#setValueErrors({ data, name }, { validation, server })
        }
        Object.values(data).forEach(copy)
      }
    }
    copy(data)
  }

  // Take over the errors of the value at `dataPath` in `errors` as the ones of
  // `key`, e.g. of a primitive that a draft wraps:
  copyValue(errors: DataErrors, dataPath: string, key: FieldKey) {
    const valueErrors = errors.#errors.value.get(errors.#getFieldKey(dataPath))
    if (valueErrors) {
      const { validation, server } = valueErrors
      this.#setValueErrors(key, { validation, server })
    }
  }

  #setErrors(
    key: FieldKey,
    kind: 'validation' | 'server',
    errors: ValueError[] | null
  ) {
    const valueErrors = {
      ...(this.#errors.value.get(key) ?? { validation: [], server: [] }),
      [kind]: errors ?? []
    }
    this.#setValueErrors(
      key,
      valueErrors.validation.length > 0 || valueErrors.server.length > 0
        ? valueErrors
        : null
    )
  }

  #setValueErrors(key: FieldKey, errors: ValueErrors | null) {
    const { data, name } = key
    const currentErrors = this.#errors.value.get(key)
    if (errors) {
      // Watch synchronously and deeply, as values also change in place and
      // through direct writes, e.g. of `change` handlers:
      errors.stopWatching = (
        currentErrors?.stopWatching ??
        this.#scope.run(() =>
          watch(
            () => data[name],
            () => this.#setValueErrors(key, null),
            { deep: true, flush: 'sync' }
          )
        )
      )
      this.#errors.value.set(key, errors)
    } else if (currentErrors) {
      currentErrors.stopWatching?.()
      this.#errors.value.delete(key)
    }
    triggerRef(this.#errors)
  }

  #walkFieldEntries(
    dataPath: string,
    handleEntry: (entry: DataEntry) => void
  ) {
    const { schema, data } = this.model
    const isWithin = (entry: DataEntry) => (
      getRelativeDataPath(entry.dataPath, dataPath) !== null
    )
    if (data && !isEmptySchema(schema)) {
      walkData(schema!, data, {
        ...this.model.walkOptions,
        dataPath: this.model.dataPath,
        shouldSkipIrrelevant: true,
        // Visit the values within `dataPath`, and the ones that contain it. The
        // fields of their panels edit the data around them:
        shouldVisit: entry => (
          isWithin(entry) ||
          getRelativeDataPath(dataPath, entry.dataPath) !== null
        ),
        shouldSkipSourcesWithResource: true,
        visit: entry => {
          if (isWithin(entry)) {
            handleEntry(entry)
          }
        }
      })
    }
  }
}
