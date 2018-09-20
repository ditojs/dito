<template lang="pug">
  // This template is needed to render arbitrary vue components in a schema
  // for a given value through `type: 'component'`, see below.
  // For values of $props, see TypeMixin.props.
  component(
    :is="component"
    :dataPathIsValue="true"
    v-bind="$props"
  )
</template>

<script>
// TypeComponent is the base component for all other type components inside the
// types/ folder.
// It is also registered as a type component itself, registered with
// type="component", and can be used to nest arbitrary vue components in schema:
//
// {
//   type: 'component',
//   component: import('./component')
// }
import DitoComponent from './DitoComponent'
import TypeMixin from './mixins/TypeMixin'
import { asArray } from '@ditojs/utils'

const { typeComponents } = DitoComponent

const TypeComponent = DitoComponent.component('typo-component', {
  mixins: [TypeMixin],

  computed: {
    component() {
      return this.resolveTypeComponent(this.schema.component)
    }
  }
})

// Expose this component as the general purpose 'component' type, which can
// resolves to any provided custom component, through `schema.component`, see
// `resolveTypeComponent()`
typeComponents.component = TypeComponent

TypeComponent.register = function(type, options = {}) {
  const types = asArray(type)
  const component = this.component(`type-${types[0]}`, options)
  // If nothing is specified, the default value for `defaultValue` is null:
  if (!('defaultValue' in component.options)) {
    component.options.defaultValue = null
  }
  for (const t of types) {
    typeComponents[t] = component
  }
  return component
}

TypeComponent.get = function(type) {
  return typeComponents[type]
}

export default TypeComponent
</script>
