import { getCurrentInstance, inject, onBeforeMount, onUnmounted } from 'vue'
import { trackRegistration } from '../utils/registration.js'

// Register the component with its schema component under its component path,
// which reveals and focuses it, e.g. to show its errors, through the `focus()`
// that types return from `setup()`.
export function useRegistration(props: { readonly nested: boolean }) {
  const component = getCurrentInstance()!.proxy as any
  const getSchemaComponent = inject<() => any>('$schemaComponent')!

  const register = (add: boolean, componentPath: string) => {
    const schemaComponent = getSchemaComponent()
    // Register unnested components separately, to prevent them from
    // overriding the data paths of their parents:
    if (props.nested) {
      schemaComponent._registerComponent(component, add, componentPath)
    } else {
      schemaComponent?._registerUnnestedComponent(
        component,
        add,
        componentPath
      )
    }
  }

  let unregister: () => void
  onBeforeMount(() => {
    unregister = trackRegistration(component, register)
  })
  onUnmounted(() => unregister())
}
