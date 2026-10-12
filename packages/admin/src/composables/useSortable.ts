import { inject, ref } from 'vue'
import type { ContainerContext } from '../utils/ContainerContext.ts'
import type { ListEntry } from '../utils/DataModel.ts'

export interface SortableOptions {
  // The list that dragging sorts, which moves its items through the data
  // model. Components without it apply the sorted list themselves, e.g. tree
  // items:
  getListEntry?: () => ListEntry
  onChange?: () => void
}

// Sort a list of the component's data by dragging its items, see
// `DitoDraggable`.
export function useSortable({
  getListEntry,
  onChange
}: SortableOptions = {}) {
  const container = inject<ContainerContext | null>('container', null)
  const isDragging = ref(false)

  const moveSortableItem = (from: number, to: number) => {
    const listEntry = getListEntry!()
    const { length } = listEntry.list
    if (from >= 0 && from !== to && to >= 0 && to < length) {
      container!.model.move(listEntry, from, to)
      onChange?.()
    }
  }

  return {
    isDragging,

    getDraggableOptions(
      forceFallback: boolean = window.dito.settings?.forceDragFallback ?? false
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

        // The reordered list that `DitoDraggable` emits is ignored, as the
        // item moves in place:
        onEnd({ oldIndex, newIndex }: { oldIndex: number; newIndex: number }) {
          isDragging.value = false
          if (getListEntry) {
            moveSortableItem(oldIndex, newIndex)
          }
        }
      }
    },

    // Move the item by `delta` positions, see `DitoDragHandle`:
    moveItem(item: any, delta: number) {
      const index = getListEntry!().list.indexOf(item)
      moveSortableItem(index, index + delta)
    }
  }
}
