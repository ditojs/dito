<template lang="pug">
.dito-trail
  ul
    li(
      v-for="component in trail"
    )
      a.dito-trail__link(
        :class="{ 'dito-trail__link--active': component.path === $route.path }"
        :href="getComponentHref(component)"
        @click.prevent.stop="onClickComponent(component)"
      )
        span.dito-trail__text(
          :class="{ 'dito-trail__text--dirty': component.isDirty }"
        )
          | {{ component.breadcrumb }}
  slot
</template>

<script>
import DitoComponent from '../DitoComponent.js'

// @vue/component
export default DitoComponent.component('DitoTrail', {
  computed: {
    trail() {
      return this.appState.routeComponents.filter(
        component => !!component.routeRecord
      )
    }
  },

  methods: {
    getComponentPath(component) {
      // Do the same as in `DitoMenu`: Link menu items to the first children.
      const { schema } = component
      return schema.type === 'menu'
        ? Object.values(schema.items)[0].fullPath
        : component.path
    },

    getComponentHref(component) {
      return this.$router.resolve(this.getComponentPath(component)).href
    },

    onClickComponent(component) {
      this.$router.push({
        path: this.getComponentPath(component),
        force: true
      })
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
