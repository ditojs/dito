import { useTemplateRef, type Ref } from 'vue'
import { asArray } from '@ditojs/utils'
import { provideToNode } from './useComponentPath.ts'
import type { ComponentNode } from '../utils/ComponentTree.ts'
import type { Services } from '../utils/services.ts'

export interface FocusOptions {
  // By default, the element with the template ref `element` is focused:
  focusElement?: () => void
  blurElement?: () => void
}

export function useFocus(
  { dataContext }: Services,
  node: Ref<ComponentNode>,
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

  // The tree focuses the element once it revealed the component:
  provideToNode(node, 'focusTarget', {
    focus() {
      getElement()?.scrollIntoView?.({
        behavior: 'smooth',
        block: 'center'
      })
      focusElement()
    }
  })

  return {
    // NOTE: The template ref `element` can only be used once per component.
    element,

    focus() {
      return dataContext!.componentTree.reveal(node.value.componentPath, {
        focus: true
      })
    },

    blur() {
      blurElement()
    }
  }
}
