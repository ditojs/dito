import { getCurrentInstance, inject, useTemplateRef } from 'vue'
import { asArray } from '@ditojs/utils'

export interface FocusOptions {
  // Focus and blur the element that edits the value, by default the one with
  // the template ref `element`, or else the root element:
  focusElement?: () => void
  blurElement?: () => void
}

// Focus the component, revealing it in its schema and tab first.
export function useFocus({
  focusElement,
  blurElement
}: FocusOptions = {}) {
  // Components without an `element` ref focus their root element:
  const component = getCurrentInstance()!.proxy!
  const element = useTemplateRef<any>('element')
  const getSchemaComponent = inject<() => any>('$schemaComponent')!
  const getTabComponent = inject<() => any>('$tabComponent')!

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

  // Also focus the schema and the tab of the component, e.g. to open them:
  const focusSchema = async () => {
    await getSchemaComponent().focus()
    await getTabComponent()?.focus()
  }

  const scrollIntoView = async () => {
    await focusSchema()
    getFocusElement()?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  }

  return {
    // The template ref `element`, which can only be used once per component:
    element,

    async focus() {
      await focusSchema()
      scrollIntoView()
      focusElement()
    },

    blur() {
      blurElement()
    }
  }
}
