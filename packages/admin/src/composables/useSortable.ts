import { inject, ref } from 'vue'
import type { ListEntry } from '../utils/DataModel.ts'
import { adminContextKey, dataContextKey } from '../utils/keys.ts'

export interface SortableOptions {
  // Components without it apply the sorted list themselves, like tree items:
  getListEntry?: () => ListEntry
  onChange?: () => void
}

export function useSortable({
  getListEntry,
  onChange
}: SortableOptions = {}) {
  const { settings } = inject(adminContextKey)!
  const dataContext = inject(dataContextKey, null)
  const isDragging = ref(false)

  const moveSortableItem = (from: number, to: number) => {
    const listEntry = getListEntry!()
    const { length } = listEntry.list
    if (from >= 0 && from !== to && to >= 0 && to < length) {
      dataContext!.model.move(listEntry, from, to)
      onChange?.()
    }
  }

  return {
    isDragging,

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

        onStart() {
          isDragging.value = true
        },

        // Ignore the list `DitoDraggable` emits, the item moves in place:
        onEnd({ oldIndex, newIndex }: { oldIndex: number; newIndex: number }) {
          isDragging.value = false
          if (getListEntry) {
            moveSortableItem(oldIndex, newIndex)
          }
        }
      }
    },

    // Move by `delta` positions, from the keyboard in `DitoDragHandle`:
    moveItem(index: number, delta: number) {
      moveSortableItem(index, index + delta)
    }
  }
}
