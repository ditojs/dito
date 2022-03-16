<template lang="pug">
  .dito-account
    a(
      @mousedown.stop="onPulldownMouseDown()"
    )
      span {{ user.username }}
    ul.dito-pulldown(
      :class="{ 'dito-open': pulldown.open }"
    )
      li(
        v-for="(label, value) of items"
      )
        a(
          @mousedown.stop="onPulldownMouseDown(value)"
          @mouseup="onPulldownMouseUp(value)"
        ) {{ label }}
</template>

<style lang="sass">
  .dito-account
    position: relative
    .dito-pulldown
      top: $pulldown-padding-ver
</style>

<script>
import DitoComponent from '../DitoComponent.js'
import PulldownMixin from '../mixins/PulldownMixin.js'

// @vue/component
export default DitoComponent.component('dito-account', {
  mixins: [PulldownMixin],

  data() {
    return {
      items: {
        settings: 'Settings',
        logout: 'Logout'
      }
    }
  },

  methods: {
    onPulldownSelect(value) {
      switch (value) {
      case 'logout':
        this.rootComponent.logout()
        break
      case 'settings':
        console.info('TODO: Implement Settings')
        break
      }
    }
  }
})
</script>
