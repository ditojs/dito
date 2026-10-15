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
import { computed, inject } from 'vue'
import { useRouter } from 'vue-router'
import { DitoMenuButton } from '@ditojs/ui/src'
import { adminContextKey } from '../utils/keys.ts'

export default {
  components: { DitoMenuButton },

  setup() {
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
          { value: 'logout', label: 'Logout' }
        ].filter(Boolean)
      ),

      onSelectMenuItem({ value }) {
        if (value === 'settings') {
          // Navigate to the path, which also opens the view's object form:
          router.push(router.resolve(settingsRoute.value).path)
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
