<script>
import DitoComponent from '../DitoComponent.js'

// @vue/component
function DitoVNode({ vnode }) {
  return vnode
}

DitoVNode.props = {
  vnode: { type: Object, required: true }
}

export default DitoComponent.component('dito-vnode', DitoVNode)
</script>
