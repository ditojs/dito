<script>
import DitoComponent from '../DitoComponent.js'

// A component to simply pass through an existing vue vnode.
// See: https://forum.vuejs.org/t/28162/4

// @vue/component
export default DitoComponent.component('dito-vnode', {
  functional: true,
  render: (h, context) => context.props.node
})
</script>
