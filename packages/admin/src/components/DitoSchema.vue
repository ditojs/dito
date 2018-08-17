<template lang="pug">
  .dito-schema
    .dito-content
      .dito-schema-header(
        v-if="label || tabs || clipboard"
        :class="{ 'dito-schema-menu-header': menuHeader }"
      )
        .dito-label(
          v-if="label"
        ) {{ label }}
        dito-tabs(
          v-if="tabs"
          :tabs="tabs"
          :selectedTab="selectedTab"
        )
        dito-clipboard(
          v-if="clipboard"
        )
      dito-components.dito-tab-components(
        v-for="(tabSchema, key) in tabs"
        v-show="selectedTab === key"
        :key="key"
        :tab="key"
        :schema="tabSchema"
        :dataPath="dataPath"
        :data="data"
        :meta="meta"
        :store="store"
        :disabled="disabled"
        :generateLabels="generateLabels"
      )
      dito-components.dito-main-components(
        v-if="schema.components"
        :schema="schema"
        :dataPath="dataPath"
        :data="data"
        :meta="meta"
        :store="store"
        :disabled="disabled"
        :generateLabels="generateLabels"
      )
      slot(name="buttons")
</template>

<style lang="sass">
$tab-height: $menu-font-size + 2 * $tab-padding-ver
.dito
  .dito-schema
    // Use $content-padding-half at the top, for .dito-navigation
    padding: $content-padding-half $content-padding $content-padding
    box-sizing: border-box
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
    .dito-tab-components + .dito-main-components::before
      // Add removed $form-spacing again to the ruler
      margin: $form-spacing-half
    > .dito-buttons
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
import { isObject, isArray, parseDataPath } from '@ditojs/utils'

// @vue/component
export default DitoComponent.component('dito-schema', {
  inject: ['$validator'],

  props: {
    schema: { type: Object, default: null },
    dataPath: { type: String, default: '' },
    data: { type: Object, required: true },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    label: { type: String, default: null },
    disabled: { type: Boolean, required: true },
    generateLabels: { type: Boolean, default: true },
    menuHeader: { type: Boolean, default: false }
  },

  data() {
    return {
      components: {},
      // Register dataProcessors separate from copomonents, so they can survive
      // their life-cycles and be used at the end in `processData()`.
      dataProcessors: {},
      temporaryId: 0
    }
  },

  provide() {
    return {
      $schemaComponent: this
    }
  },

  computed: {
    schemaComponent() {
      // Override DitoMixin's schemaComponent() which uses the injected value.
      return this
    },

    tabs() {
      return this.schema?.tabs
    },

    selectedTab() {
      const { hash } = this.$route
      return hash?.substring(1) || this.tabs && Object.keys(this.tabs)[0] || ''
    },

    clipboard() {
      return this.schema?.clipboard
    },

    clipboardData() {
      return this.processData({
        removeIds: true
      })
    }
  },

  methods: {
    registerComponent(dataPath, comp) {
      if (comp) {
        this.$set(this.components, dataPath, comp)
        // Store the `dataProcessor` closure for this dataPath, for processing
        // of the data at later time when the component may not exist anymore:
        this.$set(this.dataProcessors, dataPath, comp.mergedDataProcessor)
      } else {
        this.$delete(this.components, dataPath)
        // NOTE: We don't remove the dataProcessors here!
      }
      this.parentSchemaComponent?.registerComponent(dataPath, comp)
    },

    getComponent(dataPathOrKey) {
      if (isArray(dataPathOrKey)) {
        dataPathOrKey = dataPathOrKey.join('/')
      }
      // See if the argument starts with this form's dataPath. If not, then it's
      // a key or subDataPath and needs to be prepended with the full path:
      const dataPath = !dataPathOrKey.startsWith(this.dataPath)
        ? this.appendDataPath(this.dataPath, dataPathOrKey)
        : dataPathOrKey
      return this.components[dataPath] || null
    },

    focus(dataPathOrKey) {
      this.getComponent(dataPathOrKey)?.focus()
    },

    addErrors(errors, focus) {
      for (const [dataPath, errs] of Object.entries(errors)) {
        const component = this.getComponent(dataPath)
        if (component) {
          component.addErrors(errs, focus)
        } else {
          throw new Error(`Cannot add errors for field ${dataPath}: ${
            JSON.stringify(errors)}`)
        }
      }
    },

    showErrors(errors, focus) {
      let first = true
      for (const [dataPath, errs] of Object.entries(errors)) {
        // Convert from JavaScript property access notation, to our own form
        // of relative JSON pointers as data-paths:
        const dataPathParts = parseDataPath(dataPath)
        const component = this.getComponent(dataPathParts)
        if (component) {
          component.addErrors(errs, first && focus)
        } else {
          // Couldn't find a component in an active form for the given dataPath.
          // See if we have a component serving a part of the dataPath, and take
          // it from there:
          let found = false
          while (!found && dataPathParts.length > 1) {
            // Keep removing the last part until we find a match.
            dataPathParts.pop()
            const component = this.getComponent(dataPathParts)
            if (component?.navigateToErrors(dataPath, errs)) {
              found = true
            }
          }
          if (!found) {
            throw new Error(
              `Cannot find component for field ${dataPath}, errors: ${
                JSON.stringify(errs)}`)
          }
        }
        first = false
      }
      return !first
    },

    clearErrors() {
      this.$errors.clear()
    },

    filterData(data) {
      // Filters out arrays that aren't considered nested data, as those are
      // already taking care of themselves through their own end-points and
      // shouldn't be set.
      const copy = {}
      for (const [key, value] of Object.entries(data)) {
        if (isArray(value)) {
          const component = this.getComponent(key)
          // Only check for isNested on source items that actually load data,
          // since other components can have array values too.
          if (component && component.isSource && !component.isNested) {
            continue
          }
        }
        copy[key] = value
      }
      return copy
    },

    processData(options = {}) {
      const {
        processIds = false,
        removeIds = false
      } = options
      // @ditojs/server specific handling of relates within graphs:
      // Find entries with temporary ids, and convert them to #id / #ref pairs.
      // Also handle items with relate and convert them to only contain ids.
      const process = (dataPath, data, parentData) => {
        // First, see if there's an associated component requiring processing.
        // See TypeMixin.processValue(), OptionsMixin.processValue():
        const dataProcessor = this.dataProcessors[dataPath]
        if (dataProcessor) {
          // NOTE: What we call `data` / `parentData` here is called
          // `value` / `data` inside components!
          data = dataProcessor(data, parentData)
        }
        // Special handling is required for temporary ids when procssing non
        // transient data: Replace id with #id, so '#ref' can be used for
        // relates, see OptionsMixin:
        if (!this.isTransient && processIds && this.hasTemporaryId(data)) {
          const { id, ...rest } = data
          // A refeference is a shallow copy that hold nothing more than ids.
          // Use #ref instead of #id for these:
          data = this.isReference(data)
            ? { '#ref': id }
            : { '#id': id, ...rest }
        }
        if (isObject(data) || isArray(data)) {
          // Use reduce() for both arrays and objects thanks to Object.entries()
          data = Object.entries(data).reduce(
            (processed, [key, entry]) => {
              const value = process(
                this.appendDataPath(dataPath, key),
                entry,
                data
              )
              if (value !== undefined) {
                processed[key] = value
              }
              return processed
            },
            isArray(data) ? [] : {}
          )
        }
        if (removeIds && data?.id) {
          delete data.id
        }
        return data
      }

      return process(this.dataPath, this.data, this.parentData)
    },

    appendDataPath(dataPath = '', token) {
      return dataPath !== ''
        ? `${dataPath}/${token}`
        : token
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
