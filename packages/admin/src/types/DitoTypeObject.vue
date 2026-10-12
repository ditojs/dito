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
      :formSchema="getItemFormSchema(schema, objectData, context)"
      :dataPath="dataPath"
      :data="objectData"
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
    :store="store"
    :disabled="disabled || isLoading"
    :creatable="creatable"
    :createPath="createPath"
    :editable="editable"
    :editPath="objectPath"
    :deletable="!isInlined && deletable"
    @delete="deleteItem(objectData)"
  )
</template>

<script>
import DitoComponent from '../DitoComponent.js'
import { defineType } from '../utils/schema/types.ts'
import { sourceTraits } from './traits.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import DitoSourceItem from '../components/DitoSourceItem.vue'
import SourceMixin, { useSourceServices } from '../mixins/SourceMixin.js'
import { resolveSchemaComponent } from '../utils/schema/setup.js'

// @vue/component
const DitoTypeObject = DitoComponent.component('DitoTypeObject', {
  mixins: [SourceMixin],
  components: { DitoSourceItem },
  props: fieldProps,

  setup(props) {
    const { value, context, disabled, onChange, focus } = useField(props, {
      services: useSourceServices()
    })
    return { value, context, disabled, onChange, focus }
  }
})

defineType({
  types: ['object'],
  component: DitoTypeObject,
  ...sourceTraits,
  sourceType: 'object',

  async processSchema(api, schema, name) {
    await Promise.all([
      resolveSchemaComponent(schema),
      sourceTraits.processSchema(api, schema, name)
    ])
  }
})

export default DitoTypeObject
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
