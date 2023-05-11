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

const nextTimeout = callback => setTimeout(callback, 0)

// Force repaint to make sure the animation is triggered correctly.
const forceRepaint = element => getComputedStyle(element).height

const props = {
  name: 'dito-height',

  onAfterEnter(element) {
    // A timeout before setting style is only really needed after calls to
    // `forceRepaint()`, but using one here too preserves execution sequence so
    // that the call from `enter()` can never outrun the one from `afterEnter()`
    nextTimeout(() => setStyle(element, { height: null }))
  },

  onEnter(element) {
    // For some reason we're getting two `onEnter()` calls per transition,
    // so we need to ignore the second one. This might be linked to the use
    // of `nextTimeout()`, which is required to get the correct value for
    // `height`, based on `&--label-vertical` calculations.
    const { width } = getComputedStyle(element)
    setStyle(element, {
      width,
      position: 'absolute',
      visibility: 'hidden',
      height: 'auto'
    })
    nextTimeout(() => {
      const { height } = getComputedStyle(element)
      setStyle(element, {
        width: null,
        position: null,
        visibility: null,
        height: 0
      })
      forceRepaint(element)
      nextTimeout(() => setStyle(element, { height }))
    })
  },

  onLeave(element) {
    const { height } = getComputedStyle(element)
    setStyle(element, { height })
    forceRepaint(element)
    nextTimeout(() => setStyle(element, { height: 0 }))
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
