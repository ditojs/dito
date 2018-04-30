<template lang="pug">
  .dito-code.CodeFlask(
    ref="code"
    :style="style"
  ) {{ value }}
</template>

<style lang="sass">
@import '~prismjs/themes/prism.css'
@import '~codeflask/src/codeflask.css'

.dito
  .dito-code
    padding: $input-padding

    .CodeFlask__textarea,
    .CodeFlask__pre
      height: 100%
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
      border: $border-width solid transparent // align with .CodeFlask__textarea
      bottom: 0 // for scroll to work!
      .CodeFlask__code,
      .token
        background: transparent
        text-shadow: none
    &.dito-fill
      width: auto
</style>

<script>
import TypeComponent from '@/TypeComponent'
import CodeFlask from 'codeflask'

export default TypeComponent.register('code', {
  mounted() {
    const indent = Array((this.schema.indentSize || 2) + 1).join(' ')
    const flask = new CodeFlask(indent)
    flask.run(this.$refs.code, {
      language: this.schema.language || 'javascript'
    })
    flask.onUpdate(value => { this.value = value })
    this.$watch('value', value => { flask.update(value) })
  },

  computed: {
    lines() {
      return this.schema.lines || 3
    },

    style() {
      return `height: ${this.lines * 1.5}em`
    }
  },

  methods: {
    focus() {
      this.$el.querySelector('textarea')?.focus()
    }
  }
})
</script>
