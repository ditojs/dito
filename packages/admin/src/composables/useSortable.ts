import { inject } from 'vue'
import type { ListEntry } from '../utils/DataModel.ts'
import { adminContextKey, dataContextKey } from '../utils/keys.ts'

export interface SortableOptions {
  getListEntry: () => ListEntry
  onChange?: () => void
}

export function useSortable({ getListEntry, onChange }: SortableOptions) {
  const { settings } = inject(adminContextKey)!
  const dataContext = inject(dataContextKey, null)

  const moveSortableItem = (from: number, to: number) => {
    const listEntry = getListEntry()
    const { length } = listEntry.list
    if (from >= 0 && from !== to && to >= 0 && to < length) {
      dataContext!.model.move(listEntry, from, to)
      onChange?.()
    }
  }

  return {
    getDraggableOptions(
      forceFallback: boolean = settings.forceDragFallback ?? false
    ) {
      const prefix = 'dito-draggable'
      return {
        animation: 150,
        handle: '.dito-button--drag',
        dragClass: `${prefix}__drag`,
        chosenClass: `${prefix}__chosen`,
        ghostClass: `${prefix}__ghost`,
        fallbackClass: `${prefix}__fallback`,
        forceFallback,

        // Ignore the list `DitoDraggable` emits, the item moves in place:
        onEnd({ oldIndex, newIndex }: { oldIndex: number; newIndex: number }) {
          moveSortableItem(oldIndex, newIndex)
        }
      }
    },

    // Move by `delta` positions, from the keyboard in `DitoDragHandle`:
    moveItem(index: number, delta: number) {
      moveSortableItem(index, index + delta)
    }
  }
}
