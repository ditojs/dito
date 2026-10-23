<script>
import { h, inject } from 'vue'
import { RouterView } from 'vue-router'
import { routeContextKey } from '../utils/keys.ts'
import DitoForm from './DitoForm.vue'

// Render the form that the components of the route claimed, or else the
// component of the route's record. Key them by their source or record, which
// their schema and data belong to, while they're reused when only their item
// changes:
// @vue/component
function DitoRouterView({ routeLevel }) {
  const claim = inject(routeContextKey, null)?.childClaim
  return claim
    ? h(DitoForm, { key: claim.key })
    : h(RouterView, null, {
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
