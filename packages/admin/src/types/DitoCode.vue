<template lang="pug">
  .dito-code(ref="code" :style="`height: ${ 1.5 * (schema.lines || 3)}em`")
    | {{ value }}
</template>

<style lang="sass">
@import '~prismjs/themes/prism.css'
@import '~codeflask/src/codeflask.css'

.dito
  .dito-code
    padding: $input-padding

    .CodeFlask__textarea,
    .CodeFlask__pre
      &,
      code,
      pre
        font-family: $font-family-mono
        font-size: $font-size
        line-height: $line-height
        padding: $input-padding !important

    .CodeFlask__textarea
      @extend %input
      opacity: 1

    .CodeFlask__pre
      bottom: 0 // for scroll to work!
</style>

<script>
import DitoComponent from '@/DitoComponent'
import CodeFlask from 'codeflask'

export default DitoComponent.register('code', {
  mounted() {
    const indent = new Array((this.schema.indentSize || 2) + 1).join(' ')
    const flask = new CodeFlask(indent)
    flask.run(this.$refs.code, {
      language: this.schema.language || 'javascript'
    })
    flask.onUpdate(value => { this.value = value })
    this.$watch('value', value => { flask.update(value) })
  }
})
</script>
