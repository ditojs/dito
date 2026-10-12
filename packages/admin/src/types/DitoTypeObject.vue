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
  //- NOTE: Inlined objects only get the create button here, the other edit
  //- buttons are in `DitoSchemaInlined`.
  DitoEditButtons(
    :buttons="buttonSchemas"
    :schema="schema"
    :dataPath="dataPath"
    :data="objectData"
    :store="store"
    :disabled="disabled || isLoading"
    :creatable="creatable"
    :createPath="sourceContext.createPath"
    :editable="editable"
    :editPath="sourceContext.objectPath"
    :deletable="!isInlined && deletable"
    @delete="deleteItem(objectData)"
  )
</template>

<script>
import { defineType } from '../utils/schema/types.ts'
import { sourceTraits } from './traits.ts'
import { fieldProps } from '../composables/useField.ts'
import { useSource } from '../composables/useSource.ts'
import DitoSourceItem from '../components/DitoSourceItem.vue'
import { resolveSchemaComponent } from '../utils/schema/setup.js'
import { getItemFormSchema } from '../utils/schema/lookup.js'

// @vue/component
const DitoTypeObject = {
  name: 'DitoTypeObject',
  components: { DitoSourceItem },
  props: fieldProps,
  setup: props => ({ ...useSource(props), getItemFormSchema })
}

defineType({
  type: 'object',
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
