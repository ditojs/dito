<script>
import { h as createElement, Transition } from 'vue'

// @vue/component
function TransitionHeight({ enabled }, { slots }) {
  return enabled
    ? createElement(Transition, props, slots)
    : slots.default()
}

TransitionHeight.props = {
  enabled: { type: Boolean, default: true }
}

export default TransitionHeight

const setStyle = (element, style) => Object.assign(element.style, style)

// Force repaint to make sure the animation is triggered correctly.
const forceRepaint = element => getComputedStyle(element).height

// Measure and animate in the same task, so no frame shows the element before
// it is measured, and the hooks can't run out of order:
const props = {
  name: 'dito-height',

  onEnter(element) {
    setStyle(element, { height: 'auto' })
    const { height } = getComputedStyle(element)
    setStyle(element, { height: 0 })
    forceRepaint(element)
    setStyle(element, { height })
  },

  onAfterEnter(element) {
    setStyle(element, { height: null })
  },

  onLeave(element) {
    const { height } = getComputedStyle(element)
    setStyle(element, { height })
    forceRepaint(element)
    setStyle(element, { height: 0 })
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

$duration: 0.15s;

.dito-height-enter-active,
.dito-height-leave-active {
  transition: height $duration $ease-out-quart;
  overflow: hidden;
}

.dito-height-enter-active {
  animation: dito-slide-enter $duration $ease-out-quart;
}

.dito-height-leave-active {
  animation: dito-slide-leave $duration $ease-out-quart;
}

.dito-height-enter-from,
.dito-height-leave-to {
  height: 0;
}
</style>
