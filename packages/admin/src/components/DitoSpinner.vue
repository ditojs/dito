<template lang="pug">
.dito-spinner(
  v-show="loading"
  :style="{ '--color': color, '--size': size, '--margin': margin }"
)
  .dito-spinner__pulse.dito-spinner__pulse1
  .dito-spinner__pulse.dito-spinner__pulse2
  .dito-spinner__pulse.dito-spinner__pulse3
</template>

<script>
import DitoComponent from '../DitoComponent.js'

// @vue/component
export default DitoComponent.component('DitoSpinner', {
  props: {
    loading: {
      type: Boolean,
      default: true
    },
    color: {
      type: String,
      default: null
    },
    size: {
      type: String,
      default: null
    },
    margin: {
      type: String,
      default: null
    }
  }
})
</script>

<style lang="scss">
.dito-spinner {
  --color: #999999;
  --size: 8px;
  --margin: 2px;

  display: flex;
  align-items: center;

  &__pulse {
    display: inline-block;
    background: var(--color);
    width: var(--size);
    height: var(--size);
    margin: var(--margin);
    border-radius: 100%;
    animation: dito-spinner-pulse 0.75s cubic-bezier(0.2, 0.68, 0.18, 1.08) 0s
      infinite both;
  }

  &__pulse1 {
    animation-delay: 0.12s;
  }

  &__pulse2 {
    animation-delay: 0.24s;
  }

  &__pulse3 {
    animation-delay: 0.36s;
  }
}

@keyframes dito-spinner-pulse {
  0%,
  80% {
    transform: scale(1);
    opacity: 1;
  }

  45% {
    transform: scale(0.1);
    opacity: 0.7;
  }
}

@keyframes dito-spinner-pulse {
  0%,
  80% {
    transform: scale(1);
    opacity: 1;
  }

  45% {
    transform: scale(0.1);
    opacity: 0.7;
  }
}
</style>
