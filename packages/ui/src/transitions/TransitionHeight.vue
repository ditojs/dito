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

const props = {
  name: 'height',

  onAfterEnter(element) {
    // A timeout before setting style is only really needed after calls to
    // `forceRepaint()`, but using one here too preserves execution sequence so
    // that the call from `enter()` can never outrun the one from `afterEnter()`
    setTimeout(() => setStyle(element, { height: 'auto' }))
  },

  onEnter(element) {
    const { width } = getComputedStyle(element)
    setStyle(element, {
      width,
      position: 'absolute',
      visibility: 'hidden',
      height: 'auto'
    })
    const { height } = getComputedStyle(element)
    setStyle(element, {
      width: null,
      position: null,
      visibility: null,
      height: 0
    })
    forceRepaint(element)
    setTimeout(() => setStyle(element, { height }))
  },

  onLeave(element) {
    const { height } = getComputedStyle(element)
    setStyle(element, { height })
    forceRepaint(element)
    setTimeout(() => setStyle(element, { height: 0 }))
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

$duration: 0.15s;

.height-enter-active,
.height-leave-active {
  transition: height $duration $ease-out-quart;
  overflow: hidden;
}

.height-enter-active {
  animation: slide-enter $duration $ease-out-quart;
}

.height-leave-active {
  animation: slide-leave $duration $ease-out-quart;
}

.height-enter-from,
.height-leave-to {
  height: 0;
}
</style>
