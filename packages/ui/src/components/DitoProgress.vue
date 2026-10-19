<template lang="pug">
//- Without a value, `<progress>` is indeterminate:
progress.dito-progress(
  :value="value === null ? null : value - min"
  :max="max - min"
)
</template>

<script>
export default {
  props: {
    value: { type: Number, default: null },
    min: { type: Number, default: 0 },
    max: { type: Number, default: 1 }
  }
}
</script>
