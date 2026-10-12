<template lang="pug">
nav.dito-trail(aria-label="Breadcrumb")
  ul
    li(
      v-for="route in trail"
    )
      RouterLink(
        v-slot="{ href, navigate }"
        :to="getRouteLocation(route)"
        custom
      )
        a.dito-trail__link(
          :class="{ 'dito-trail__link--active': isCurrentRoute(route) }"
          :aria-current="isCurrentRoute(route) ? 'page' : null"
          :href="href"
          @click="navigate"
        )
          span.dito-trail__text(
            :class="{ 'dito-trail__text--dirty': route.isDirty }"
          )
            | {{ route.breadcrumb }}
  slot
</template>

<script>
import { computed, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { adminContextKey } from '../utils/keys.ts'

export default {
  name: 'DitoTrail',

  setup() {
    const adminContext = inject(adminContextKey)
    const currentRoute = useRoute()
    const router = useRouter()
    return {
      // Leave out the routes that are being left, until they're unmounted.
      trail: computed(() =>
        adminContext.ui.routes.filter(route => !route.isLeaving)
      ),

      getRouteLocation(route) {
        // `force` reloads the current route too. Use paths over names, so the
        // router also matches default children, like the forms of objects:
        return {
          path: route.isForm
            ? route.path
            : router.resolve({ name: route.node.linkRouteName }).path,
          force: true
        }
      },

      isCurrentRoute(route) {
        return route.path === currentRoute.path
      }
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-trail {
  $self: &;

  display: flex;
  box-sizing: border-box;
  height: 3em;

  ul {
    display: flex;
  }

  li {
    white-space: nowrap;
  }

  &__link {
    position: relative;
    display: block;

    &:hover {
      #{$self}__text {
        color: $color-light;
      }
    }
  }

  &__text--dirty {
    &::after {
      content: '';
      display: inline-block;
      background-color: $color-white;
      width: 8px;
      height: 8px;
      margin: 2px;
      margin-left: 0.5em;
      border-radius: 100%;
    }
  }

  li:not(:last-child) &__link {
    $angle: 33deg;

    &::before,
    &::after {
      position: absolute;
      content: '';
      width: 1px;
      height: 0.75em;
      right: -0.25em;
      background: $color-white;
      opacity: 0.5;
    }

    &::before {
      top: 50%;
      transform: rotate($angle);
      transform-origin: top;
    }

    &::after {
      bottom: 50%;
      transform: rotate(-$angle);
      transform-origin: bottom;
    }
  }
}
</style>
