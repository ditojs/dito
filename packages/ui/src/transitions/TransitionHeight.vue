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
  render(createElement, context) {
    const data = {
      props: {
        name: 'height'
      },

      on: {
        afterEnter(element) {
          setStyle(element, { height: 'auto' })
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
    }

    return createElement('transition', data, context.children)
  }
}

function setStyle(element, style) {
  Object.assign(element.style, style)
}

function forceRepaint(element) {
  // Force repaint to make sure the animation is triggered correctly.
  // eslint-disable-next-line babel/no-unused-expressions
  getComputedStyle(element).height
}
</script>
