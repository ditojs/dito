<template lang="pug">
//- Only show panels in tabs when the tabs are also visible.
component.dito-panel(
  v-if="shouldRenderSchema(panelSchema)"
  v-show="visible && (!panelTabComponent || panelTabComponent.visible)"
  :is="panelTag"
  @submit.prevent
)
  DitoSchema.dito-panel__schema(
    :schema="panelSchema"
    :dataSchema="panelDataSchema"
    :dataPath="panelDataPath"
    :data="panelData"
    :meta="meta"
    :store="store"
    padding="nested"
    :disabled="disabled"
    :hasOwnData="hasOwnData"
    generateLabels
  )
    template(#before)
      h2.dito-panel__header(:class="{ 'dito-panel__header--sticky': sticky }")
        span {{ getLabel(schema) }}
        DitoButtons.dito-buttons-small(
          :buttons="panelButtonSchemas"
          :dataPath="panelDataPath"
          :data="panelData"
          :meta="meta"
          :store="store"
          :disabled="disabled"
        )
    template(#buttons)
      DitoButtons(
        :buttons="buttonSchemas"
        :dataPath="panelDataPath"
        :data="panelData"
        :meta="meta"
        :store="store"
        :disabled="disabled"
      )
</template>

<script>
import { isFunction } from '@ditojs/utils'
import DitoComponent from '../DitoComponent.js'
import ValidatorMixin from '../mixins/ValidatorMixin.js'
import { getButtonSchemas } from '../utils/schema.js'
import { getSchemaAccessor } from '../utils/accessor.js'

// @vue/component
export default DitoComponent.component('DitoPanel', {
  mixins: [ValidatorMixin],

  provide() {
    return {
      $panelComponent: () => this,
      $tabComponent: () => this.panelTabComponent
    }
  },

  props: {
    schema: { type: Object, required: true },
    dataPath: { type: String, required: true },
    data: { type: Object, required: true },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    disabled: { type: Boolean, required: true },
    panelTabComponent: { type: Object, default: null }
  },

  data() {
    return {
      ownData: null
    }
  },

  computed: {
    panelComponent() {
      return this
    },

    tabComponent() {
      return this.panelTabComponent
    },

    buttonSchemas() {
      return getButtonSchemas(this.schema.buttons)
    },

    panelButtonSchemas() {
      return getButtonSchemas(this.schema.panelButtons)
    },

    hasOwnData() {
      return !!this.ownData
    },

    panelData() {
      return this.ownData || this.data
    },

    panelSchema() {
      if (this.hasOwnData) {
        return this.schema
      } else {
        // Remove `data` from the schema, so that DitoSchema isn't using it to
        // produce its own data. See $filters panel for more details on data.
        const { data, ...schema } = this.schema
        return schema
      }
    },

    panelTag() {
      // Panels that provide their own data need their own form.
      return this.hasOwnData ? 'form' : 'div'
    },

    panelDataSchema() {
      return this.hasOwnData ? this.schema : this.schemaComponent.schema
    },

    panelDataPath() {
      // If the panel provides its own data, then it needs to prefix all
      // components with its data-path, but if it shares data with the schema
      // component, then it should share the data-path name space too.
      return this.hasOwnData ? this.dataPath : this.schemaComponent.dataPath
    },

    visible: getSchemaAccessor('visible', {
      type: Boolean,
      default: true
    }),

    sticky: getSchemaAccessor('sticky', {
      type: Boolean,
      default: false
    })
  },

  created() {
    this._register(true)
    // NOTE: This is not the same as `schema.data` handling in DitoSchema,
    // where the data is added to the actual component.
    const { data } = this.schema
    if (data) {
      this.ownData = isFunction(data)
        ? data(this.context)
        : data
    }
  },

  unmounted() {
    this._register(false)
  },

  methods: {
    _register(add) {
      // Register the panels so that other components can find them by their
      // data-path, e.g. in TypeList.onFilterErrors()
      this.schemaComponent._registerPanel(this, add)
    }
  }
})
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-panel {
  &:not(:last-child) {
    margin-bottom: $content-padding;
  }

  &__header {
    display: block;
    position: relative;
    box-sizing: border-box;
    padding: $input-padding;
    background: $button-color;
    border: $border-style;
    border-top-left-radius: $border-radius;
    border-top-right-radius: $border-radius;

    &--sticky {
      $margin: $input-height-factor * $line-height * $font-size-small +
        $form-spacing;

      position: sticky;
      top: $content-padding;
      margin-bottom: $margin;
      z-index: 1;

      & + * {
        margin-top: -$margin;
      }

      &::before {
        content: '';
        display: block;
        position: absolute;
        background: $content-color-background;
        left: 0;
        right: 0;
        height: $content-padding;
        top: -$content-padding;
        margin: -$border-width;
      }
    }

    .dito-buttons {
      position: absolute;
      right: $input-padding-ver;
      top: 50%;
      transform: translateY(-50%);
    }
  }

  &__schema {
    font-size: $font-size-small;
    background: $content-color-background;
    border: $border-style;
    border-top: 0;
    border-bottom-left-radius: $border-radius;
    border-bottom-right-radius: $border-radius;

    > .dito-schema-content {
      .dito-object {
        border: none;
        padding: 0;
      }

      > .dito-buttons {
        --button-margin: #{$form-spacing};

        padding: $form-spacing;

        .dito-container {
          padding: 0;
        }
      }
    }

    .dito-label {
      label {
        font-weight: normal;
      }
    }
  }
}
</style>
