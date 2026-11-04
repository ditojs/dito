<template lang="pug">
DitoSchemaForm
  DitoTreeListField(
    name="volumes"
    itemLabel="name"
    :collapsed="false"
  )
    template(#form)
      DitoTextField(name="name")
    DitoTreeLevel(
      name="chapters"
      itemLabel="title"
      draggable
    )
      template(#form="context")
        DitoTextField(
          name="title"
          :label="`Chapter ${context.itemIndex + 1}`"
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
  resource: 'books',
  id: 1,
  properties: {
    volumes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          chapters: {
            type: 'array',
            items: { type: 'object', properties: { title: { type: 'string' } } }
          }
        }
      }
    }
  }
})
</script>
