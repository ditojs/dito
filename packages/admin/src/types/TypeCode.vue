<template lang="pug">
  .dito-code(
    ref="code"
    :id="dataPath"
    :style="style"
  )
</template>

<style lang="sass">
  .dito-code
    @extend %input
    position: relative
    // For propper sizing of content along with :style="style" setting above,
    // for proper line-height calculation.
    padding: $input-padding
    &.dito-width-fill
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
      font-size: var(--font-size)
      line-height: var(--line-height)
    .codeflask__lines
      padding: $input-padding
    .codeflask__lines__line
</style>

<script>
import TypeComponent from '@/TypeComponent'
import CodeFlask from 'codeflask'

// @vue/component
export default TypeComponent.register('code', {
  computed: {
    lines() {
      return this.schema.lines || 3
    },

    style() {
      return `height: calc(${this.lines}em * var(--line-height))`
    }
  },

  mounted() {
    const flask = new CodeFlask(this.$refs.code, {
      language: this.schema.language || 'javascript',
      tabSize: this.schema.indentSize || 2,
      lineNumbers: false
    })

    let ignoreWatch = false
    let ignoreUpdate = false

    const setCode = code => {
      if (code !== flask.code) {
        ignoreUpdate = true
        flask.updateCode(code)
      }
    }

    const setValue = value => {
      if (value !== this.value) {
        ignoreWatch = true
        this.value = value
      }
    }

    flask.onUpdate(value => {
      if (ignoreUpdate) {
        ignoreUpdate = false
      } else {
        setValue(value)
      }
    })

    this.$watch('value', value => {
      if (ignoreWatch) {
        ignoreWatch = false
      } else {
        setCode(value || '')
      }
    })

    setCode(this.value || '')
  },

  methods: {
    focus() {
      this.$el.querySelector('textarea')?.focus()
    }
  }
})
</script>
