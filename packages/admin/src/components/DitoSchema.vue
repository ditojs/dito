<template lang="pug">
slot(name="before")
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
    :to="headerTeleport"
    :disabled="!headerTeleport"
  )
    .dito-schema-header(
      v-if="active"
    )
      DitoLabel(
        v-if="hasLabel"
        :label="label"
        :dataPath="dataPath"
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
          v-model="selectedTab"
          :tabs="tabs"
        )
      DitoClipboard(
        v-if="clipboard"
        :clipboard="clipboard"
        :schema="schema"
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
          //- TODO: Switch to v-if instead of v-show, once validation is
          //- decoupled from components.
          DitoPane.dito-pane__tab(
            v-show="selectedTab === tab"
            ref="tabs"
            :tab="tab"
            :schema="tabSchema"
            :dataPath="dataPath"
            :data="data"
            :meta="meta"
            :store="store"
            :padding="padding"
            :single="!inlined && !hasMainPane"
            :disabled="disabled"
            :generateLabels="generateLabels"
            :accumulatedBasis="accumulatedBasis"
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
        :single="!inlined && !hasTabs"
        :disabled="disabled"
        :generateLabels="generateLabels"
        :accumulatedBasis="accumulatedBasis"
      )
      slot(
        v-if="!inlined && isPopulated"
        name="buttons"
      )
  slot(
    v-if="inlined && !hasHeader"
    name="edit-buttons"
  )
slot(name="after")
</template>

<script>
import {
  isObject,
  isArray,
  isFunction,
  isRegExp,
  equals,
  parseDataPath,
  normalizeDataPath,
  labelize
} from '@ditojs/utils'
import { TransitionHeight } from '@ditojs/ui/src'
import DitoComponent from '../DitoComponent.js'
import ContextMixin from '../mixins/ContextMixin.js'
import ItemMixin from '../mixins/ItemMixin.js'
import { appendDataPath } from '../utils/data.js'
import {
  getNamedSchemas,
  getPanelEntries,
  setDefaultValues,
  processData,
  isEmptySchema,
  isNested
} from '../utils/schema.js'
import { getSchemaAccessor, getStoreAccessor } from '../utils/accessor.js'

// @vue/component
export default DitoComponent.component('DitoSchema', {
  mixins: [ContextMixin, ItemMixin],
  components: { TransitionHeight },
  inheritAttrs: false,

  provide() {
    return {
      $schemaComponent: () => this
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
    padding: { type: String, default: null },
    active: { type: Boolean, default: true },
    inlined: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    collapsed: { type: Boolean, default: false },
    collapsible: { type: Boolean, default: false },
    scrollable: { type: Boolean, default: false },
    hasOwnData: { type: Boolean, default: false },
    generateLabels: { type: Boolean, default: false },
    labelNode: { type: HTMLElement, default: null },
    accumulatedBasis: { type: Number, default: 1 }
  },

  data() {
    const { data } = this.schema
    return {
      // Allow schema to provide more data through `schema.data`, vue-style:
      ...(
        data && isFunction(data)
          ? data(this.context)
          : data
      ),
      selectedTab: null,
      componentsRegistry: {},
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
      return getPanelEntries(this.schema.panels, this.dataPath)
    },

    tabs() {
      return getNamedSchemas(this.schema.tabs)
    },

    defaultTab() {
      let first = null
      if (this.tabs) {
        const tabs = Object.values(this.tabs).filter(this.shouldRenderSchema)
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

    headerTeleport() {
      return this.isTopLevelSchema
        ? '.dito-header__teleport'
        : this.labelNode
    },

    // @override
    processedData() {
      // TODO: Fix side-effects
      // eslint-disable-next-line vue/no-side-effects-in-computed-properties
      return this.processData({ target: 'server', schemaOnly: true })
    },

    clipboardData: {
      get() {
        // TODO: Fix side-effects
        // eslint-disable-next-line vue/no-side-effects-in-computed-properties
        return this.processData({ target: 'clipboard', schemaOnly: true })
      },

      set(data) {
        this.setData(data)
      }
    },

    clipboardItem() {
      return this.clipboardData
    },

    formLabel() {
      return this.getLabel(
        this.getItemFormSchema(this.sourceSchema, this.data, this.context)
      )
    },

    isNested() {
      return isNested(this.schema)
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
      return !this.isNested && !this.inlined
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
      handler(routeTab) {
        // Remember the current path to know if tab changes should still be
        // handled, but remove the trailing `/create` or `/:id` from it so that
        // tabs informs that stay open after creation still work.
        if (this.hasTopLevelTabs) {
          this.selectedTab = routeTab
        }
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
      if (this.hasTopLevelTabs) {
        const tab = this.shouldRenderSchema(this.tabs[newTab])
          ? newTab
          : this.defaultTab
        this.$router.replace({ hash: tab ? `#${tab}` : null })
      }
      if (this.hasErrors) {
        this.repositionErrors()
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
    this.selectedTab = this.routeTab || this.defaultTab
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

    onOpen(open) {
      this.emitEvent('open', { context: { open } })
      // Prevent closing the schema with invalid data, since the in-component
      // validation will not be executed once it's closed.

      // TODO: Move validation out of components, to schema, just like
      // processing, and use `showValidationErrors()` for the resulting errors,
      // then remove this requirement, since we can validate closed forms and
      // schemas then.
      if (!this.opened || open || this.validateAll()) {
        this.opened = open
      }
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

    repositionErrors() {
      // Fire a fake scroll event to force the repositioning of error tooltips,
      // as otherwise they sometimes don't show up in the right place initially
      // when changing tabs.
      const scrollContainer = this.$refs.content.closest('.dito-scroll')
      const dispatch = () => scrollContainer.dispatchEvent(new Event('scroll'))
      dispatch()
      // This is required to handle `&--label-vertical` based layout changes.
      setTimeout(dispatch, 0)
    },

    focus() {
      this.opened = true
      return this.parentSchemaComponent?.focus()
    },

    validateAll(match, notify = true) {
      const { componentsByDataPath } = this
      let dataPaths
      if (match) {
        const check = isFunction(match)
          ? match
          : isRegExp(match)
            ? field => match.test(field)
            : null
        dataPaths = check
          ? Object.keys(componentsByDataPath).filter(check)
          : isArray(match)
            ? match
            : [match]
      }
      if (notify) {
        this.clearErrors()
      }
      let isValid = true
      let first = true
      dataPaths ||= Object.keys(componentsByDataPath)
      for (const dataPath of dataPaths) {
        const components = this.getComponentsByDataPath(dataPath)
        for (const component of components) {
          if (!component.validate(notify)) {
            // Focus first error field
            if (notify && first) {
              component.scrollIntoView()
            }
            first = false
            isValid = false
          }
        }
      }
      if (notify && !isValid) {
        this.notifyErrors()
      }
      return isValid
    },

    verifyAll(match) {
      return this.validateAll(match, false)
    },

    async showValidationErrors(errors, focus, first = true) {
      this.clearErrors()
      const unmatched = []
      const wasFirst = first
      for (const [dataPath, errs] of Object.entries(errors)) {
        // If the schema is a data-root, prefix its own dataPath to all errors,
        // since the data that it sends and validates will be unprefixed.
        const fullDataPath = this.hasOwnData
          ? appendDataPath(this.dataPath, dataPath)
          : dataPath
        // console.log(this, this.dataPath, this.hasOwnData, fullDataPath)
        // Convert from JavaScript property access notation, to our own form
        // of relative JSON pointers as data-paths:
        const dataPathParts = parseDataPath(fullDataPath)
        let found = false
        const components = this.getComponentsByDataPath(dataPathParts)
        for (const component of components) {
          if (component.showValidationErrors(errs, first && focus)) {
            found = true
            first = false
            break
          }
        }
        if (!found) {
          // Couldn't find a component in an active form for the given dataPath.
          // See if we can find a component serving a part of the dataPath,
          // and take it from there:
          const property = dataPathParts.pop()
          while (dataPathParts.length > 0) {
            const components = this.getComponentsByDataPath(dataPathParts)
            for (const component of components) {
              const navigated = await component.navigateToComponent?.(
                fullDataPath,
                subComponents => {
                  let found = false
                  for (const component of subComponents) {
                    const matched = Object.fromEntries(
                      Object.entries(errors).filter(
                        ([dataPath]) =>
                          normalizeDataPath(dataPath).startsWith(
                            component.dataPath
                          )
                      )
                    )
                    if (
                      Object.keys(matched).length > 0 &&
                      component.showValidationErrors(matched, first && focus)
                    ) {
                      found = true
                      first = false
                      break
                    }
                  }
                  return found
                }
              )
              if (navigated) {
                // Found a nested form to display at least parts fo the errors.
                // We can't show all errors at once, so we're done. Don't call
                // `notifyErrors()` yet, as we can only display it once
                // `showValidationErrors()` was called from `DitoForm.mounted()`
                return
              }
            }
            // Still here, so keep removing the last part until we find a match.
            dataPathParts.pop()
          }
          // When the error can't be matched, add it to a list of unmatched
          // errors with decent message, to report at the end.
          const field = labelize(property)
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
      // `setDefaultValues()`, as they are all reactive already from the starts:
      Object.assign(this.data, setDefaultValues(this.dataSchema, {}, this))
      this.clearErrors()
    },

    setData(data) {
      for (const name in data) {
        if (name in this.data) {
          // eslint-disable-next-line vue/no-mutating-props
          if (!equals(this.data[name], data[name])) {
            // eslint-disable-next-line vue/no-mutating-props
            this.data[name] = data[name]
            for (const component of this.getComponentsByName(name)) {
              component.markDirty()
            }
          }
        }
      }
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

    _registerComponent(component, add) {
      this._registerEntry(this.componentsRegistry, component, add)
      // Only register with the parent if schema shares data with it.
      this.parentSchemaComponent?._registerComponent(component, add)
    },

    _registerPane(pane, add) {
      this._registerEntry(this.panesRegistry, pane, add)
    },

    _registerPanel(panel, add) {
      this._registerEntry(this.panelsRegistry, panel, add)
    },

    _registerEntry(registry, entry, add) {
      const uid = entry.$uid
      if (add) {
        registry[uid] = entry
      } else {
        delete registry[uid]
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
      return entriesByDataPath[normalizeDataPath(dataPath)] || []
    },

    _getEntriesByName(entriesByDataPath, name) {
      return entriesByDataPath[appendDataPath(this.dataPath, name)] || []
    }
  }
})
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

  .dito-header & {
    // When teleported into main header.
    align-items: flex-end;
  }

  .dito-label & {
    // When teleported into container label.
    flex: 1;
  }

  > .dito-label {
    margin-bottom: 0;
  }

  > .dito-buttons {
    margin-left: var(--button-margin, 0);
  }
}
</style>
