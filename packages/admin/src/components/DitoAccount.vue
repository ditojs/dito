<template lang="pug">
.dito-account
  DitoMenuButton.dito-account__button(
    :items="items"
    placement="bottom-left"
    offset
    @select="onSelectMenuItem"
  )
    span {{ adminContext.user.username }}
</template>

<script>
import { inject } from 'vue'
import { DitoMenuButton } from '@ditojs/ui/src'
import { adminContextKey } from '../utils/keys.ts'

export default {
  name: 'DitoAccount',
  components: { DitoMenuButton },

  setup() {
    const adminContext = inject(adminContextKey)
    return {
      adminContext,
      items: [
        { value: 'settings', label: 'Settings' },
        { value: 'logout', label: 'Logout' }
      ],

      onSelectMenuItem({ value }) {
        switch (value) {
          case 'logout':
            adminContext.session.logout()
            break
          case 'settings':
            console.info('TODO: Implement Settings')
            break
        }
      }
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-account {
  display: inline-block;

  // The menu button is a `DitoButton`, but shows the user name as plain text,
  // so reset the button styles, including the ones of its states:
  & &__button {
    cursor: pointer;

    &,
    &:hover,
    &:active,
    &:focus {
      min-width: 0;
      min-height: 0;
      padding: 0;
      border: 0;
      font: inherit;
      color: inherit;
      background: none;
      box-shadow: none;
    }

    &:focus-visible {
      @include focus-ring;
    }
  }
}
</style>
