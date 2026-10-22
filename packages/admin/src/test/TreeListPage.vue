<template lang="pug">
DitoSchemaForm
  DitoTreeListField(
    name="shopSets"
    itemLabel="name"
    :collapsed="false"
  )
    template(#form)
      DitoTextField(name="name")
    DitoTreeLevel(
      name="cuts"
      itemLabel="title"
      draggable
    )
      template(#form="context")
        DitoTextField(
          name="title"
          :label="`Cut ${context.itemIndex + 1}`"
        )
</template>

<script setup>
// A page whose template declares the levels of a tree, for the tests of
// `DitoTreeListField`:
import {
  useDitoForm,
  DitoSchemaForm,
  DitoTextField,
  DitoTreeListField,
  DitoTreeLevel
} from '../index.js'

useDitoForm({
  resource: 'fonts',
  id: 1,
  properties: {
    shopSets: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          cuts: {
            type: 'array',
            items: { type: 'object', properties: { title: { type: 'string' } } }
          }
        }
      }
    }
  }
})
</script>
