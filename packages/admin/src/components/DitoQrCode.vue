<template lang="pug">
.dito-qr-code
  img.dito-qr-code__image(
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
.dito-qr-code__image {
  display: block;
  width: 160px;
  margin: 0 auto;
}
</style>
