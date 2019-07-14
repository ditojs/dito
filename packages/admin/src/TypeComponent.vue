<template lang="pug">
  // This template is needed to render arbitrary vue components in a schema
  // for a given value through `type: 'component'`, see below.
  // For values of $props, see TypeMixin.props.
  component(
    :is="component"
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
import { getTypeComponent, registerTypeComponent } from '@/utils/schema'
import { asArray } from '@ditojs/utils'

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
registerTypeComponent('component', TypeComponent)

TypeComponent.register = function(types, definition = {}) {
  types = asArray(types)
  const component = this.component(`dito-type-${types[0]}`, definition)
  const { options } = component
  // Set defaults for `defaultValue` and `generateLabels` if not specified:
  if (!('defaultValue' in options)) {
    options.defaultValue = null
  }
  if (!('generateLabel' in options)) {
    options.generateLabel = true
  }
  for (const type of types) {
    registerTypeComponent(type, component)
  }
  return component
}

TypeComponent.get = getTypeComponent

export default TypeComponent
</script>
