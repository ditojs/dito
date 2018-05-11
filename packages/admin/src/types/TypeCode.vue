<template lang="pug">
  .dito-code(
    ref="code"
    :style="style"
  ) {{ value }}
</template>

<style lang="sass">
.dito
  .dito-code
    @extend %input
    position: relative
    // For propper sizing of content along sith :style="style" setting above,
    // for proper line-height calculation.
    padding: $input-padding
    &.dito-fill
      width: auto
    .codeflask
      background: none
      // Ignore theparent padding defined above which is only needed to set
      // the desired height with :style="style".
      top: 0
      left: 0
    .codeflask__textarea,
    .codeflask__pre
      // Use same padding as .dito-code
      padding: $input-padding
    .codeflask__textarea,
    .codeflask__code,
    .codeflask__lines
      font-family: $font-family-mono
      font-size: $font-size
      line-height: $line-height
    .codeflask__lines
      padding: $input-padding
    .codeflask__lines__line
</style>

<script>
import TypeComponent from '@/TypeComponent'
import CodeFlask from 'codeflask'

export default TypeComponent.register('code', {
  mounted() {
    const flask = new CodeFlask(this.$refs.code, {
      language: this.schema.language || 'javascript',
      tabSize: this.schema.indentSize || 2,
      lineNumbers: false
    })
    flask.onUpdate(value => {
      this.value = value
      console.log(value)
    })
    this.$watch('value', value => { flask.updateCode(value) })
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
