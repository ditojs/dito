import {
  getCurrentInstance,
  onBeforeMount,
  onUnmounted,
  useTemplateRef
} from 'vue'
import { asArray } from '@ditojs/utils'
import type { Services } from '../utils/services.ts'

export interface FocusOptions {
  // Focus and blur the element that edits the value, by default the one with
  // the template ref `element`, or else the root element:
  focusElement?: () => void
  blurElement?: () => void
}

// Focus the component, revealing it first, e.g. in a collapsed schema or a tab
// that isn't selected, through its handle in the UI registry.
export function useFocus(
  { admin, container }: Services,
  { focusElement, blurElement }: FocusOptions = {}
) {
  // NOTE: The component path is still a member of the component:
  const component = getCurrentInstance()!.proxy as any
  const element = useTemplateRef<any>('element')

  const getElement = () => asArray(element.value)[0] ?? null

  const getFocusElement = () => {
    const target = getElement() ?? component
    return target.$el ?? target
  }

  // Prefer the `focus()` and `blur()` of components, e.g. `DitoInput` focuses
  // its input rather than its root element that `getFocusElement()` returns:
  const getFocusTarget = (method: 'focus' | 'blur') => {
    const target = getElement()
    return target?.[method] ? target : getFocusElement()
  }

  focusElement ??= () => getFocusTarget('focus')?.focus?.()
  blurElement ??= () => getFocusTarget('blur')?.blur?.()

  let unregister: () => void
  onBeforeMount(() => {
    unregister = admin.ui.register(() => component.componentPath, {
      container,
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
    // The template ref `element`, which can only be used once per component:
    element,

    focus() {
      return admin.ui.reveal(container, component.componentPath, {
        focus: true
      })
    },

    blur() {
      blurElement()
    }
  }
}
