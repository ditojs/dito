import { onBeforeMount, onUnmounted, useTemplateRef, type Ref } from 'vue'
import { asArray } from '@ditojs/utils'
import type { Services } from '../utils/services.ts'

export interface FocusOptions {
  // By default, the element with the template ref `element` is focused:
  focusElement?: () => void
  blurElement?: () => void
}

export function useFocus(
  { adminContext, dataContext }: Services,
  componentPath: Ref<string>,
  { focusElement, blurElement }: FocusOptions = {}
) {
  // The element, or a component that focuses its own, like `DitoInput`:
  const element = useTemplateRef<any>('element')
  const getTarget = () => asArray(element.value)[0] ?? null
  const getElement = () => {
    const target = getTarget()
    return target?.$el ?? target
  }

  focusElement ??= () => getTarget()?.focus?.()
  blurElement ??= () => getTarget()?.blur?.()

  let unregister: () => void
  onBeforeMount(() => {
    unregister = adminContext.ui.register(() => componentPath.value, {
      dataContext,
      focus() {
        getElement()?.scrollIntoView?.({
          behavior: 'smooth',
          block: 'center'
        })
        focusElement()
      }
    })
  })
  onUnmounted(() => unregister())

  return {
    // NOTE: The template ref `element` can only be used once per component.
    element,

    async focus() {
      await dataContext!.componentTree.reveal(componentPath.value, {
        focus: true
      })
      adminContext.ui.focus(dataContext!, componentPath.value)
    },

    blur() {
      blurElement()
    }
  }
}
