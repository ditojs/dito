<style lang="sass">
  $duration: 0.15s
  .height-enter-active,
  .height-leave-active
    transition: height $duration $easeOutQuart
    overflow: hidden
  .height-enter-active
    animation: slide-enter $duration $easeOutQuart
  .height-leave-active
    animation: slide-leave $duration $easeOutQuart
  .height-enter,
  .height-leave-to
    height: 0
</style>

<script>
export default {
  functional: true,

  props: {
    enabled: { type: Boolean, default: true }
  },

  render: (createElement, context) => createElement(
    'transition',
    context.props.enabled
      ? {
        props: { name: 'height' },
        on: events
      }
      : {},
    context.children
  )
}

const setStyle = (element, style) => Object.assign(element.style, style)

// Force repaint to make sure the animation is triggered correctly.
const forceRepaint = element => getComputedStyle(element).height

const events = {
  afterEnter(element) {
    // A timepout before setting style is only really needed after calls to
    // `forceRepaint()`, but using one here too preserves execution sequence so
    // that the call from `enter()` can never outrun the one from `afterEnter()`
    setTimeout(() => setStyle(element, { height: 'auto' }))
  },

  enter(element) {
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

  leave(element) {
    const { height } = getComputedStyle(element)
    setStyle(element, { height })
    forceRepaint(element)
    setTimeout(() => setStyle(element, { height: 0 }))
  }
}
</script>
