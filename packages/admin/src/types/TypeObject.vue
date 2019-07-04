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
      // Support the same rendering options as TypeList:
      dito-schema-inlined(
        v-if="inlined"
        :schema="getItemFormSchema(schema, objectData)"
        :dataPath="dataPath"
        :data="objectData"
        :meta="nestedMeta"
        :store="store"
        :disabled="disabled || isLoading"
        :collapsed="collapsed"
        :collapsible="collapsible"
      )
      component(
        v-else-if="component"
        :is="component"
        :dataPath="dataPath"
        :dataPathIsValue="false"
        :data="objectData"
      )
      span(
        v-else-if="schema.render"
        v-html="schema.render(getItemParams())"
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
import TypeComponent from '@/TypeComponent'
import SourceMixin from '@/mixins/SourceMixin'
import { getItemParams } from '@/utils/data'

// @vue/component
export default TypeComponent.register('object', {
  mixins: [SourceMixin],

  getSourceType(type) {
    // No need for transformation here. See TypeTreeList for details.
    return type
  },

  methods: {
    getItemParams() {
      return getItemParams(this, {
        name: undefined,
        value: undefined,
        data: this.objectData,
        dataPath: this.dataPath
      })
    }
  }
})
</script>
