<template lang="pug">
.dito-account
  DitoMenuButton.dito-account__button(
    :items="items"
    placement="bottom-right"
    floating
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

  setup() {
    const adminContext = inject(adminContextKey)
    const router = useRouter()
    const settingsRoute = computed(
      () => adminContext.routeTree?.getViewRoute('accountSettings') ?? null
    )
    const { hasPasswordChange, hasPasskeys, hasTotp } =
      adminContext.authentication
    return {
      adminContext,
      items: computed(() =>
        [
          settingsRoute.value && { value: 'settings', label: 'Settings' },
          (hasPasswordChange || hasPasskeys || hasTotp) && {
            value: 'security',
            label: 'Security'
          },
          { value: 'logout', label: 'Sign Out' }
        ].filter(Boolean)
      ),

      onSelectMenuItem({ value }) {
        if (value === 'settings') {
          // Navigate to the path, which also opens the view's object form:
          router.push(router.resolve(settingsRoute.value).path)
        } else if (value === 'security') {
          showSecurityDialog(adminContext)
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

  // A button that shows the user name as plain text:
  & &__button {
    min-width: 0;
    min-height: $input-height;
    padding: $button-round-padding;
    border-radius: 2 * $border-radius;
    font: inherit;
    line-height: 1em;

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

    span {
      padding: 0;
      color: inherit;
    }
  }
}
</style>
