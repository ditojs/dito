<template lang="pug">
  form(@submit="submit")
    ul
      li(v-for="(props, name) in schema")
        template(v-if="props.label")
          DitoLabel(:text="props.label")
            component(:is="toComponentName(props.type)", :name="name", :props="props")
        template(v-else)
          component(:is="toComponentName(props.type)", :name="name", :props="props")
    DitoButton(type="submit", text="Submit")
</template>

<script>
import DitoComponent from './DitoComponent'

export default DitoComponent.extend({
  data() {
    return {
      schema: this.getMeta()
    }
  },

  methods: {
    submit (event) {
      this.log('submit')
      event.preventDefault()
    }
  }
})
</script>
