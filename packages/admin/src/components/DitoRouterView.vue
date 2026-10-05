<script>
import { h } from 'vue'
import { RouterView } from 'vue-router'
import DitoComponent from '../DitoComponent.js'

// Renders the route components of `routeLevel` through `RouterView`, keyed by
// their route record, so that each record gets its own component instance, as
// their schema and data belong to it, while the component is reused when only
// the parameters change, e.g. to edit another item.
// NOTE: This is a functional component, so that it doesn't become the parent
// component of the route components, see `DitoMixin.provide()`.
// @vue/component
function DitoRouterView({ routeLevel }) {
  return h(RouterView, null, {
    default: ({ Component, route }) =>
      Component
        ? h(Component, { key: route.matched[routeLevel]?.path })
        : null
  })
}

DitoRouterView.props = {
  routeLevel: { type: Number, required: true }
}

export default DitoComponent.component('DitoRouterView', DitoRouterView)
</script>
