<template lang="pug">
slot(name="prepend")
.dito-schema(
  :class="{ 'dito-scroll-parent': scrollable, 'dito-schema--open': opened }"
  v-bind="$attrs"
)
  Teleport(
    v-if="container.hasData && panelEntries.length > 0"
    to=".dito-sidebar__teleport"
  )
    DitoPanels(
      v-if="active"
      :panels="panelEntries"
      :data="data"
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
        :getData="() => processData('clipboard')"
        @paste="pasteData"
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
          DitoPane.dito-pane__tab(
            v-if="shouldRenderTab(tab)"
            v-show="isTabSelected(tab)"
            ref="tabs"
            :tab="tab"
            :schema="tabSchema"
            :dataPath="dataPath"
            :data="data"
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
        :store="store"
        :padding="padding"
        :single="single && !inlined && !hasTabs"
        :disabled="disabled"
        :compact="compact"
        :generateLabels="generateLabels"
      )
      slot(
        v-if="!inlined && container.hasData"
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
  isFunction,
  isEmpty,
  parseDataPath,
  normalizeDataPath,
  labelize
} from '@ditojs/utils'
import { TransitionHeight } from '@ditojs/ui/src'
import DitoComponent from '../DitoComponent.js'
import ContextMixin from '../mixins/ContextMixin.js'
import { appendDataPath, getRelativeDataPath } from '../utils/data.js'
import { isPanel } from '../utils/schema/structure.js'
import {
  getNamedSchemas,
  getPanelEntries,
  getItemFormSchema,
  isEmptySchema
} from '../utils/schema/lookup.js'
import {
  processData,
  getComponentPathByDataPath
} from '../utils/schema/data.js'
import { fromClipboard } from '../utils/fromClipboard.ts'
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
    return {
      selectedTab: null,
      // The tabs that were selected or rendered to reveal their components,
      // which stay rendered, see `shouldRenderTab()`:
      mountedTabs: {},
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
      // components with the parent.
      return this.hasOwnData ? null : this.parentComponent.schemaComponent
    },

    // The schema of the source whose item the schema displays, as the
    // component that renders the schema tells:
    sourceSchema() {
      return this.$schemaParentComponent()?.sourceSchema ?? null
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

    formLabel() {
      return this.getLabel(
        getItemFormSchema(this.sourceSchema, this.data, this.context)
      )
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

    // The route's hash belongs to the tabs of the last route only. Forms that
    // remain active while their items' forms are open as nested routes keep
    // their selected tab.
    shouldFollowRouteTab() {
      return this.hasTopLevelTabs && this.route.isLastRoute
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

    shouldFollowRouteTab(shouldFollowRouteTab) {
      // Returning from a nested form, e.g. through the browser's history, the
      // route may carry a different tab.
      if (shouldFollowRouteTab) {
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
      if (newTab) {
        this.mountedTabs[newTab] = true
      }
      if (this.scrollable) {
        const { content } = this.$refs
        this.scrollPositions[oldTab] = content.scrollTop
        this.$nextTick(() => {
          content.scrollTop = this.scrollPositions[newTab] ?? 0
        })
      }
      // The route of a nested form doesn't belong to this schema.
      if (this.shouldFollowRouteTab) {
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
    // A schema mounted for a nested route, e.g. when reloading the form of an
    // item of a list in a tab, doesn't follow the route's tab, as it belongs to
    // the nested form, so it may not be one of this schema's tabs.
    const { routeTab, renderedTabs } = this
    if (this.shouldFollowRouteTab && routeTab && routeTab in renderedTabs) {
      this.selectTab(routeTab)
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
      this.setupEvents()
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

    // Selects the tab of the route's hash. The forms of nested routes, e.g. of
    // the items of lists in tabs, have their own hash for their own tabs, so
    // the tab is only followed while this schema's route is the last one, and
    // a route without a hash, e.g. after closing such a form, keeps the
    // selected tab.
    followRouteTab() {
      const { routeTab, selectedTab } = this
      if (this.shouldFollowRouteTab && routeTab && routeTab !== selectedTab) {
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

    // Tabs render once they're selected, and stay rendered:
    shouldRenderTab(tab) {
      return this.isTabSelected(tab) || !!this.mountedTabs[tab]
    },

    // The first tab that displays the value at `dataPath`, if any:
    getTabByDataPath(dataPath) {
      const { renderedTabs } = this
      if (renderedTabs) {
        const [tab] = parseDataPath(
          getComponentPathByDataPath(
            { tabs: renderedTabs },
            this.data,
            getRelativeDataPath(dataPath, this.dataPath),
            { services: this, rootData: this.rootData }
          )
        )
        if (tab in renderedTabs) {
          return tab
        }
      }
      return null
    },

    onOpen(open) {
      this.emitEvent('open', { context: { open } })
      this.opened = open
    },

    onChange() {
      this.emitEvent('change')
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
            services: this,
            rootData: this.rootData
          })
        : null
      const errors = match
        ? getMatchingValidationErrors(dataValidationErrors, match)
        : dataValidationErrors
      if (notify) {
        this.showErrors(errors ?? {}).catch(console.error)
      }
      return !errors
    },

    verifyAll(match) {
      return this.validateAll(match, false)
    },

    // Shows the errors of the server for the data that was sent, at `dataPath`:
    // the root data, the schema's own data, or e.g. the data of a list with its
    // own resource.
    showValidationErrors(
      errors,
      dataPath = this.hasOwnData ? this.dataPath : ''
    ) {
      // Convert the data paths from JavaScript property access notation to
      // our own form of relative JSON pointers, prefixed with the data path of
      // the sent data, which the server validates unprefixed.
      const errorsByFullDataPath = Object.fromEntries(
        Object.entries(errors).map(([path, errs]) => [
          normalizeDataPath(appendDataPath(dataPath, path)),
          errs
        ])
      )
      return this.showErrors(errorsByFullDataPath, { dataPath, server: true })
    },

    // Replaces the errors of validation, or of the `server`, within `dataPath`
    // with `errors`, keyed by full data paths, reveals them, and notifies them,
    // with the ones that no field displays.
    async showErrors(errors, {
      dataPath = this.dataPath,
      server = false
    } = {}) {
      const unmatchedErrors = this.dataModel.replaceErrors(errors, {
        dataPath,
        server
      })
      await this.revealErrors(
        Object.keys(errors).filter(dataPath => !unmatchedErrors?.[dataPath])
      )
      if (!isEmpty(errors)) {
        const messages = Object.entries(unmatchedErrors ?? {}).flatMap(
          ([dataPath, errs]) => {
            const field = labelize(parseDataPath(dataPath).pop())
            const prefix = field
              ? `The field ${field}`
              : `The ${this.formLabel}`
            return errs.map(({ message }) => `${prefix} ${message}`)
          }
        )
        this.admin.notify({
          type: 'error',
          title: 'Validation Errors',
          text: messages.join('\n') || 'Please correct the highlighted errors.'
        })
      }
    },

    // Reveals the fields with errors at `dataPaths`, opening collapsed schemas
    // on the way, and focuses the first one. If it's in the form of a nested
    // route, that form opens and reveals its own errors instead, which it takes
    // over from its item, see `DitoForm.revealErrors()`.
    async revealErrors(
      dataPaths = this.dataModel.getErrorDataPaths(this.dataPath)
    ) {
      const [firstDataPath] = dataPaths
      // Only the data of route components is part of routes, unlike the data
      // of dialogs and panels with their own data:
      const route =
        firstDataPath && this.container === this.route?.container
          ? this.route.getFormRoute(firstDataPath)
          : null
      if (route) {
        // The form may be open already, e.g. a nested form, which displays in
        // the form of its parent:
        const failure =
          this.$route.path !== route.path
            ? await this.$router.push({ path: route.path })
            : null
        if (!failure) {
          await this.$nextTick()
          const level = this.$route.matched.length - 1
          await this.appState.routeComponents[level].revealErrors()
        }
      } else {
        for (const dataPath of dataPaths) {
          const [component] = await this.revealComponents(dataPath)
          if (dataPath === firstDataPath) {
            await component?.focus()
          }
        }
      }
    },

    // Reveals the components that display the value at `dataPath`, opening this
    // schema, and asking the nested components that display a part of the data
    // path to reveal the rest, e.g. sections open and sources open their
    // inlined items. Returns the components in document order.
    async revealComponents(dataPath) {
      const { opened } = this
      // Render the tab that displays the value, without selecting it, as
      // focusing its components does:
      const tab = this.getTabByDataPath(dataPath)
      const shouldMountTab = !!tab && !this.mountedTabs[tab]
      if (shouldMountTab) {
        this.mountedTabs[tab] = true
      }
      if (!opened || shouldMountTab) {
        this.opened = true
        await this.$nextTick()
      }
      let components = this.getComponentsByDataPath(dataPath)
      // Ask the deepest nested components first, and the unnested ones last, as
      // they share the data path of the schema:
      const nestedComponents = []
      const dataPathParts = parseDataPath(dataPath)
      const schemaDataPathLength = parseDataPath(this.dataPath).length
      while (dataPathParts.length > schemaDataPathLength + 1) {
        dataPathParts.pop()
        nestedComponents.push(...this.getComponentsByDataPath(dataPathParts))
      }
      for (const component of [
        ...nestedComponents,
        ...this.unnestedComponents
      ]) {
        if (components.length > 0) break
        components = (await component.revealComponents?.(dataPath)) ?? []
      }
      if (components.length === 0) {
        this.opened = opened
      }
      return components
    },

    // Writes the data pasted through `DitoClipboard` into the schema's data,
    // as new items:
    pasteData(clipboardData) {
      const data = fromClipboard(this.dataSchema, clipboardData, {
        dataPath: this.dataPath,
        services: this,
        rootData: this.rootData
      })
      for (const [name, value] of Object.entries(data)) {
        if (name in this.data) {
          this.dataModel.set(this.data, name, value)
        }
      }
    },

    // Processes the schema's data for `target`, the 'server' or the
    // 'clipboard', see `SchemaGraph`.
    processData(target) {
      return processData(
        this.dataSchema,
        this.sourceSchema,
        this.data,
        this.dataPath,
        {
          // Needed for DitoContext handling inside `processData` and
          // `processSchemaData()`:
          rootData: this.rootData,
          services: this,
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
      // they share its data path, see `revealComponents()`.
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
