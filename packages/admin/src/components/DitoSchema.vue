<template lang="pug">
  .dito-schema
    .dito-schema-content
      .dito-schema-header(
        v-if="label || tabs || clipboard"
        :class="{ 'dito-schema-menu-header': menuHeader }"
      )
        .dito-label(
          v-if="label"
        )
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
      dito-components.dito-main-components(
        v-if="schema.components"
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
        v-if="isPopulated"
      )
    dito-panels(
      v-if="isPopulated && panelSchemas.length > 0"
      :panels="panelSchemas"
      :data="data"
      :meta="meta"
      :store="store"
      :disabled="disabled"
    )
</template>

<style lang="sass">
$tab-height: $menu-font-size + 2 * $tab-padding-ver
.dito
  .dito-schema
    box-sizing: border-box
    display: flex
    > .dito-schema-content
      flex: 1 1 100%
      max-width: $content-width
      padding: $content-padding
    .dito-panels
      flex: 1 1 0%
      padding: $content-padding $content-padding $content-padding 0
    // Display a ruler between tabbed components and towards the .dito-buttons
    .dito-tab-components + .dito-main-components,
    .dito-components + .dito-form-buttons
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
</style>

<script>
import DitoComponent from '@/DitoComponent'
import ItemMixin from '@/mixins/ItemMixin'
import Field from '@/utils/Field'
import { appendDataPath, getParentItem } from '@/utils/data'
import { getNamedSchemas, getPanelSchema, setDefaults } from '@/utils/schema'
import {
  isObject, isArray, isFunction, isRegExp,
  getDataPath, parseDataPath, normalizeDataPath,
  labelize
} from '@ditojs/utils'

// @vue/component
export default DitoComponent.component('dito-schema', {
  mixins: [ItemMixin],

  provide() {
    return {
      $schemaComponent: this,
      $fields: this.fields
    }
  },

  props: {
    schema: { type: Object, default: null },
    dataPath: { type: String, default: '' },
    data: { type: Object, default: null },
    meta: { type: Object, default: () => ({}) },
    store: { type: Object, default: () => ({}) },
    label: { type: String, default: null },
    disabled: { type: Boolean, default: false },
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
      isMounted: false,
      components: {},
      panels: {},
      fields: {},
      temporaryId: 0
    }
  },

  computed: {
    schemaComponent() {
      // Override DitoMixin's schemaComponent() which uses the injected value.
      return this
    },

    componentsContainers() {
      // Use the `isMounted` trick to make `$refs` somewhat reactive:
      return this.isMounted
        ? [
          // Tabs appear above the main schema, so use the same logic here too:
          ...(this.$refs.tabs || []),
          this.$refs.components
        ]
        : []
    },

    panelSchemas() {
      const schemas = []
      for (const [key, schema] of Object.entries(this.schema.panels || [])) {
        const panel = getPanelSchema(schema, key, this.schemaComponent)
        if (panel) {
          schemas.push(panel)
        }
      }
      for (const componentContainer of this.componentsContainers) {
        schemas.push(...componentContainer.panelSchemas)
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
      return this.someField(it => it.isDirty)
    },

    isTouched() {
      return this.someField(it => it.isTouched)
    },

    isValid() {
      return this.everyField(it => it.isValid)
    }
  },

  created() {
    this.setupSchemaFields()
    // Delegate change events through to parent schema:
    this.delegate('change', this.parentSchemaComponent)
  },

  mounted() {
    this.isMounted = true
  },

  methods: {
    _register(container, component, add) {
      const { dataPath } = component
      if (add) {
        this.$set(container, dataPath, component)
      } else {
        this.$delete(container, dataPath)
      }
    },

    _get(container, dataPath) {
      dataPath = normalizeDataPath(dataPath)
      // See if the argument starts with this form's data-path. If not, then it
      // is a key or sub data-path and needs to be prefixed with the full path:
      dataPath = dataPath.startsWith(this.dataPath)
        ? dataPath
        : appendDataPath(this.dataPath, dataPath)
      return container[dataPath] || null
    },

    registerComponent(component, add) {
      this._register(this.components, component, add)
      if (add) {
        // Register fields objects separate from their components, so they can
        // survive their life-cycles and be used at the end in `validate()`,
        // `processData()`, etc.
        this.$set(
          this.fields,
          component.dataPath,
          // Either reuse `component.$field` if it was registered already on a
          // parent schema, or create a field on the fly if it wasn't yet.
          component.$field || new Field(component)
        )
      } else {
        // NOTE: We don't remove the field when de-registering! They may still
        // be required after the component itself is destroyed.
      }
      this.parentSchemaComponent?.registerComponent(component, add)
    },

    registerPanel(panel, add) {
      this._register(this.panels, panel, add)
    },

    getComponent(dataPath) {
      return this._get(this.components, dataPath)
    },

    getPanel(dataPath) {
      return this._get(this.panels, dataPath)
    },

    getField(dataPath) {
      return this._get(this.fields, dataPath)
    },

    someField(callback) {
      return this.isPopulated && Object.values(this.fields).some(callback)
    },

    everyField(callback) {
      return this.isPopulated && Object.values(this.fields).every(callback)
    },

    resetFields() {
      for (const field of Object.values(this.fields)) {
        field.reset()
      }
    },

    onLoad() {
      this.emitEvent('load')
    },

    onChange() {
      this.emitEvent('change')
    },

    clearErrors() {
      for (const field of Object.values(this.fields)) {
        field.clearErrors()
      }
    },

    async validateAll(match, notify = true) {
      const { fields } = this
      let dataPaths
      if (match) {
        const check = isFunction(match)
          ? match
          : isRegExp(match)
            ? field => match.test(field)
            : null
        dataPaths = check
          ? Object.keys(fields).filter(check)
          : isArray(match)
            ? match
            : [match]
      }
      let isValid = true
      let first = true
      for (const dataPath of (dataPaths || Object.keys(fields))) {
        const field = fields[dataPath]
        if (field) {
          const value = getDataPath(this.rootData, dataPath, () => null)
          if (!await field.validate(value, notify)) {
            // Focus first error field
            if (notify && first) {
              field.focus()
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

    async verifyAll(match) {
      return this.validateAll(match, false)
    },

    showValidationErrors(errors, focus) {
      this.clearErrors()
      let first = true
      const unmatched = []
      for (const [dataPath, errs] of Object.entries(errors)) {
        // If the schema is a data-root, prefix its own dataPath to all errors,
        // since the data that it sends and validate swill be unprefixed.
        const fullDataPath = this.hasOwnData
          ? appendDataPath(this.dataPath, dataPath)
          : dataPath
        // console.log(this, this.dataPath, this.hasOwnData, fullDataPath)
        // Convert from JavaScript property access notation, to our own form
        // of relative JSON pointers as data-paths:
        const dataPathParts = parseDataPath(fullDataPath)
        const field = this.getField(dataPathParts)
        if (!field?.showValidationErrors(errs, first && focus)) {
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
      // Filters out arrays that are back by data resources themselves, as those
      // are already taking care of through their own API resource end-points
      // and shouldn't be set.
      const copy = {}
      for (const [key, value] of Object.entries(data)) {
        if (isArray(value)) {
          if (this.getComponent(key)?.hasResource) {
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
        // See TypeMixin.mergedDataProcessor(), OptionsMixin.dataProcessor():
        const dataProcessor = this.fields[dataPath]?.dataProcessor
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
