<template lang="pug">
  .dito-account
    a(
      @mousedown.stop="showPulldown(true)"
    )
      span {{ user.username }}
    ul.dito-pulldown(
      :class="{ 'dito-open': pulldown.open }"
    )
      li(
        v-for="(label, value) of items"
        @mousedown.stop="handlePulldownSelect(value)"
        @mouseup="handlePulldownSelect(value, true)"
      )
        a {{ label }}
</template>

<style lang="sass">
.dito
  .dito-account
    position: relative
    .dito-pulldown
      top: $pulldown-padding-ver
    a
      cursor: pointer
</style>

<script>
import DitoComponent from '@/DitoComponent'
import PulldownMixin from '@/mixins/PulldownMixin'

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
        break
      }
      this.showPulldown(false)
    }
  }
})
</script>
