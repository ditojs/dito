import {
  computed,
  inject,
  provide,
  ref,
  watch,
  type InjectionKey,
  type Ref
} from 'vue'
import { useSteps, countStepItems } from './useSteps.ts'

// Lists inside the items of other lists render all their items at once, as the
// steps of the outer list already spread the rendering over frames:
const isNestedKey: InjectionKey<boolean> = Symbol('isNested')

// Long lists render their first items right away and the others over the next
// frames, so that they show their content without waiting for all of it.
// `getItemWeight()` tells the number of fields that an item renders:
export function useRenderedItems<T>(
  items: Ref<T[]>,
  getItemWeight: (item: T, index: number) => number
) {
  const count = ref(inject(isNestedKey, false) ? Infinity : 0)
  provide(isNestedKey, true)
  const steps = useSteps(fields => {
    count.value += countStepItems(
      items.value,
      count.value,
      fields,
      getItemWeight
    )
    if (count.value >= items.value.length) {
      renderAll()
    }
  })

  // Once all items rendered, the ones added later render right away:
  const renderAll = () => {
    steps.stop()
    count.value = Infinity
  }

  watch(
    () => items.value.length,
    length => {
      if (length > count.value) {
        steps.start()
      } else if (length > 0) {
        renderAll()
      }
    },
    { immediate: true }
  )

  return {
    renderedItems: computed(() =>
      items.value.length > count.value
        ? items.value.slice(0, count.value)
        : items.value
    ),

    renderItemsUpTo(index: number) {
      count.value = Math.max(count.value, index + 1)
    }
  }
}
