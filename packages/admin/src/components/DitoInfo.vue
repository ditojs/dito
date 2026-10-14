<template lang="pug">
//- `DitoRoot` shows the info in a tooltip, as HTML:
.dito-info(:data-info="html")
</template>

<script>
import { computed } from 'vue'
import { getHtml } from '../utils/html.js'

export default {
  props: {
    // Text, or `{ text }` or `{ html }`:
    info: { type: [String, Object], required: true }
  },

  setup(props) {
    return {
      html: computed(() => getHtml(props.info))
    }
  }
}
</script>
