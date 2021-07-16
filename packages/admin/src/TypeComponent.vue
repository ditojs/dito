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

const TypeComponent = DitoComponent.extend({
  mixins: [TypeMixin],

  defaultValue: null,
  defaultNested: true,
  defaultVisible: true,
  generateLabel: true,
  excludeValue: false,
  ignoreMissingValue: null,
  omitPadding: false,

  computed: {
    component() {
      return this.resolveTypeComponent(this.schema.component)
    }
  }
})

TypeComponent.register = function(types, definition = {}) {
  types = asArray(types)
  const component = this.component(`dito-type-${types[0]}`, definition)
  for (const type of types) {
    registerTypeComponent(type, component)
  }
  return component
}

TypeComponent.get = getTypeComponent

// Register the general purpose 'component' type, which can resolve to any
// custom component through `schema.component`, see `resolveTypeComponent()` For
// this we actually extend the abstract `TypeComponent` to override the standard
// `defaultValue: null` to not set any data for custom components by default,
// unless they provide a default value.
TypeComponent.register('component', {
  extends: TypeComponent,
  defaultValue: () => undefined, // Callback to override `defaultValue: null`
  ignoreMissingValue: schema => !('default' in schema)
})

export default TypeComponent
</script>
