<template lang="pug">
//- Only show panels in tabs when the tabs are also visible.
component.dito-panel(
  v-if="shouldRenderPanel"
  v-show="visible && (!isTabSelected || isTabSelected())"
  :is="panelTag"
  role="region"
  :aria-label="getLabel(schema)"
  @submit.prevent
)
  DitoSchema.dito-panel__schema(
    :schema="schema"
    :dataSchema="panelDataSchema"
    :dataPath="panelDataPath"
    :data="panelData"
    :store="store"
    padding="nested"
    :disabled="disabled"
    :hasOwnData="hasOwnData"
    generateLabels
  )
    template(#prepend)
      h2.dito-panel__header(:class="{ 'dito-panel__header--sticky': sticky }")
        span {{ getLabel(schema) }}
        DitoButtons.dito-buttons--small(
          :buttons="panelButtonSchemas"
          buttonsName="panelButtons"
          :dataPath="panelDataPath"
          :data="panelData"
          :store="store"
          :disabled="disabled"
        )
    template(#buttons)
      DitoButtons(
        :buttons="buttonSchemas"
        :dataPath="panelDataPath"
        :data="panelData"
        :store="store"
        :disabled="disabled"
      )
</template>

<script>
import { markRaw } from 'vue'
import { isFunction } from '@ditojs/utils'
import DitoComponent from '../DitoComponent.js'
import DitoContext from '../DitoContext.js'
import SchemaParentMixin from '../mixins/SchemaParentMixin.js'
import { getButtonSchemas } from '../utils/schema/lookup.js'
import { shouldRenderComponents } from '../utils/schema/data.js'
import { getSchemaAccessor } from '../utils/accessor.js'
import { trackRegistration } from '../utils/registration.js'
import { DataModel } from '../utils/DataModel.ts'
import { ContainerContext } from '../utils/ContainerContext.ts'

// @vue/component
export default DitoComponent.component('DitoPanel', {
  mixins: [SchemaParentMixin],

  provide() {
    // Only panels with their own data own a data model:
    return this.ownContainer ? { container: this.ownContainer } : {}
  },

  props: {
    schema: { type: Object, required: true },
    dataPath: { type: String, required: true },
    data: { type: Object, required: true },
    store: { type: Object, required: true },
    disabled: { type: Boolean, required: true },
    // Tells if the tab of the panel's component is selected, for panels of
    // components in tabs, see `getAllPanelEntries()`:
    isTabSelected: { type: Function, default: null },
    // The component path of the panel's entry, see `getAllPanelEntries()`:
    panelComponentPath: { type: String, required: true }
  },

  data() {
    return {
      ownData: null,
      ownContainer: this.schema.data
        ? markRaw(new ContainerContext(this))
        : null
    }
  },

  computed: {
    // @override
    // The panel decides about itself in the data around it, e.g. in `if` and
    // `data()`, while its components and buttons see the data it displays:
    context() {
      const { schemaComponent } = this
      return new DitoContext(schemaComponent, {
        schema: this.schema,
        nested: false,
        data: this.data,
        dataPath: schemaComponent.dataPath
      })
    },

    shouldRenderPanel() {
      return (
        this.getSchemaValue('if', { type: Boolean, default: true }) &&
        shouldRenderComponents(
          this.schema,
          new DitoContext(this, {
            nested: false,
            data: this.panelData,
            dataPath: this.panelDataPath
          })
        )
      )
    },

    componentPath() {
      return this.panelComponentPath
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

    panelTag() {
      // Panels that provide their own data need their own form.
      return this.hasOwnData ? 'form' : 'div'
    },

    panelDataSchema() {
      return this.hasOwnData ? this.schema : this.schemaComponent.schema
    },

    panelDataPath() {
      // Panels with their own data are their own container:
      return this.hasOwnData ? '' : this.schemaComponent.dataPath
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
    // Register the panels so that other components can find them by their
    // data-path, e.g. in TypeList.onFilterErrors()
    this._unregister = trackRegistration(this, (add, componentPath) =>
      this.schemaComponent._registerPanel(this, add, componentPath)
    )
    const { data } = this.schema
    if (data) {
      this.ownData = isFunction(data) ? data(this.context) : data
      // Own data gets its own model, like in dialogs, so that its edits don't
      // make the displayed data dirty:
      const panel = this
      this.ownDataModel = markRaw(
        new DataModel({
          schema: () => this.schema,
          data: () => this.ownData,
          services: {
            admin: this.admin,
            container: this.ownContainer,
            route: this.route,
            get source() {
              return panel.source
            },
            get resource() {
              return panel.resource
            }
          }
        })
      )
    }
  },

  beforeUnmount() {
    // Stop the model before the component's own watchers are stopped, as the
    // model's watchers aren't part of the component, see `DataModel`.
    this.ownDataModel?.stop()
  },

  unmounted() {
    this._unregister()
  },

  methods: {
    setData(data) {
      this.ownData = data
      return this.ownData
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

    // TODO: BEM: Style an element class of this block, e.g. `&__buttons`.
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

      // TODO: BEM: Style an element class of this block, e.g. `&__buttons`.
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
