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
    dito-buttons.dito-buttons-round(
      :buttons="buttonSchemas"
      :dataPath="dataPath"
      :data="listData"
      :meta="meta"
    )
      dito-create-button(
        v-if="creatable"
        :schema="schema"
        :path="path"
        :verb="verbs.create"
        :text="createButtonText"
      )
      router-link.dito-button(
        v-if="objectData && editable"
        :to="{ path }" append
        tag="button"
        type="button"
        v-bind="getButtonAttributes(verbs.edit)"
      )
      button.dito-button(
        v-if="objectData && deletable"
        type="button"
        @click="deleteItem(objectData)"
        v-bind="getButtonAttributes(verbs.delete)"
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
