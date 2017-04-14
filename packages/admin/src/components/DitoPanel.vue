<template lang="pug">
  .dito-panel
    ul.dito-list(v-if="desc.components")
      li(v-for="(comp, key) in desc.components")
        dito-label(v-if="comp.label", :name="key", :text="comp.label")
        component(:is="typeToComponent(comp.type)", :name="key", :desc="comp",
          :data="data", :user="user", :root="false",
          :disabled="comp.disabled || disabled")
</template>

<script>
import BaseComponent from '@/BaseComponent'

export default BaseComponent.component('dito-panel', {
  props: {
    desc: { type: Object, required: true },
    data: { type: Object, required: true },
    user: { type: Object, required: true },
    disabled: { type: Boolean, required: true }
  }
})
</script>
