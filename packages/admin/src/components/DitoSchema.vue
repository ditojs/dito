<template lang="pug">
slot(name="prepend")
.dito-schema(
  :class="{ 'dito-scroll-parent': scrollable, 'dito-schema--open': opened }"
  v-bind="$attrs"
)
  Teleport(
    v-if="isPopulated && panelEntries.length > 0"
    to=".dito-sidebar__teleport"
  )
    DitoPanels(
      v-if="active"
      :panels="panelEntries"
      :data="data"
      :meta="meta"
      :store="store"
      :disabled="disabled"
    )
  Teleport(
    v-if="hasHeader"
    to=".dito-header__teleport"
    :disabled="!isTopLevelSchema"
  )
    .dito-schema-header(
      v-if="active"
    )
      DitoLabel(
        v-if="hasLabel"
        :label="label"
        :info="info"
        :collapsible="collapsible"
        :collapsed="!opened"
        @open="onOpen"
      )
      Transition(
        v-if="tabs"
        name="dito-fade"
      )
        DitoTabs(
          v-if="opened"
          :modelValue="selectedTab"
          :tabs="renderedTabs"
          @update:modelValue="selectTab"
        )
      DitoClipboard(
        v-if="clipboard"
        :clipboard="clipboard"
        :schema="schema"
        :hasData="hasData"
        :getData="getDataForClipboard"
        @paste="setData"
      )
      slot(name="edit-buttons")
  TransitionHeight(:enabled="inlined")
    .dito-schema-content(
      v-if="opened"
      ref="content"
      :class="{ 'dito-scroll': scrollable }"
    )
      template(
        v-if="hasTabs"
      )
        template(
          v-for="(tabSchema, tab) in tabs"
          :key="tab"
        )
          //- TODO: Switch to v-if instead of v-show, now that the dirty state
          //- of forms is based on their data (views still use the dirty flags
          //- of their components). `navigateToComponent()` then needs to
          //- select the tab that displays the component.
          DitoPane.dito-pane__tab(
            v-show="isTabSelected(tab)"
            ref="tabs"
            :tab="tab"
            :schema="tabSchema"
            :dataPath="dataPath"
            :data="data"
            :meta="meta"
            :store="store"
            :padding="padding"
            :single="single && !inlined && !hasMainPane"
            :disabled="disabled"
            :compact="compact"
            :generateLabels="generateLabels"
          )
      DitoPane.dito-pane__main(
        v-if="hasMainPane"
        ref="components"
        :schema="schema"
        :dataPath="dataPath"
        :data="data"
        :meta="meta"
        :store="store"
        :padding="padding"
        :single="single && !inlined && !hasTabs"
        :disabled="disabled"
        :compact="compact"
        :generateLabels="generateLabels"
      )
      slot(
        v-if="!inlined && isPopulated"
        name="buttons"
      )
  slot(
    v-if="inlined && !hasHeader"
    name="edit-buttons"
  )
slot(name="append")
</template>

<script>
import {
  isObject,
  isArray,
  isFunction,
  equals,
  parseDataPath,
  normalizeDataPath,
  labelize
} from '@ditojs/utils'
import { TransitionHeight } from '@ditojs/ui/src'
import DitoComponent from '../DitoComponent.js'
import DitoContext from '../DitoContext.js'
import ContextMixin from '../mixins/ContextMixin.js'
import { appendDataPath } from '../utils/data.js'
import { isPanel } from '../utils/schema/structure.js'
import {
  getNamedSchemas,
  getPanelEntries,
  getItemFormSchema,
  isEmptySchema
} from '../utils/schema/lookup.js'
import { initializeData, processData } from '../utils/schema/data.js'
import {
  getDataValidationErrors,
  getMatchingValidationErrors
} from '../utils/schema/validation.js'
import { getSchemaAccessor, getStoreAccessor } from '../utils/accessor.js'

// @vue/component
export default DitoComponent.component('DitoSchema', {
  mixins: [ContextMixin],
  components: { TransitionHeight },
  inheritAttrs: false,

  provide() {
    return {
      $schemaComponent: () => this,
      // Inlined schemas share the width of their container, see
      // `DitoContainer.combinedBasis`, while all others take the full width,
      // e.g. panels in the sidebar.
      ...(!this.inlined && { $accumulatedBasis: () => 1 })
    }
  },

  inject: [
    '$schemaParentComponent'
  ],

  props: {
    schema: { type: Object, required: true },
    // `dataSchema` is only provided for panels, where the panel schema
    // is different from the data schema for panels without own data.
    dataSchema: { type: Object, default: props => props.schema },
    dataPath: { type: String, default: '' },
    data: { type: Object, default: null },
    meta: { type: Object, default: () => ({}) },
    store: { type: Object, default: () => ({}) },
    label: { type: [String, Object], default: null },
    info: { type: String, default: null },
    single: { type: Boolean, default: false },
    padding: { type: String, default: null },
    active: { type: Boolean, default: true },
    inlined: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    compact: { type: Boolean, default: false },
    collapsed: { type: Boolean, default: false },
    collapsible: { type: Boolean, default: false },
    scrollable: { type: Boolean, default: false },
    hasOwnData: { type: Boolean, default: false },
    generateLabels: { type: Boolean, default: false }
  },

  data() {
    const { data } = this.schema
    return {
      // Allow schema to provide more data through `schema.data`, vue-style.
      // `data()` runs before the computed properties are set up, so create the
      // context here rather than using the `context` computed property:
      ...(
        data && isFunction(data)
          ? data(new DitoContext(this, { nested: false }))
          : data
      ),
      selectedTab: null,
      // Whether the selected tab still follows `defaultTab`, until the route
      // or the user select a tab, or until the data that `defaultTab()` and
      // the tabs' `if` are evaluated with is there, see `selectDefaultTab()`.
      shouldFollowDefaultTab: true,
      componentsRegistry: {},
      unnestedComponentsRegistry: {},
      panesRegistry: {},
      panelsRegistry: {},
      scrollPositions: {}
    }
  },

  computed: {
    nested() {
      // For `ContextMixin`:
      return false
    },

    schemaComponent() {
      // Override DitoMixin's schemaComponent() which uses the injected value.
      return this
    },

    parentSchemaComponent() {
      // Don't return the actual parent schema is this schema handles its own
      // data. This prevents delegating events to the parent, and registering
      // components with the parent that would cause it to set isDirty flags.
      return this.hasOwnData ? null : this.parentComponent.schemaComponent
    },

    panelEntries() {
      // Panels of schemas inlined in tabs are only shown with their tab, as
      // the panels of components in tabs, see `DitoContainer.panelEntries`.
      return getPanelEntries(
        this.schema.panels,
        this.dataPath,
        this.componentPath,
        this.tabComponent?.panelTab ?? null
      )
    },

    tabs() {
      return getNamedSchemas(this.schema.tabs)
    },

    renderedTabs() {
      // Evaluate the tabs' `if` with the schema's context, and only once there
      // is data to evaluate it with, as their components do too.
      return this.tabs && this.data
        ? Object.fromEntries(
            Object.entries(this.tabs).filter(([, tab]) =>
              this.shouldRenderSchema(tab)
            )
          )
        : this.tabs
    },

    defaultTab() {
      let first = null
      if (this.renderedTabs) {
        const tabs = Object.values(this.renderedTabs)
        for (const { name, defaultTab } of tabs) {
          if (isFunction(defaultTab) ? defaultTab(this.context) : defaultTab) {
            return name
          }
          first ??= name
        }
      }
      return first
    },

    routeTab() {
      return this.$route.hash?.slice(1) || null
    },

    clipboard() {
      return this.schema?.clipboard ?? null
    },

    hasHeader() {
      return this.hasLabel || this.hasTabs || !!this.clipboard
    },

    // @override
    processedData() {
      return this.processData({ target: 'server', schemaOnly: true })
    },

    formLabel() {
      return this.getLabel(
        getItemFormSchema(this.sourceSchema, this.data, this.context)
      )
    },

    isDirty() {
      return this.someComponent(it => it.isDirty)
    },

    isTouched() {
      return this.someComponent(it => it.isTouched)
    },

    isValid() {
      return this.everyComponent(it => it.isValid)
    },

    isValidated() {
      return this.everyComponent(it => it.isValidated)
    },

    hasErrors() {
      return this.someComponent(it => it.hasErrors)
    },

    hasData() {
      return !!this.data
    },

    hasLabel() {
      return !!this.label || this.collapsible
    },

    hasTabs() {
      return !!this.tabs
    },

    isTopLevelSchema() {
      // Panels are displayed in the sidebar, inlined schemas in their parents.
      return !isPanel(this.schema) && !this.inlined
    },

    hasTopLevelTabs() {
      return this.hasTabs && this.isTopLevelSchema
    },

    hasMainPane() {
      const { components } = this.schema
      return !!components && Object.keys(components).length > 0
    },

    opened: getStoreAccessor('opened', {
      default() {
        return !this.collapsed
      }
    }),

    components() {
      return Object.values(this.componentsRegistry)
    },

    unnestedComponents() {
      return Object.values(this.unnestedComponentsRegistry)
    },

    panes() {
      return Object.values(this.panesRegistry)
    },

    panels() {
      return Object.values(this.panelsRegistry)
    },

    componentsByDataPath() {
      return this._listEntriesByDataPath(this.componentsRegistry)
    },

    panesByDataPath() {
      return this._listEntriesByDataPath(this.panesRegistry)
    },

    panelsByDataPath() {
      return this._listEntriesByDataPath(this.panelsRegistry)
    },

    wide: getSchemaAccessor('wide', {
      type: Boolean,
      default: false
    })
  },

  watch: {
    schema: {
      immediate: true,
      handler(schema) {
        // For forms with type depending on loaded data, we need to wait for the
        // actual schema to become ready before setting up schema related things
        if (!isEmptySchema(schema)) {
          this.setupSchema()
        }
      }
    },

    routeTab: {
      immediate: true,
      // https://github.com/vuejs/vue-router/issues/3393#issuecomment-1158470149
      flush: 'post',
      handler() {
        this.followRouteTab()
      }
    },

    active(active) {
      // Returning from a nested form, e.g. through the browser's history, the
      // route may carry a different tab.
      if (active) {
        this.followRouteTab()
      }
    },

    hasData(hasData) {
      // `defaultTab()` and the tabs' `if` may depend on data that is only
      // available after mounting, e.g. the item of a form once it's loaded.
      if (hasData && this.shouldFollowDefaultTab) {
        this.selectDefaultTab()
      }
    },

    selectedTab(newTab, oldTab) {
      if (this.scrollable) {
        const { content } = this.$refs
        this.scrollPositions[oldTab] = content.scrollTop
        this.$nextTick(() => {
          content.scrollTop = this.scrollPositions[newTab] ?? 0
        })
      }
      // The route of a nested form doesn't belong to this schema.
      if (this.hasTopLevelTabs && this.active) {
        this.replaceRouteTab(newTab)
      }
    }
  },

  created() {
    this._register(true)
    if (this.scrollable && this.wide) {
      this.appState.pageClass = 'dito-page--wide'
    }
  },

  mounted() {
    if (this.routeTab) {
      this.selectTab(this.routeTab)
    } else {
      this.selectDefaultTab()
    }
  },

  unmounted() {
    this.emitEvent('destroy')
    this._register(false)
    if (this.scrollable && this.wide) {
      this.appState.pageClass = null
    }
  },

  methods: {
    setupSchema() {
      this.setupSchemaFields()
      // Delegate change events through to parent schema:
      this.delegate('change', this.parentSchemaComponent)
      this.emitEvent('initialize') // Not `'create'`, since that's for data.
    },

    getComponentsByDataPath(dataPath) {
      return this._getEntriesByDataPath(this.componentsByDataPath, dataPath)
    },

    getComponentByDataPath(dataPath) {
      return this.getComponentsByDataPath(dataPath)[0] || null
    },

    getComponentsByName(dataPath) {
      return this._getEntriesByName(this.componentsByDataPath, dataPath)
    },

    getComponentByName(name) {
      return this.getComponentsByName(name)[0] || null
    },

    getComponents(dataPathOrName) {
      return this._getEntries(this.componentsByDataPath, dataPathOrName)
    },

    getComponent(dataPathOrName) {
      return this.getComponents(dataPathOrName)[0] || null
    },

    getPanelsByDataPath(dataPath) {
      return this._getEntriesByDataPath(this.panelsByDataPath, dataPath)
    },

    getPanelByDataPath(dataPath) {
      return this.getPanelsByDataPath(dataPath)[0] || null
    },

    getPanels(dataPathOrName) {
      return this._getEntries(this.panelsByDataPath, dataPathOrName)
    },

    getPanel(dataPathOrName) {
      return this.getPanels(dataPathOrName)[0] || null
    },

    someComponent(callback) {
      return this.isPopulated && this.components.some(callback)
    },

    everyComponent(callback) {
      return this.isPopulated && this.components.every(callback)
    },

    // Selects the tab of the route's hash. The forms of nested routes, e.g. of
    // the items of lists in tabs, have their own hash for their own tabs, so
    // the tab is only followed while this schema's route is active, and a route
    // without a hash, e.g. after closing such a form, keeps the selected tab.
    followRouteTab() {
      const { routeTab, selectedTab } = this
      if (
        this.hasTopLevelTabs &&
        this.active &&
        routeTab &&
        routeTab !== selectedTab
      ) {
        // Changes of the hash to the selected tab are the route following the
        // selection, see `selectedTab()`, not a selection by the route.
        this.selectTab(routeTab)
      }
    },

    // Puts the tab into the route's hash. Without a tab, the route is kept
    // without hash. Falls back to the default tab only for tabs that aren't
    // rendered.
    replaceRouteTab(tab) {
      const routeTab = !tab || tab in this.renderedTabs ? tab : this.defaultTab
      if (routeTab !== this.routeTab) {
        this.$router.replace({
          query: this.$route.query,
          hash: routeTab ? `#${routeTab}` : null
        })
      }
    },

    // Selects the tab chosen by the route or the user.
    selectTab(tab) {
      this.selectedTab = tab
      this.shouldFollowDefaultTab = false
    },

    // Selects `defaultTab`, and keeps following it until there is data, but
    // not after that, so that editing the data doesn't switch the tab.
    selectDefaultTab() {
      this.selectedTab = this.defaultTab
      this.shouldFollowDefaultTab = !this.hasData
    },

    isTabSelected(tab) {
      return this.selectedTab === tab
    },

    onOpen(open) {
      this.emitEvent('open', { context: { open } })
      this.opened = open
    },

    onChange() {
      this.emitEvent('change')
    },

    resetValidation() {
      for (const component of this.components) {
        component.resetValidation()
      }
    },

    clearErrors() {
      for (const component of this.components) {
        component.clearErrors()
      }
    },

    focus() {
      this.opened = true
      return this.parentSchemaComponent?.focus()
    },

    validateAll(match, notify = true) {
      // Validate the data, not the mounted components, so that fields in
      // collapsed schemas and closed nested forms are validated too.
      const dataValidationErrors = this.hasData
        ? getDataValidationErrors(this.schema, this.data, {
            dataPath: this.dataPath,
            component: this,
            rootData: this.rootData
          })
        : null
      const matchingValidationErrors = match
        ? getMatchingValidationErrors(dataValidationErrors, match)
        : dataValidationErrors
      if (notify) {
        if (matchingValidationErrors) {
          this._showValidationErrorsByFullDataPath(
            matchingValidationErrors,
            true,
            true
          ).catch(console.error)
        } else {
          this.clearErrors()
        }
      }
      return !matchingValidationErrors
    },

    verifyAll(match) {
      return this.validateAll(match, false)
    },

    async showValidationErrors(errors, focus, first = true) {
      // Convert the data paths from JavaScript property access notation to
      // our own form of relative JSON pointers. If the schema is a data-root,
      // prefix its own dataPath to all errors, since the data that it sends
      // and validates will be unprefixed.
      const errorsByFullDataPath = Object.fromEntries(
        Object.entries(errors).map(([dataPath, errs]) => [
          normalizeDataPath(
            this.hasOwnData
              ? appendDataPath(this.dataPath, dataPath)
              : dataPath
          ),
          errs
        ])
      )
      return this._showValidationErrorsByFullDataPath(
        errorsByFullDataPath,
        focus,
        first
      )
    },

    // Finds all components that display the value at `dataPath` and passes
    // them to `onComplete()`, revealing them first if needed: Collapsed
    // schemas open, and the nearest components that display a part of the
    // data path are asked to navigate to the rest, e.g. sections open and
    // sources open their inlined items or navigate to nested forms, see
    // `SourceMixin.navigateToComponent()`. Once components are found, the
    // other ones are only revealed in inlined schemas
    // (`shouldRevealInlinedOnly`), so that there's only one navigation to a
    // nested form. Returns `true` if components were found and `onComplete()`
    // accepted them.
    async navigateToComponent(
      dataPath,
      onComplete,
      { shouldRevealInlinedOnly = false } = {}
    ) {
      const { opened } = this
      if (!opened) {
        this.opened = true
        await this.$nextTick()
      }
      const acceptedComponents = []
      const completeWithComponents = components => {
        const isAccepted = onComplete?.(components) ?? true
        if (isAccepted) {
          acceptedComponents.push(...components)
        }
        return isAccepted
      }

      const navigateViaNestedComponents = async nestedComponents => {
        for (const nestedComponent of nestedComponents) {
          // Skip components that contain accepted components already.
          const componentPathPrefix = `${nestedComponent.componentPath}/`
          const hasAcceptedComponents = acceptedComponents.some(
            acceptedComponent =>
              acceptedComponent.componentPath.startsWith(componentPathPrefix)
          )
          if (!hasAcceptedComponents) {
            await nestedComponent.navigateToComponent?.(
              dataPath,
              completeWithComponents,
              {
                shouldRevealInlinedOnly: (
                  shouldRevealInlinedOnly || acceptedComponents.length > 0
                )
              }
            )
          }
        }
      }

      const displayingComponents = this.getComponentsByDataPath(dataPath)
      if (displayingComponents.length > 0) {
        completeWithComponents(displayingComponents)
      }
      // Walk up the data path and ask the nested components that display a
      // part of it to navigate to the rest of it:
      const dataPathParts = parseDataPath(dataPath)
      const schemaDataPathLength = parseDataPath(this.dataPath).length
      while (dataPathParts.length > schemaDataPathLength + 1) {
        dataPathParts.pop()
        await navigateViaNestedComponents(
          this.getComponentsByDataPath(dataPathParts)
        )
      }
      // Unnested components share the data path of the schema, so they
      // decide by schema whether they can navigate to the data path:
      await navigateViaNestedComponents(this.unnestedComponents)
      const hasFoundComponents = acceptedComponents.length > 0
      if (!hasFoundComponents) {
        this.opened = opened
      }
      return hasFoundComponents
    },

    // Shows `errorsByFullDataPath`, keyed by normalized data paths including
    // the schema's own data path, see `showValidationErrors()`. Errors are
    // shown on all components that display their data path, and the first one
    // in document order is focused.
    async _showValidationErrorsByFullDataPath(
      errorsByFullDataPath,
      focus,
      first
    ) {
      this.clearErrors()
      const unmatched = []
      const wasFirst = first
      for (const [dataPath, errs] of Object.entries(errorsByFullDataPath)) {
        let nestedForm = null
        const displayingComponents = []
        const hasFoundComponents = await this.navigateToComponent(
          dataPath,
          foundComponents => {
            for (const component of foundComponents) {
              if (component.isForm) {
                // A nested form was navigated to, display the errors that are
                // part of its data there.
                nestedForm = component
              } else {
                displayingComponents.push(component)
              }
            }
            return true
          }
        )
        // Focus the first component in document order, unless a nested form
        // displays the errors:
        sortInDocumentOrder(displayingComponents).forEach(
          (component, index) => {
            component.showValidationErrors(
              errs,
              first && focus && !nestedForm && index === 0
            )
          }
        )
        if (nestedForm) {
          const nestedFormErrors = Object.fromEntries(
            Object.entries(errorsByFullDataPath).filter(
              ([errorDataPath]) => (
                errorDataPath === nestedForm.dataPath ||
                errorDataPath.startsWith(`${nestedForm.dataPath}/`)
              )
            )
          )
          // The nested form notifies the errors itself, as it can't display
          // the remaining errors of this schema, so we're done here.
          return nestedForm.showValidationErrors(
            nestedFormErrors,
            first && focus
          )
        }
        if (!hasFoundComponents) {
          // When the error can't be matched, add it to a list of unmatched
          // errors with decent message, to report at the end.
          const field = labelize(parseDataPath(dataPath).pop())
          for (const err of errs) {
            const prefix = field
              ? `The field ${field}`
              : `The ${this.formLabel}`
            unmatched.push(`${prefix} ${err.message}`)
          }
        }
        first = false
      }
      if (wasFirst && !first) {
        this.notifyErrors(unmatched.join('\n'))
      }
      return !first
    },

    notifyErrors(message) {
      this.notify({
        type: 'error',
        title: 'Validation Errors',
        text: message || 'Please correct the highlighted errors.'
      })
    },

    resetData() {
      // We can't set `this.data = ...` because it's a property, but we can set
      // all known properties on it to the values returned by
      // `initializeData()`, as they are all reactive already from the starts:
      // eslint-disable-next-line vue/no-mutating-props
      Object.assign(this.data, initializeData(this.dataSchema, {}, this))
      this.clearErrors()
    },

    // Merges the values of `data` into the schema's data, and returns it.
    setData(data) {
      for (const name in data) {
        if (name in this.data) {
          if (!equals(this.data[name], data[name])) {
            // eslint-disable-next-line vue/no-mutating-props
            this.data[name] = data[name]
            for (const component of this.getComponentsByName(name)) {
              component.markDirty()
            }
          }
        }
      }
      return this.data
    },

    filterData(data) {
      // Filters out arrays and objects that are backed by data resources
      // themselves, as those are already taken care of through their own API
      // resource end-points and shouldn't be set.
      const localData = {}
      const foreignData = {}
      for (const [name, value] of Object.entries(data)) {
        if (isArray(value) || isObject(value)) {
          const components = this.getComponentsByName(name)
          if (components.some(component => component.providesData)) {
            foreignData[name] = value
            continue
          }
        }
        localData[name] = value
      }
      return { localData, foreignData }
    },

    // Called by `DitoClipboard` only when copying, as processing all data on
    // each change would be wasteful.
    getDataForClipboard() {
      return this.processData({ target: 'clipboard', schemaOnly: true })
    },

    processData({ target = 'clipboard', schemaOnly = true } = {}) {
      return processData(
        this.dataSchema,
        this.sourceSchema,
        this.data,
        this.dataPath,
        {
          // Needed for DitoContext handling inside `processData` and
          // `processSchemaData()`:
          rootData: this.rootData,
          component: this,
          schemaOnly,
          target
        }
      )
    },

    _register(add) {
      // `$schemaParentComponent()` is only set if one of the ancestors uses
      // the `SchemaParentMixin`:
      this.$schemaParentComponent()?._registerSchemaComponent(this, add)
    },

    _registerComponent(component, add, componentPath) {
      this._registerEntry(
        this.componentsRegistry,
        component,
        add,
        componentPath
      )
      // Only register with the parent if schema shares data with it.
      this.parentSchemaComponent?._registerComponent(
        component,
        add,
        componentPath
      )
    },

    _registerUnnestedComponent(component, add, componentPath) {
      // Unnested components are only registered with their own schema, as
      // they share its data path, see `navigateToComponent()`.
      this._registerEntry(
        this.unnestedComponentsRegistry,
        component,
        add,
        componentPath
      )
    },

    _registerPane(pane, add, componentPath) {
      this._registerEntry(this.panesRegistry, pane, add, componentPath)
    },

    _registerPanel(panel, add, componentPath) {
      this._registerEntry(this.panelsRegistry, panel, add, componentPath)
    },

    // Registries are keyed by component path. Component paths change when list
    // items move, and the entries then register again under their new path,
    // see `trackRegistration()`.
    _registerEntry(registry, entry, add, componentPath) {
      if (add) {
        registry[componentPath] = entry
      } else if (registry[componentPath] === entry) {
        // Unless another entry registered under the path already, e.g. when
        // list items swap places.
        delete registry[componentPath]
      }
    },

    _listEntriesByDataPath(registry) {
      return Object.values(registry).reduce((entriesByDataPath, entry) => {
        // Multiple entries can be linked to the same data-path, e.g. when
        // there are tabs. Link each data-path to an array of entries.
        const { dataPath } = entry
        const entries = (entriesByDataPath[dataPath] ||= [])
        entries.push(entry)
        return entriesByDataPath
      }, {})
    },

    _getEntries(entriesByDataPath, dataPath) {
      return normalizeDataPath(dataPath).startsWith(this.dataPath)
        ? this._getEntriesByDataPath(entriesByDataPath, dataPath)
        : this._getEntriesByName(entriesByDataPath, dataPath)
    },

    _getEntriesByDataPath(entriesByDataPath, dataPath) {
      return sortInDocumentOrder(
        entriesByDataPath[normalizeDataPath(dataPath)] || []
      )
    },

    _getEntriesByName(entriesByDataPath, name) {
      return sortInDocumentOrder(
        entriesByDataPath[appendDataPath(this.dataPath, name)] || []
      )
    }
  }
})

// Sorts components that display the same data, e.g. in different tabs, in the
// document order of their elements, which is the order of their schemas.
function sortInDocumentOrder(components) {
  return components.length > 1
    ? [...components].sort(compareByDocumentPosition)
    : components
}

function compareByDocumentPosition(component1, component2) {
  const node1 = component1.$el
  const node2 = component2.$el
  if (!node1 || !node2 || node1 === node2) {
    return 0
  }
  const position = node1.compareDocumentPosition(node2)
  return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-schema {
  box-sizing: border-box;

  > .dito-schema-header + .dito-schema-content > .dito-pane {
    margin-top: $form-spacing-half;
  }

  &:has(> .dito-schema-content + .dito-edit-buttons) {
    // Display the inlined edit buttons to the right of the schema:
    display: flex;
    flex-direction: row;
    align-items: stretch;

    > .dito-edit-buttons {
      flex: 1 0 0%;
      margin-left: $form-spacing;
    }
  }

  > .dito-schema-content {
    flex: 0 1 100%;
    max-width: 100%;
    // So that schema buttons can be sticky to the bottom.
    // NOTE: We also need grid for `TransitionHeight` to work well. Switching
    // to flex box here causes jumpy collapsing transitions.
    display: grid;
    grid-template-rows: min-content;
    grid-template-columns: 100%;

    > :only-child {
      grid-row-end: none;
    }
  }
}

.dito-schema-header {
  display: flex;
  justify-content: space-between;
  // Let nested labels with ellipsis shrink below their content width.
  min-width: 0;

  .dito-header & {
    // When teleported into main header.
    align-items: flex-end;
  }

  > .dito-label {
    margin-bottom: 0;
  }

  // TODO: BEM: Style an element class of this block, e.g. `&__buttons`.
  > .dito-buttons {
    margin-left: var(--button-margin, 0);
  }
}
</style>
