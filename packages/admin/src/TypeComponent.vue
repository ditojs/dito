<template lang="pug">
  // When used to nest arbitrary vue components in a schema, see below.
  component(
    :is="component"
    :schema="schema"
    :dataPath="dataPath"
    :data="data"
    :meta="meta"
    :store="store"
    :disabled="disabled"
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

typeComponents.component = TypeComponent

TypeComponent.register = function (type, options) {
  const types = asArray(type)
  const component = TypeComponent.component(`type-${types[0]}`, options)
  for (const t of types) {
    typeComponents[t] = component
  }
  return component
}

TypeComponent.get = function (type) {
  return typeComponents[type]
}

export default TypeComponent
</script>
