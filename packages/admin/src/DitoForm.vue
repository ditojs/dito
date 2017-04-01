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
import './components'

export default DitoComponent.extend({
  props: ['schema'],
  name: 'DitoForm',
  components: DitoComponent.registry,

  methods: {
    submit (event) {
      this.log('submit')
      event.preventDefault()
    }
  }
})
</script>
