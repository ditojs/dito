import ValidatorMixin from '../mixins/ValidatorMixin.js'
import { markRaw } from 'vue'
import { isPathWithin } from '../utils/route.js'
import { confirm } from '../utils/dialogs.js'

// @vue/component
export default {
  mixins: [ValidatorMixin],

  provide() {
    return {
      $routeComponent: () => this
    }
  },

  data() {
    return {
      // The record of the route that this component renders, see the
      // `matchedRouteRecord` watcher:
      routeRecord: null,
      // Whether leaving the route was prevented because the data is invalid,
      // so that the next attempt can leave, see `beforeRouteChange()`:
      hasPreventedLeavingInvalidData: false,
      // The pending confirmation to discard the unsaved changes, shared by the
      // navigations that happen while its dialog is open, e.g. through the
      // browser's back button, see `beforeRouteChange()`:
      discardConfirmation: null,
      // Each route-component defines a store that gets passed on to its
      // child components, so they can store values in them that live beyond
      // their life-cycle. See: DitoPane, SourceMixin
      store: {},
      // The responses of `request({ cache: 'local' })` of the components that
      // the route component renders, released with it, see `DitoMixin`.
      loadCache: {}
    }
  },

  computed: {
    routeComponent() {
      // Override DitoMixin's routeComponent() which uses the injected value.
      return this
    },

    routeLevel() {
      let level = 0
      let routeComponent = this
      while ((routeComponent = routeComponent.parentRouteComponent)) {
        level++
      }
      return level
    },

    // The record that the current route matches at this component's level,
    // which is another record or `undefined` while the component is being left,
    // until it's unmounted, see `routeRecord`.
    matchedRouteRecord() {
      return this.$route.matched[this.routeLevel]
    },

    // Whether the current route doesn't match the component's record anymore,
    // so that the component is about to be unmounted.
    isLeavingRoute() {
      return this.matchedRouteRecord?.path !== this.routeRecord?.path
    },

    isLastRoute() {
      // Returns true when this router component is the last one in the route.
      const { matched } = this.$route
      return this.routeRecord === matched[matched.length - 1]
    },

    isLastUnnestedRoute() {
      // Returns true if this route component is the last one in the route that
      // needs its own router-view (= is not nested).
      const { matched } = this.$route
      for (let i = matched.length - 1; i >= 0; i--) {
        const record = matched[i]
        if (!record.meta.nested) {
          return this.routeRecord === record
        }
      }
      return false
    },

    isNestedRoute() {
      return this.meta.nested
    },

    isForm() {
      return false
    },

    isView() {
      return false
    },

    meta() {
      return this.routeRecord?.meta
    },

    path() {
      return this.getRoutePath(this.routeRecord?.path)
    },

    label() {
      return this.getLabel(this.schema)
    },

    breadcrumb() {
      const { breadcrumb } = this.schema || {}
      return breadcrumb || `${this.breadcrumbPrefix} ${this.label}`
    },

    breadcrumbPrefix() {
      return ''
    },

    param() {
      // Workaround for vue-router not being able to map multiple url parameters
      // with the same name to multiple components, see:
      // https://github.com/vuejs/vue-router/issues/1345
      return this.$route.params[this.meta?.param] || null
    },

    // @overridable, see DitoForm
    isMutating() {
      return false
    },

    // Whether the component has changes that get lost when it's left, see
    // `beforeRouteChange()` and `DitoRoot`. Directly mutating forms aren't
    // dirty, as their parent's data keeps the changes, see `DitoForm.isDirty`.
    hasUnsavedChanges() {
      return this.isDirty
    }
  },

  watch: {
    matchedRouteRecord: {
      immediate: true,
      // Update synchronously, so that the record changes with the route.
      flush: 'sync',
      handler(routeRecord) {
        // Components belong to the record that they're rendered for, see
        // `DitoRouterView`. Records of other paths, or none, mean that
        // the component is being left, and it keeps its record until it's
        // unmounted, as its schema and meta are still read in the meantime,
        // e.g. by the watchers of its data model. Records of the same path
        // replace it, e.g. when the routes are set up again.
        const isOwnRouteRecord = (
          !!routeRecord &&
          (!this.routeRecord || routeRecord.path === this.routeRecord.path)
        )
        if (isOwnRouteRecord) {
          // Keep the record raw, as it's compared with the records in
          // `$route.matched`, which aren't reactive.
          this.routeRecord = markRaw(routeRecord)
        }
      }
    }
  },

  // NOTE: vue-router binds the guards to the record's instance only when it
  // calls them, after the previous guards, which may have unmounted it in the
  // meantime. There's nothing left to guard then.
  beforeRouteUpdate(to, from) {
    return this ? this.beforeRouteChange(to, from) : true
  },

  beforeRouteLeave(to, from) {
    return this ? this.beforeRouteChange(to, from) : true
  },

  created() {
    // Register in the shared route components by route level, for DitoTrail to
    // render the labels. Can't rely on `$route.matched[i].instances.default`
    // unfortunately, as instances aren't immediately ready, and `instances` is
    // not reactive. Components of new routes replace the ones of the previous
    // routes at their level, which are unmounted after, see `unmounted()`.
    this.appState.routeComponents[this.routeLevel] = this
  },

  unmounted() {
    const { routeComponents } = this.appState
    if (routeComponents[this.routeLevel] === this) {
      // Also drop the deeper levels, which aren't replaced by those of a new
      // route either, as their components are unmounted before their parents.
      routeComponents.length = this.routeLevel
    }
  },

  methods: {
    async beforeRouteChange(to, from) {
      let ok = true
      const isClosing = (
        // Only handle this route change if the form is actually mapped to the
        // `from` route, but include parent forms of closing nested forms as
        // well, by matching the from/to paths against `this.path`. Hash changes
        // only (= tab changes) and nested forms that open stay within it, while
        // other items, e.g. `/items/12` for `/items/1`, are outside of it.
        isPathWithin(from.path, this.path) &&
        !isPathWithin(to.path, this.path)
      )
      if (isClosing) {
        if (this.isMutating) {
          // Directly mutating (nested) forms validate their data once, which
          // includes the fields that aren't mounted, e.g. in collapsed
          // schemas. If the user then still wants to leave them, they can
          // click close / navigate away again.
          ok = this.hasPreventedLeavingInvalidData || this.validateAll()
          this.hasPreventedLeavingInvalidData = !ok
        } else {
          // The form or view doesn't directly mutate data. If it has unsaved
          // changes, ask if the user wants to persist the data first.
          if (this.hasUnsavedChanges) {
            this.discardConfirmation ??= confirm(this, {
              message: (
                'You have unsaved changes. ' +
                `Do you really want to ${this.verbs.cancel}?`
              ),
              verb: 'discard'
            }).finally(() => {
              this.discardConfirmation = null
            })
            ok = await this.discardConfirmation
          }
        }
      }
      return ok
    },

    getRoutePath(recordPath) {
      // Maps the route's actual path to the matched routes by counting its
      // parts separated by '/', splitting the path into the mapped parts
      // containing actual parameters.
      const { path } = this.$route
      return recordPath
        ? path
            .split('/')
            .slice(0, recordPath.split('/').length)
            .join('/')
        : path
    },

    getChildPath(path) {
      return `${this.path}/${path}`
    }
  }
}
