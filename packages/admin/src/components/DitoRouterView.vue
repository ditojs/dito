<script>
import { h } from 'vue'
import { RouterView } from 'vue-router'

// Key the route components by their record, which their schema and data belong
// to, while they're reused when only the parameters change:
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

export default DitoRouterView
</script>
