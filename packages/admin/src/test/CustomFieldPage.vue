<template lang="pug">
DitoSchemaForm
  DitoCustomField(
    v-slot="field"
    name="code"
    label="Code"
  )
    input.custom-code(
      v-model="field.value"
    )
    span.custom-errors(
      v-if="field.errors"
    ) {{ field.errors[0].message }}
    span.custom-limit {{ field.property.maxLength }}
</template>

<script setup>
// A page whose template edits a property with its own input, for the tests of
// `DitoCustomField`:
import { useDitoForm, DitoSchemaForm, DitoCustomField } from '../index.js'

const form = useDitoForm({
  resource: 'codes',
  id: 1,
  properties: { code: { type: 'string', required: true, maxLength: 8 } }
})
defineExpose({ form })
</script>
