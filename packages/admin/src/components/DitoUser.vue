<template lang="pug">
  .dito-user
    a(
      @mousedown="handlePulldownClick($event)"
    )
      span {{ user.username }}
    ul.dito-pulldown(
      :class="{ 'dito-open': pulldown.open }"
    )
      li(
        v-for="(label, value) of items"
        @mousedown="handlePulldownSelect(value)"
        @mouseup="handlePulldownSelect(value)"
      )
        a {{ label }}
</template>

<style lang="sass">
.dito
  .dito-user
    position: relative
    .dito-pulldown
      top: $pulldown-padding-ver
    a
      cursor: pointer
</style>

<script>
import DitoComponent from '@/DitoComponent'
import PulldownMixin from '@/mixins/PulldownMixin'

export default DitoComponent.component('dito-user', {
  mixins: [PulldownMixin],

  props: {
    user: { type: Object }
  },

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
