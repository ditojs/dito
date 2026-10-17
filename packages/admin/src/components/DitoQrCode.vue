<template lang="pug">
img.dito-qr-code(
  :src="src"
  alt="QR code"
)
</template>

<script>
// The QR code of its value, e.g. of the TOTP setup in the security dialog, as
// a `{ type: 'component' }` schema.

import { computed } from 'vue'
import { generate } from 'lean-qr'
import { toSvgDataURL } from 'lean-qr/extras/svg'

export default {
  emits: ['update:modelValue', 'change'],

  props: {
    schema: { type: Object, required: true },
    context: { type: Object, required: true },
    modelValue: { type: String, required: true }
  },

  setup(props) {
    return {
      src: computed(() => toSvgDataURL(generate(props.modelValue)))
    }
  }
}
</script>

<style lang="scss">
.dito-qr-code {
  width: 160px;
}
</style>
