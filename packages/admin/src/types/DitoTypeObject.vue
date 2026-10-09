<template lang="pug">
.dito-object(
  v-if="isReady"
  :id="componentPath"
)
  .dito-object-content(
    v-if="objectData"
  )
    DitoSourceItem(
      :schema="schema"
      :dataPath="dataPath"
      :data="objectData"
      :meta="nestedMeta"
      :store="store"
      :disabled="disabled || isLoading"
      :collapsed="collapsed"
      :collapsible="collapsible"
      :deletable="deletable"
      @delete="deleteItem(objectData)"
    )
  //- NOTE: For inlined objects, `DitoEditButtons` here only handle the create
  //- button outside of the schema, the other edit buttons inside are handled by
  //- `DitoSchemaInlined`.
  DitoEditButtons(
    :buttons="buttonSchemas"
    :schema="schema"
    :dataPath="dataPath"
    :data="objectData"
    :meta="meta"
    :store="store"
    :disabled="disabled || isLoading"
    :creatable="creatable"
    :createPath="createPath"
    :editable="editable"
    :editPath="path"
    :deletable="!isInlined && deletable"
    @delete="deleteItem(objectData)"
  )
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import DitoSourceItem from '../components/DitoSourceItem.vue'
import SourceMixin from '../mixins/SourceMixin.js'
import { resolveSchemaComponent } from '../utils/schema/setup.js'

// @vue/component
export default DitoTypeComponent.register('object', {
  mixins: [SourceMixin],
  components: { DitoSourceItem },

  getSourceType(type) {
    // No need for transformation here. See TypeTreeList for details.
    return type
  },

  async processSchema(
    api,
    schema,
    name,
    routes,
    level,
    nested = false,
    flatten = false,
    process = null
  ) {
    await Promise.all([
      resolveSchemaComponent(schema),
      SourceMixin.processSchema(
        api,
        schema,
        name,
        routes,
        level,
        nested,
        flatten,
        process
      )
    ])
  }
})
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-object {
  display: flex;
  border: $border-style;
  border-radius: $border-radius;
  margin: 0;
  padding: $form-spacing;
  box-sizing: border-box;
  min-width: min-content;

  .dito-object-content {
    flex: 0 1 100%;
  }

  > .dito-edit-buttons {
    flex: 1 0 0%;
    margin-left: $form-spacing;
  }
}
</style>
