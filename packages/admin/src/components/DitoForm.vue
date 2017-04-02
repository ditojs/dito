<template lang="pug">
  form(@submit="submit")
    ul
      dito-form-field(v-for="(desc, name) in schema", :key="name", :label="desc.label")
        component(:is="typeToComponent(desc.type)", :name="name", :props="desc")
    dito-button(type="submit", text="Submit")
</template>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.component('dito-form', {
  data() {
    return {
      schema: this.getMeta()
    }
  },

  methods: {
    submit (event) {
      console.log('submit')
      event.preventDefault()
    }
  }
})
</script>
