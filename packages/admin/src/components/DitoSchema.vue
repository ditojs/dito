<template lang="pug">
  .dito-schema
    .dito-schema-content
      .dito-schema-header(
        v-if="label || tabs || clipboard"
        :class="{ 'dito-schema-menu-header': menuHeader }"
      )
        template(v-if="label")
          a.dito-label(
            tabindex="0"
            v-if="collapsible"
            @click.stop="opened = !opened"
          )
            .dito-chevron(:class="{ 'dito-opened': opened }")
            label {{ label }}
          .dito-label(v-else)
            label {{ label }}
        dito-tabs(
          v-if="tabs"
          :tabs="tabs"
          :selectedTab="selectedTab"
        )
        dito-clipboard(
          v-if="clipboard"
        )
      dito-components.dito-tab-components(
        v-if="!inlined"
        v-for="(schema, tab) in tabs"
        ref="tabs"
        :key="tab"
        :visible="selectedTab === tab"
        :tab="tab"
        :schema="schema"
        :dataPath="dataPath"
        :data="data"
        :meta="meta"
        :store="store"
        :disabled="disabled"
        :generateLabels="generateLabels"
      )
      transition-height
        dito-components.dito-main-components(
          v-if="schema.components"
          v-show="opened"
          ref="components"
          :schema="schema"
          :dataPath="dataPath"
          :data="data"
          :meta="meta"
          :store="store"
          :disabled="disabled"
          :generateLabels="generateLabels"
        )
      slot(
        name="buttons"
        v-if="!inlined && isPopulated"
      )
    dito-panels(
      v-if="!inlined && isPopulated && panelSchemas.length > 0"
      :panels="panelSchemas"
      :data="data"
      :meta="meta"
      :store="store"
      :disabled="disabled"
    )
</template>

<style lang="sass">
  $tab-height: $menu-font-size + 2 * $tab-padding-ver
  .dito-schema
    box-sizing: border-box
    // To dissplay schema next to panels:
    display: flex
    // To not vertically stretch .dito-schema-content to screen height:
    align-items: flex-start
    > .dito-schema-content
      flex: 1 1 100%
      max-width: $content-width
      padding: $content-padding
    .dito-panels
      flex: 1 1 0%
      padding: $content-padding $content-padding $content-padding 0
    // Display a ruler between tabbed components and towards the .dito-buttons
    .dito-tab-components + .dito-main-components,
    .dito-components + .dito-buttons-large
      &::before
        // Use a pseudo element to display a ruler with proper margins
        display: block
        content: ''
        width: 100%
        padding-top: $content-padding
        border-bottom: $border-style
    .dito-tab-components + .dito-main-components
      &::before
        // Add removed $form-spacing again to the ruler
        margin: $form-spacing-half
  .dito-schema-header
    display: flex
    box-sizing: border-box
    // turn off pointer events in background so that DitoTrail keeps working.
    pointer-events: none
    justify-content: space-between
    > *
      pointer-events: auto
    .dito-tabs,
    .dito-clipboard
      display: flex
      align-self: flex-end
    .dito-clipboard
      &:only-child
        margin-left: auto
      .dito-button
        margin: 0 0 $tab-margin $tab-margin
    &.dito-schema-menu-header
      // Bring the tabs up to the menu.
      position: absolute
      height: $tab-height
      margin-top: -$tab-height
      padding: 0 $menu-padding-hor
      max-width: $content-width + 2 * $content-padding
      top: 0
      left: 0
      right: 0
      z-index: $menu-z-index
      > *
        font-size: $menu-font-size
      .dito-tabs a
        line-height: $menu-line-height
    a.dito-label
      display: block
      width: 100%
      margin: 0
      &:hover,
      &:focus
        outline: none
        .dito-chevron
          color: $color-active
</style>

<script>
import DitoComponent from '@/DitoComponent'
import ItemMixin from '@/mixins/ItemMixin'
import { appendDataPath, getParentItem } from '@/utils/data'
import { getNamedSchemas, getPanelSchemas, setDefaults } from '@/utils/schema'
import {
  isObject, isArray, isFunction, isRegExp,
  parseDataPath, normalizeDataPath, labelize
} from '@ditojs/utils'
import { TransitionHeight } from '@ditojs/ui'

// @vue/component
export default DitoComponent.component('dito-schema', {
  components: { TransitionHeight },
  mixins: [ItemMixin],

  provide() {
    return {
      $schemaComponent: () => this
    }
  },

  inject: [
    '$schemaParentComponent'
  ],

  props: {
    schema: { type: Object, default: null },
    dataPath: { type: String, default: '' },
    data: { type: Object, default: null },
    meta: { type: Object, default: () => ({}) },
    store: { type: Object, default: () => ({}) },
    label: { type: String, default: null },
    disabled: { type: Boolean, default: false },
    collapsed: { type: Boolean, default: false },
    collapsible: { type: Boolean, default: false },
    generateLabels: { type: Boolean, default: true },
    hasOwnData: { type: Boolean, default: false },
    menuHeader: { type: Boolean, default: false }
  },

  data() {
    const { data } = this.schema
    return {
      // Allow schema to provide more data through `schema.data`, vue-style:
      ...(
        data && isFunction(data)
          ? data.call(this)
          : data
      ),
      opened: !this.collapsed,
      componentsContainers: {},
      components: {},
      panels: {},
      // Register dataProcessors separate from components, so they can survive
      // their life-cycles and be used at the end in `processData()`.
      dataProcessors: {},
      temporaryId: 0
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
      return this.hasOwnData ? null : this.$parent.schemaComponent
    },

    panelSchemas() {
      const schemas = getPanelSchemas(
        this.schema.panels,
        '',
        this.schemaComponent
      )
      for (const container of Object.values(this.componentsContainers)) {
        schemas.push(...container.panelSchemas)
      }
      return schemas
    },

    tabs() {
      return getNamedSchemas(this.schema.tabs)
    },

    selectedTab() {
      const { hash } = this.$route
      return hash?.substring(1) || this.defaultTab?.name || ''
    },

    defaultTab() {
      if (this.tabs) {
        let first = null
        for (const tab of Object.values(this.tabs)) {
          if (tab.defaultTab) {
            return tab
          }
          if (!first) {
            first = tab
          }
        }
        return first
      }
    },

    clipboard() {
      return this.schema?.clipboard
    },

    clipboardData() {
      return this.processData({
        removeIds: true
      })
    },

    // The following computed properties are similar to the fields returned by
    // getItemParams(), so that we can access these on `this` as well:
    item() {
      // NOTE: While internally, we speak of `data`, in the API surface the
      // term `item` is used for the data that relates to editing objects.
      // NOTE: This should always return the same as:
      // return getItem(this.rootData, this.dataPath, false)
      return this.data
    },

    parentItem() {
      return getParentItem(this.rootData, this.dataPath, false)
    },

    rootItem() {
      return this.rootData
    },

    processedItem() {
      return this.processData({ processIds: true })
    },

    formLabel() {
      return this.getLabel(this.getItemFormSchema(this.sourceSchema, this.data))
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

    inlined() {
      return false
    }
  },

  created() {
    this._register(true)
    this.setupSchemaFields()
    // Delegate change events through to parent schema:
    this.delegate('change', this.parentSchemaComponent)
  },

  destroyed() {
    this._register(false)
  },

  methods: {
    _register(add) {
      // `$schemaParentComponent()` is only set if one of the ancestors uses
      // the `SchemaParentMixin`:
      this.$schemaParentComponent()?._registerSchemaComponent(this, add)
    },

    _registerComponentsContainer(componentsContainer, add) {
      this._setOrDelete(
        this.componentsContainers,
        componentsContainer.tab || 'main',
        componentsContainer,
        add
      )
    },

    _registerComponent(component, add) {
      this._setOrDelete(this.components, component.dataPath, component, add)
      if (add) {
        // Register `dataProcessors` separate from their components, so they can
        // survive their life-cycles and be used at the end in `processData()`.
        this.$set(
          this.dataProcessors,
          component.dataPath,
          component.dataProcessor
        )
      } else {
        // NOTE: We don't remove the dataProcessors when de-registering!
        // They may still be required after the component itself is destroyed.
      }
      // Only register with the parent if schema shares data with it.
      this.parentSchemaComponent?._registerComponent(component, add)
    },

    _registerPanel(panel, add) {
      this._setOrDelete(this.panels, panel.dataPath, panel, add)
    },

    getComponent(dataPath) {
      return this._getWithDataPath(this.components, dataPath)
    },

    getPanel(dataPath) {
      return this._getWithDataPath(this.panels, dataPath)
    },

    _setOrDelete(registry, key, value, set) {
      if (set) {
        this.$set(registry, key, value)
      } else {
        this.$delete(registry, key)
      }
    },

    _getWithDataPath(registry, dataPath) {
      dataPath = normalizeDataPath(dataPath)
      // See if the argument starts with this form's data-path. If not, then it
      // is a key or sub data-path and needs to be prefixed with the full path:
      dataPath = dataPath.startsWith(this.dataPath)
        ? dataPath
        : appendDataPath(this.dataPath, dataPath)
      return registry[dataPath] || null
    },

    someComponent(callback) {
      return this.isPopulated && Object.values(this.components).some(callback)
    },

    everyComponent(callback) {
      return this.isPopulated && Object.values(this.components).every(callback)
    },

    onLoad() {
      this.emitEvent('load')
    },

    onChange() {
      this.emitEvent('change')
    },

    resetValidation() {
      for (const component of Object.values(this.components)) {
        component.resetValidation()
      }
    },

    clearErrors() {
      for (const component of Object.values(this.components)) {
        component.clearErrors()
      }
    },

    getErrors(dataPath) {
      return this.getComponent(dataPath)?.getErrors() || null
    },

    focus() {
      this.parentSchemaComponent?.focus()
      this.opened = true
    },

    validateAll(match, notify = true) {
      const { components } = this
      let dataPaths
      if (match) {
        const check = isFunction(match)
          ? match
          : isRegExp(match)
            ? field => match.test(field)
            : null
        dataPaths = check
          ? Object.keys(components).filter(check)
          : isArray(match)
            ? match
            : [match]
      }
      if (notify) {
        this.clearErrors()
      }
      let isValid = true
      let first = true
      for (const dataPath of (dataPaths || Object.keys(components))) {
        const component = components[dataPath]
        if (component) {
          if (!component.validate(notify)) {
            // Focus first error field
            if (notify && first) {
              component.focus()
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

    showValidationErrors(errors, focus) {
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
        const component = this.getComponent(dataPathParts)
        if (!component?.showValidationErrors(errs, first && focus)) {
          // Couldn't find a component in an active form for the given dataPath.
          // See if we can find a component serving a part of the dataPath,
          // and take it from there:
          const property = dataPathParts.pop()
          while (dataPathParts.length > 0) {
            const component = this.getComponent(dataPathParts)
            if (component?.navigateToComponent?.(fullDataPath, routeRecord => {
              // Filter the errors to only contain those that belong to the
              // matched dataPath:
              const normalizedPath = normalizeDataPath(dataPathParts)
              // Pass on the errors to the instance through the meta object,
              // see DitoForm.created()
              routeRecord.meta.errors = Object.entries(errors).reduce(
                (filtered, [dataPath, errs]) => {
                  if (normalizeDataPath(dataPath).startsWith(normalizedPath)) {
                    filtered[dataPath] = errs
                  }
                  return filtered
                },
                {}
              )
            })) {
              // We found some nested form to display at least parts fo the
              // errors. We can't display all errors at once, so we're done.
              // Don't call notifyErrors() yet, as we can only display it
              // once showValidationErrors() was called from DitoForm.mounted()
              return
            }
            // Keep removing the last part until we find a match.
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
      this.notify(
        'error',
        'Validation Errors',
        message || 'Please correct the highlighted errors.'
      )
    },

    resetData() {
      // We can't set `this.data = ...` because it's a property, but we can
      // set all known properties on it to the values returned by
      // `setDefaults()`, as they are all reactive already from the starts:
      Object.assign(this.data, setDefaults(this.schema, {}))
      this.clearErrors()
    },

    filterData(data) {
      // Filters out arrays and objects that are back by data resources
      // themselves, as those are already taking care of through their own API
      // resource end-points and shouldn't be set.
      const copy = {}
      for (const [key, value] of Object.entries(data)) {
        if (isArray(value) || isObject(value)) {
          if (this.getComponent(key)?.providesData) {
            continue
          }
        }
        copy[key] = value
      }
      return copy
    },

    processData({ processIds = false, removeIds = false } = {}) {
      // @ditojs/server specific handling of relates within graphs:
      // Find entries with temporary ids, and convert them to #id / #ref pairs.
      // Also handle items with relate and convert them to only contain ids.
      const process = (value, name, dataPath) => {
        // First, see if there's an associated component requiring processing.
        // See TypeMixin.dataProcessor(), OptionsMixin.getDataProcessor():
        const dataProcessor = this.dataProcessors[dataPath]
        if (dataProcessor) {
          value = dataProcessor(value, name, dataPath, this.rootData)
        }
        // Special handling is required for temporary ids when processing non
        // transient data: Replace id with #id, so '#ref' can be used for
        // relates, see OptionsMixin:
        const isObj = isObject(value)
        if (
          isObj &&
          processIds &&
          this.hasTemporaryId(value)
        ) {
          const { id, ...rest } = value
          // A reference is a shallow copy that hold nothing more than ids.
          // Use #ref instead of #id for these:
          value = this.isReference(value)
            ? { '#ref': id }
            : { '#id': id, ...rest }
        }
        if (isObj || isArray(value)) {
          // Use reduce() for both arrays and objects thanks to Object.entries()
          value = Object.entries(value).reduce(
            (processed, [key, val]) => {
              val = process(val, key, appendDataPath(dataPath, key))
              if (val !== undefined) {
                processed[key] = val
              }
              return processed
            },
            isArray(value) ? [] : {}
          )
        }
        if (isObj && removeIds && value.id) {
          delete value.id
        }
        return value
      }
      return process(this.data, null, this.dataPath)
    },

    hasTemporaryId(data) {
      return /^@/.test(data?.id)
    },

    setTemporaryId(data) {
      // Temporary ids are marked with a '@' at the beginning.
      data.id = `@${++this.temporaryId}`
    },

    isReference(data) {
      // Returns true if value is an object that holds nothing more than an id.
      const keys = data && Object.keys(data)
      return keys?.length === 1 && keys[0] === 'id'
    }
  }
})
</script>
