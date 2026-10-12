import {
  getCurrentInstance,
  onBeforeMount,
  onUnmounted,
  useTemplateRef,
  type Ref
} from 'vue'
import { asArray } from '@ditojs/utils'
import type { Services } from '../utils/services.ts'

export interface FocusOptions {
  // By default, the element with the template ref `element`, or the root:
  focusElement?: () => void
  blurElement?: () => void
}

export function useFocus(
  { adminContext, dataContext }: Services,
  componentPath: Ref<string>,
  { focusElement, blurElement }: FocusOptions = {}
) {
  const component = getCurrentInstance()!.proxy!
  const element = useTemplateRef<any>('element')

  const getElement = () => asArray(element.value)[0] ?? null

  const getFocusElement = () => {
    const target = getElement() ?? component
    return target.$el ?? target
  }

  // Prefer the methods of components, like `DitoInput` focusing its input:
  const getFocusTarget = (method: 'focus' | 'blur') => {
    const target = getElement()
    return target?.[method] ? target : getFocusElement()
  }

  focusElement ??= () => getFocusTarget('focus')?.focus?.()
  blurElement ??= () => getFocusTarget('blur')?.blur?.()

  let unregister: () => void
  onBeforeMount(() => {
    unregister = adminContext.ui.register(() => componentPath.value, {
      dataContext,
      focus() {
        getFocusElement()?.scrollIntoView?.({
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

    focus() {
      return adminContext.ui.reveal(dataContext, componentPath.value, {
        focus: true
      })
    },

    blur() {
      blurElement()
    }
  }
}
