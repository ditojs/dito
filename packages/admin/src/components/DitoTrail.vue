<template lang="pug">
nav.dito-trail(aria-label="Breadcrumb")
  ul
    li(
      v-for="component in trail"
    )
      RouterLink(
        v-slot="{ href, navigate }"
        :to="getComponentRoute(component)"
        custom
      )
        a.dito-trail__link(
          :class="{ 'dito-trail__link--active': isCurrentComponent(component) }"
          :aria-current="isCurrentComponent(component) ? 'page' : null"
          :href="href"
          @click="navigate"
        )
          span.dito-trail__text(
            :class="{ 'dito-trail__text--dirty': component.isDirty }"
          )
            | {{ component.breadcrumb }}
  slot
</template>

<script>
import DitoComponent from '../DitoComponent.js'
import { getViewLinkPath } from '../utils/schema/lookup.js'

// @vue/component
export default DitoComponent.component('DitoTrail', {
  computed: {
    trail() {
      // The route components by route level. Leave out the components that are
      // being left, until they're unmounted.
      return this.appState.routeComponents.filter(
        component => !component.isLeavingRoute
      )
    }
  },

  methods: {
    getComponentRoute(component) {
      // `force` reloads the view even if it is already the current route.
      return {
        path: getViewLinkPath(component.schema, component.path),
        force: true
      }
    },

    isCurrentComponent(component) {
      return component.path === this.$route.path
    }
  }
})
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
