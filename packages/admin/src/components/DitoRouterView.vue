<script>
import { h, inject } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { routeContextKey } from '../utils/keys.ts'
import DitoForm from './DitoForm.vue'
import DitoFormEmbedded from './DitoFormEmbedded.vue'

// Render the form that the components of the route claimed, or else the
// component of the route's record. Key them by their source or record, which
// their schema and data belong to, while they're reused when only their item
// changes. Forms belong to the record at their level, if there is one, which
// their navigation guards are registered with:
// @vue/component
function DitoRouterView({ routeLevel }) {
  const claim = inject(routeContextKey, null)?.childClaim
  const form = claim
    ? h(claim.isEmbedded ? DitoFormEmbedded : DitoForm, { key: claim.key })
    : null
  return form && !useRoute().matched[routeLevel]
    ? form
    : h(RouterView, null, {
        default: ({ Component, route }) =>
          Component
            ? h(Component, { key: route.matched[routeLevel]?.path })
            : form
      })
}

DitoRouterView.props = {
  routeLevel: { type: Number, required: true }
}

export default DitoRouterView
</script>
