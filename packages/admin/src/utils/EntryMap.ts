import { toRaw } from 'vue'
import type { Data } from './types.ts'

type Key = string | number

// The data that holds a value at `name`, which errors and records are keyed by,
// as it stays with list items that move, unlike data paths:
export interface FieldKey {
  data: Data
  name: Key
}

// Compare data by its raw object, as it may come through reactive proxies.
type ValuesByName<T> = Map<Key, T>

export class WeakEntryMap<T> {
  protected valuesByData:
    | WeakMap<object, ValuesByName<T>>
    | Map<object, ValuesByName<T>> = new WeakMap()

  // NOTE: Data that is collected without its entries being deleted keeps them
  // counted, which only costs the optimizations that rely on `size`.
  size = 0

  get({ data, name }: FieldKey): T | undefined {
    return this.valuesByData.get(toRaw(data))?.get(name)
  }

  set({ data, name }: FieldKey, value: T) {
    const rawData = toRaw(data)
    let valuesByName = this.valuesByData.get(rawData)
    if (!valuesByName) {
      valuesByName = new Map()
      this.valuesByData.set(rawData, valuesByName)
    }
    if (!valuesByName.has(name)) {
      this.size++
    }
    valuesByName.set(name, value)
  }

  delete({ data, name }: FieldKey): boolean {
    const rawData = toRaw(data)
    const valuesByName = this.valuesByData.get(rawData)
    const isDeleted = !!valuesByName?.delete(name)
    if (isDeleted) {
      this.size--
      if (valuesByName!.size === 0) {
        this.valuesByData.delete(rawData)
      }
    }
    return isDeleted
  }

  hasEntriesOf(data: object): boolean {
    return this.valuesByData.has(toRaw(data))
  }

  entriesOf(data: object): Iterable<[Key, T]> {
    return this.valuesByData.get(toRaw(data))?.entries() ?? []
  }
}

// Entry maps can be iterated and cleared, but keep their data alive.
export class EntryMap<T> extends WeakEntryMap<T> {
  protected override valuesByData = new Map<object, ValuesByName<T>>()

  clear() {
    this.valuesByData.clear()
    this.size = 0
  }

  *values(): Generator<T> {
    for (const valuesByName of this.valuesByData.values()) {
      yield* valuesByName.values()
    }
  }
}
