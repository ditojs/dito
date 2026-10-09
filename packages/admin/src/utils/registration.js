// Registers `component` under its `componentPath` by calling
// `register(add, componentPath)`, and registers it again under the new path
// whenever its component path changes, e.g. when list items move, see
// `DitoSchema._registerEntry()`. Returns a function that unregisters it, to be
// called when the component is unmounted.
export function trackRegistration(component, register) {
  let registeredComponentPath = component.componentPath
  register(true, registeredComponentPath)
  const unwatch = component.$watch('componentPath', componentPath => {
    register(false, registeredComponentPath)
    registeredComponentPath = componentPath
    register(true, componentPath)
  })
  return () => {
    unwatch()
    register(false, registeredComponentPath)
  }
}
