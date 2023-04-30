<template lang="pug">
slot(name="before")
.dito-schema(
  v-bind="$attrs"
)
  .dito-schema-content(
    ref="content"
    :class="{ 'dito-scroll': scrollable }"
  )
    Teleport(
      to=".dito-header__menu"
      :disabled="!headerInMenu"
    )
      .dito-schema-header(
        v-if="hasLabel || hasTabs || clipboard"
        :class="{ 'dito-schema-header--menu': headerInMenu }"
      )
        DitoLabel(
          v-if="hasLabel"
          :label="label"
          :dataPath="dataPath"
          :collapsible="collapsible"
          :collapsed="!opened"
          @expand="onExpand"
        )
          //- Pass edit-buttons through to dito-label's own edit-buttons slot:
          template(
            v-if="inlined"
            #edit-buttons
          )
            slot(name="edit-buttons")
        DitoTabs(
          v-if="tabs"
          :tabs="tabs"
          :selectedTab="selectedTab"
        )
        DitoClipboard(
          :clipboard="clipboard"
          :dataPath="dataPath"
          :data="data"
        )
    template(
      v-if="hasTabs"
    )
      DitoPane.dito-pane-tab(
        v-for="(tabSchema, tab) in tabs"
        ref="tabs"
        :key="tab"
        :visible="selectedTab === tab"
        :tab="tab"
        :schema="tabSchema"
        :dataPath="dataPath"
        :data="data"
        :meta="meta"
        :store="store"
        :single="!inlined && !hasMainPane"
        :disabled="disabled"
        :generateLabels="generateLabels"
      )
    TransitionHeight(:enabled="inlined")
      DitoPane.dito-pane-main(
        v-if="hasMainPane && opened"
        ref="components"
        :schema="schema"
        :dataPath="dataPath"
        :data="data"
        :meta="meta"
        :store="store"
        :single="!inlined && !hasTabs"
        :disabled="disabled"
        :generateLabels="generateLabels"
      )
    slot(
      v-if="!inlined && isPopulated"
      name="buttons"
    )
  template(
    v-if="inlined"
  )
    slot(
      v-if="!hasLabel"
      name="edit-buttons"
    )
  template(
    v-else-if="isPopulated"
  )
    DitoPanels(
      :class="{ 'dito-scroll': scrollable }"
      :panels="panelEntries"
      :data="data"
      :meta="meta"
      :store="store"
      :disabled="disabled"
    )
slot(name="after")
</template>

<script>
import {
  isObject,
  isArray,
  isFunction,
  isRegExp,
  parseDataPath,
  normalizeDataPath,
  labelize
} from '@ditojs/utils'
import { TransitionHeight } from '@ditojs/ui/src'
import DitoComponent from '../DitoComponent.js'
import ItemMixin from '../mixins/ItemMixin.js'
import { appendDataPath, getParentItem } from '../utils/data.js'
import {
  getNamedSchemas,
  getPanelEntries,
  setDefaultValues,
  processData
} from '../utils/schema.js'
import { getStoreAccessor } from '../utils/accessor.js'

// @vue/component
export default DitoComponent.component('DitoSchema', {
  mixins: [ItemMixin],
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
    dataPath: { type: String, default: '' },
    data: { type: Object, default: null },
    meta: { type: Object, default: () => ({}) },
    store: { type: Object, default: () => ({}) },
    label: { type: [String, Object], default: null },
    inlined: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    collapsed: { type: Boolean, default: false },
    collapsible: { type: Boolean, default: false },
    scrollable: { type: Boolean, default: false },
    hasOwnData: { type: Boolean, default: false },
    headerInMenu: { type: Boolean, default: false },
    generateLabels: { type: Boolean, default: false }
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
      currentTab: null,
      componentsRegistry: {},
      panesRegistry: {},
      panelsRegistry: {}
    }
  },

  computed: {
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
      const panelEntries = getPanelEntries(this.schema.panels, '')
      for (const pane of this.panes) {
        panelEntries.push(...pane.panelEntries)
      }
      return panelEntries
    },

    tabs() {
      return getNamedSchemas(this.schema.tabs)
    },

    selectedTab() {
      return this.currentTab || this.defaultTab?.name || null
    },

    defaultTab() {
      let first = null
      if (this.tabs) {
        for (const tab of Object.values(this.tabs)) {
          const { defaultTab } = tab
          if (
            isFunction(defaultTab)
              ? defaultTab(this.context)
              : defaultTab
          ) {
            return tab
          }
          if (!first) {
            first = tab
          }
        }
      }
      return first
    },

    clipboard() {
      return this.schema?.clipboard
    },

    parentData() {
      const data = getParentItem(this.rootData, this.dataPath, false)
      return data !== this.data ? data : null
    },

    processedData() {
      return this.processData({ target: 'server', schemaOnly: true })
    },

    clipboardData() {
      return {
        $schema: this.schema.name,
        ...this.processData({ target: 'clipboard', schemaOnly: true })
      }
    },

    // The following computed properties are similar to `DitoContext`
    // properties, so that we can access these on `this` as well:
    // NOTE: While internally, we speak of `data`, in the API surface the
    // term `item` is used for the data that relates to editing objects.
    // NOTE: This should always return the same as:
    // return getItem(this.rootData, this.dataPath, false)
    item() {
      return this.data
    },

    parentItem() {
      return this.parentData
    },

    rootItem() {
      return this.rootData
    },

    processedItem() {
      return this.processedData
    },

    clipboardItem() {
      return this.clipboardData
    },

    formLabel() {
      return this.getLabel(
        this.getItemFormSchema(this.sourceSchema, this.data, this.context)
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
      return !this.inlined && !!this.tabs
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
    }
  },

  watch: {
    '$route.hash': {
      immediate: true,
      handler(hash) {
        if (this.hasTabs) {
          this.currentTab = hash?.slice(1) || null
          if (this.hasErrors) {
            this.repositionErrors()
          }
        }
      }
    },

    'selectedTab'(selectedTab) {
      if (this.hasTabs) {
        let tab = null
        if (selectedTab !== this.currentTab) {
          // Any tab change needs to be reflected in the router also.
          tab = selectedTab
        } else if (!this.shouldRenderSchema(this.tabs[selectedTab])) {
          tab = this.defaultTab?.name
        }
        if (tab) {
          this.$router.replace({ hash: `#${tab}` })
        }
      }
    }
  },

  created() {
    this._register(true)
    this.setupSchemaFields()
    // Delegate change events through to parent schema:
    this.delegate('change', this.parentSchemaComponent)
    this.emitEvent('initialize') // Not `'create'`, since that's for data.
  },

  unmounted() {
    this.emitEvent('destroy')
    this._register(false)
  },

  methods: {
    getComponentsByDataPath(dataPath, match) {
      return this._getEntriesByDataPath(
        this.componentsByDataPath,
        dataPath,
        match
      )
    },

    getComponentByDataPath(dataPath, match) {
      return this.getComponentsByDataPath(dataPath, match)[0] || null
    },

    getComponentsByName(dataPath, match) {
      return this._getEntriesByName(this.componentsByDataPath, dataPath, match)
    },

    getComponentByName(name, match) {
      return this.getComponentsByName(name, match)[0] || null
    },

    getComponents(dataPathOrName, match) {
      return this._getEntries(this.componentsByDataPath, dataPathOrName, match)
    },

    getComponent(dataPathOrName, match) {
      return this.getComponents(dataPathOrName, match)[0] || null
    },

    getPanelsByDataPath(dataPath, match) {
      return this._getEntriesByDataPath(this.panelsByDataPath, dataPath, match)
    },

    getPanelByDataPath(dataPath, match) {
      return this.getPanelsByDataPath(dataPath, match)[0] || null
    },

    getPanels(dataPathOrName, match) {
      return this._getEntries(this.panelsByDataPath, dataPathOrName, match)
    },

    getPanel(dataPathOrName, match) {
      return this.getPanels(dataPathOrName, match)[0] || null
    },

    someComponent(callback) {
      return this.isPopulated && this.components.some(callback)
    },

    everyComponent(callback) {
      return this.isPopulated && this.components.every(callback)
    },

    onExpand(expand) {
      this.emitEvent('expand', {
        // TODO: Actually expose this on DitoContext?
        context: { expand }
      })
      // Prevent closing the schema with invalid data, since the in-component
      // validation will not be executed once it's closed.

      // TODO: Move validation out of components, to schema, just like
      // processing, and use `showValidationErrors()` for the resulting errors,
      // then remove this requirement, since we can validate closed forms and
      // schemas then.
      if (!this.opened || expand || this.validateAll()) {
        this.opened = expand
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
      // Force repositioning of error tooltips, as otherwise they
      // sometimes don't show up in the right place initially when
      // changing tabs
      const scrollParent = this.$refs.content.closest('.dito-scroll')
      scrollParent.scrollTop++
      scrollParent.scrollTop--
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

    async showValidationErrors(errors, focus) {
      this.clearErrors()
      let first = true
      const unmatched = []
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
              if (
                await component.navigateToComponent?.(
                  fullDataPath,
                  subComponents => {
                    let found = false
                    for (const component of subComponents) {
                      const errs = errors[component.dataPath]
                      if (
                        errs &&
                        component.showValidationErrors(errs, first && focus)
                      ) {
                        found = true
                        first = false
                      }
                    }
                    return found
                  }
                )
              ) {
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
      if (!first) {
        this.notifyErrors(unmatched.join('\n'))
      }
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
      Object.assign(this.data, setDefaultValues(this.schema, {}, this))
      this.clearErrors()
    },

    setData(data) {
      for (const name in data) {
        if (name in this.data) {
          // eslint-disable-next-line vue/no-mutating-props
          this.data[name] = data[name]
          for (const component of this.getComponentsByName(name)) {
            component.markDirty()
          }
        }
      }
    },

    filterData(data) {
      // Filters out arrays and objects that are back by data resources
      // themselves, as those are already taking care of through their own API
      // resource end-points and shouldn't be set.
      const copy = {}
      for (const [name, value] of Object.entries(data)) {
        if (isArray(value) || isObject(value)) {
          const components = this.getComponentsByName(name)
          if (components.some(component => component.providesData)) {
            continue
          }
        }
        copy[name] = value
      }
      return copy
    },

    processData({ target = 'clipboard', schemaOnly = true } = {}) {
      return processData(
        this.schema,
        this.sourceSchema,
        this.data,
        this.dataPath,
        {
          // Needed for DitoContext handling inside `processData` and
          // `processSchemaData()`:
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

    _getEntries(entriesByDataPath, dataPath, match) {
      return normalizeDataPath(dataPath).startsWith(this.dataPath)
        ? this._getEntriesByDataPath(entriesByDataPath, dataPath, match)
        : this._getEntriesByName(entriesByDataPath, dataPath, match)
    },

    _getEntriesByDataPath(entriesByDataPath, dataPath, match) {
      return this._filterEntries(
        entriesByDataPath[normalizeDataPath(dataPath)] || [],
        match
      )
    },

    _getEntriesByName(entriesByDataPath, name, match) {
      return this._filterEntries(
        entriesByDataPath[appendDataPath(this.dataPath, name)] || [],
        match
      )
    },

    _filterEntries(entries, match) {
      return match ? entries.filter(match) : entries
    }
  }
})
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-schema {
  box-sizing: border-box;
  // To display schema next to panels:
  display: flex;
  min-height: 100%;

  > .dito-schema-content {
    flex: 1 1 100%;
    // So that schema buttons can be sticky to the bottom:
    display: grid;
    grid-template-rows: min-content;

    > *:only-child {
      grid-row-end: none;
    }

    &.dito-scroll:has(.dito-pane:last-child)::after {
      // Eat up negative margin of the last child to prevent overscroll.
      content: '';
    }

    max-width: $content-width + 2 * $content-padding;
  }

  > .dito-buttons,
  > .dito-panels {
    flex: 1 1 0%;
  }

  > .dito-buttons {
    margin-left: $form-spacing;
  }

  > .dito-panels {
    padding: $content-padding $content-padding $content-padding 0;
  }

  // Display a ruler between tabbed components and towards the .dito-buttons
  .dito-pane-tab + .dito-pane-main {
    &::before {
      // Use a pseudo element to display a ruler with proper margins
      display: block;
      content: '';
      width: 100%;
      border-bottom: $border-style;
      // Add removed $form-spacing again to the ruler
      margin: $content-padding $form-spacing-half $form-spacing-half;
    }
  }

  .dito-pane-main + .dito-buttons-main {
    // Needed forms with sticky main buttons.
    margin-bottom: 0;
  }
}

.dito-schema-header {
  display: flex;
  justify-content: space-between;

  .dito-tabs,
  .dito-clipboard {
    display: flex;
    align-self: flex-end;
  }

  .dito-clipboard {
    &:only-child {
      margin-left: auto;
    }

    .dito-button {
      margin: 0 0 $tab-margin $tab-margin;
    }
  }

  &--menu {
    // Align the tabs on top of to the header menu.
    position: absolute;
    height: $header-height;
    padding: 0 $header-padding-hor;
    max-width: $content-width;
    top: 0;
    left: 0;
    right: 0;
    z-index: $header-z-index;
    // Turn off pointer events so that DitoTrail keeps receiving events...
    pointer-events: none;
    // ...but allow interaction with the tabs and buttons (e.g. clipboard)
    // layered on top of DitoTrail.
    .dito-tabs,
    .dito-buttons {
      pointer-events: auto;
      line-height: $header-line-height;
      font-size: $header-font-size;
    }
  }
}
</style>
