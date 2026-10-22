<template lang="pug">
DitoSchemaForm
  DitoCustomField(
    v-slot="field"
    name="code"
    label="Code"
  )
    input.custom-code(
      v-model="field.value"
      @blur="field.validate()"
    )
    span.custom-errors(
      v-if="field.errors"
    ) {{ field.errors[0].message }}
    span.custom-limit {{ field.property.maxLength }}
    button.custom-normalize(
      type="button"
      @click="normalize(field)"
    )
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

// Each step reads the value that the previous one wrote:
function normalize(field) {
  field.value = field.value.trim()
  field.value = field.value.toUpperCase()
}
</script>
