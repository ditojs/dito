<template lang="pug">
.dito-account
  DitoMenuButton.dito-account__button(
    :items="items"
    placement="bottom-left"
    :cover="false"
    @select="onSelectMenuItem"
  )
    span {{ adminContext.user.username }}
</template>

<script>
import { computed, inject } from 'vue'
import { useRouter } from 'vue-router'
import { DitoMenuButton } from '@ditojs/ui/src'
import { adminContextKey } from '../utils/keys.ts'
import { showSecurityDialog } from '../utils/security.js'

export default {
  components: { DitoMenuButton },

  props: {
    passkeys: { type: Boolean, default: false }
  },

  setup(props) {
    const adminContext = inject(adminContextKey)
    const router = useRouter()
    const settingsRoute = computed(
      () => adminContext.routeTree?.getViewRoute('accountSettings') ?? null
    )
    return {
      adminContext,
      items: computed(() =>
        [
          settingsRoute.value && { value: 'settings', label: 'Settings' },
          props.passkeys && { value: 'security', label: 'Security' },
          { value: 'logout', label: 'Logout' }
        ].filter(Boolean)
      ),

      onSelectMenuItem({ value }) {
        if (value === 'settings') {
          // Navigate to the path, which also opens the view's object form:
          router.push(router.resolve(settingsRoute.value).path)
        } else if (value === 'security') {
          showSecurityDialog(adminContext, { passkeys: props.passkeys })
        } else if (value === 'logout') {
          adminContext.session.logout()
        }
      }
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-account {
  display: flex;
  align-items: center;
  height: $header-height;

  // A button like the ones of the clipboard, which shows the user name as plain
  // text until its menu opens:
  & &__button {
    min-width: 0;
    min-height: $input-height;
    padding: $button-round-padding;
    border-radius: 2 * $border-radius;
    // Keep the name in place when the menu widens the button:
    justify-content: flex-start;
    font: inherit;
    line-height: 1em;

    span {
      padding: 0;
      color: inherit;
    }
  }

  .dito-menu-button:not(.dito-menu-button--open) &__button {
    &,
    &:hover,
    &:active,
    &:focus {
      border-color: transparent;
      color: $color-white;
      background: none;
      box-shadow: none;
    }

    &:focus-visible {
      @include focus-ring;
    }
  }
}
</style>
