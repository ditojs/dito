import SchemaParentMixin from './SchemaParentMixin.js'
import { markRaw } from 'vue'
import { isPathWithin } from '../utils/route.js'
import { getSchemaPath } from '../utils/schema/structure.js'
import { confirm } from '../utils/dialogs.js'
import { ContainerContext } from '../utils/ContainerContext.ts'
import { RouteContext } from '../utils/RouteContext.ts'

// @vue/component
export default {
  mixins: [SchemaParentMixin],

  provide() {
    return {
      container: this.ownContainer,
      route: this.ownRoute
    }
  },

  data() {
    const container = new ContainerContext(this)
    return {
      ownContainer: markRaw(container),
      ownRoute: markRaw(
        new RouteContext(this, {
          parent: this.parentRoute,
          container,
          router: this.$router
        })
      ),
      // The record of the route that this component renders, see the
      // `$route` watcher:
      routeRecord: null,
      // The parameters of the route while its record is matched:
      routeParams: {},
      // Whether leaving the route was prevented because the data is invalid,
      // so that the next attempt can leave, see `beforeRouteChange()`:
      hasPreventedLeavingInvalidData: false,
      // The pending confirmation to discard the unsaved changes, shared by the
      // navigations that happen while its dialog is open, e.g. through the
      // browser's back button, see `beforeRouteChange()`:
      discardConfirmation: null,
      // Whether a navigation away from the route waits for its pending submits:
      isWaitingToLeave: false,
      // Each route-component defines a store that gets passed on to its
      // child components, so they can store values in them that live beyond
      // their life-cycle. See: DitoPane, SourceMixin
      store: {}
    }
  },

  computed: {
    // The record that the current route matches at this component's level,
    // which is another record or `undefined` while the component is being left,
    // until it's unmounted, see `routeRecord`.
    matchedRouteRecord() {
      return this.$route.matched[this.route.level]
    },

    // Whether the current route doesn't match the component's record anymore,
    // so that the component is about to be unmounted.
    isLeavingRoute() {
      return this.matchedRouteRecord?.path !== this.routeRecord?.path
    },

    isLastRoute() {
      // Returns true when this router component is the last one in the route.
      return this.routeRecord === this.$route.matched.at(-1)
    },

    isLastUnnestedRoute() {
      // Returns true if this route component is the last one in the route that
      // needs its own router-view (= is not nested).
      const record = this.$route.matched.findLast(
        record => !record.meta.node?.isNestedForm
      )
      return this.routeRecord === record
    },

    isNestedRoute() {
      return !!this.route.node.isNestedForm
    },

    isForm() {
      return false
    },

    isView() {
      return false
    },

    path() {
      const { routeRecord } = this
      // The routes are replaced when the views are resolved again, e.g. after
      // logging in, while the components of the previous ones still exist:
      return this.$router.hasRoute(routeRecord.name)
        ? this.$router.resolve({
            name: routeRecord.name,
            params: this.route.node.getParams(this.routeParams)
          }).path
        : this.$route.path
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
      return this.$route.params[this.route.node.param] || null
    },

    // @overridable, see DitoForm
    isMutating() {
      return false
    },

    // The path of the view or source, e.g. for selectors of its styles:
    schemaPath() {
      const { sourceSchema } = this
      return getSchemaPath(sourceSchema, sourceSchema.name, this.admin.api)
    },

    // Whether the component has changes that get lost when it's left, see
    // `beforeRouteChange()` and `DitoRoot`:
    isDirty() {
      return this.container.isDirty
    }
  },

  watch: {
    $route: {
      immediate: true,
      // Update synchronously, so that the record changes with the route.
      flush: 'sync',
      handler() {
        const routeRecord = this.matchedRouteRecord
        // Components belong to the record that they're rendered for, see
        // `DitoRouterView`. Records of other paths, or none, mean that
        // the component is being left, and it keeps its record until it's
        // unmounted, as its schema and node are still read in the meantime,
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
          this.routeParams = this.$route.params
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
    this.appState.routeComponents[this.route.level] = this
  },

  unmounted() {
    const { routeComponents } = this.appState
    const { level } = this.route
    if (routeComponents[level] === this) {
      // Also drop the deeper levels, which aren't replaced by those of a new
      // route either, as their components are unmounted before their parents.
      routeComponents.length = level
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
        // Write the edits that are held back, e.g. debounced markup edits:
        this.dataModel.writePendingValues()
        if (this.isMutating) {
          // Directly mutating (nested) forms validate their data once, which
          // includes the fields that aren't mounted, e.g. in collapsed
          // schemas. If the user then still wants to leave them, they can
          // click close / navigate away again.
          ok = this.hasPreventedLeavingInvalidData || this.validateAll()
          this.hasPreventedLeavingInvalidData = !ok
        } else {
          // The form or view doesn't directly mutate data. Its data stays
          // dirty while it's being submitted, so wait for the submits first,
          // and leave without asking once they succeeded:
          const { dataModel } = this
          if (dataModel.hasPendingSubmits) {
            this.isWaitingToLeave = true
            await dataModel.waitUntilSubmitted()
            this.isWaitingToLeave = false
          }
          // If it has unsaved changes, ask if the user wants to persist the
          // data first.
          if (this.isDirty) {
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

    // Navigate after a submit only while the route is within `path`, the
    // form's path when it started. If a navigation away waits for the submit,
    // we decide once it settled, as navigating now would cancel it:
    navigateWithin(path, navigate) {
      if (this.isWaitingToLeave) {
        const removeHook = this.$router.afterEach(() => {
          removeHook()
          this.navigateWithin(path, navigate)
        })
      } else if (isPathWithin(this.$route.path, path)) {
        navigate() // Not awaited, as leaving the form waits for its submits.
      }
    },

    validateAll(match, notify) {
      return this.mainSchemaComponent.validateAll(match, notify)
    },

    verifyAll(match) {
      return this.validateAll(match, false)
    },

    showValidationErrors(errors) {
      return this.mainSchemaComponent.showValidationErrors(errors)
    },

    // Clears the errors of the values of the route's data, which mutating
    // forms share with the data of their parent, see `DataModel.clearErrors()`.
    resetValidation() {
      this.dataModel.clearErrors(this.dataPath)
    }
  }
}
