<template lang="pug">
.dito-object(
  v-if="isReady"
  :id="dataPath"
  :class="schema.class"
  :style="schema.style"
)
  .dito-object-content(
    v-if="objectData"
  )
    //- Support the same rendering options as TypeList:
    dito-schema-inlined(
      v-if="isInlined"
        :label="objectLabel"
      :schema="getItemFormSchema(schema, objectData, context)"
      :dataPath="dataPath"
      :data="objectData"
      :meta="nestedMeta"
      :store="store"
      :disabled="disabled || isLoading"
      :collapsed="collapsed"
      :collapsible="collapsible"
    )
    component(
      v-else-if="schema.component"
      :is="schema.component"
      :dataPath="dataPath"
      :data="objectData"
      :nested="false"
    )
    span(
      v-else-if="render"
      v-html="render(getContext())"
    )
    span(
      v-else
      v-html="getItemLabel(schema, objectData)"
    )
  dito-edit-buttons(
    :creatable="creatable"
    :deletable="objectData && deletable"
    :editable="objectData && editable"
    :createPath="path"
    :editPath="path"
    :buttons="buttonSchemas"
    :schema="schema"
    :dataPath="dataPath"
    :data="objectData"
    :path="path"
    :meta="meta"
    :store="store"
    @delete="deleteItem(objectData)"
  )
</template>

<style lang="sass">
  @import '../styles/_imports'

  .dito-object
    display: flex
    border: $border-style
    border-radius: $border-radius
    margin: 0
    padding: $form-spacing
    box-sizing: border-box
    .dito-object-content
      flex: 0 1 100%
    > .dito-buttons
      flex: 1 0 0%
      margin-left: $form-spacing
</style>

<script>
import TypeComponent from '../TypeComponent.js'
import DitoContext from '../DitoContext.js'
import SourceMixin from '../mixins/SourceMixin.js'
import { resolveSchemaComponent } from '../utils/schema.js'

// @vue/component
export default TypeComponent.register('object', {
  mixins: [SourceMixin],

  getSourceType(type) {
    // No need for transformation here. See TypeTreeList for details.
    return type
  },

  computed: {
    objectLabel() {
      // Only show a label if the object is collapsible.
      return this.collapsible
        ? this.getItemLabel(this.schema, this.objectData, { asObject: true })
        : null
    }
  },

  methods: {
    getContext() {
      return new DitoContext(this, { data: this.objectData })
    }
  },

  async processSchema(
    api, schema, name, routes, level,
    nested = false, flatten = false,
    process = null
  ) {
    await Promise.all([
      resolveSchemaComponent(schema),
      SourceMixin.processSchema(
        api, schema, name, routes, level,
        nested, flatten,
        process
      )
    ])
  }
})
</script>
