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
</style>

<script>
import TypeComponent from '../TypeComponent.js'
import DomMixin from '../mixins/DomMixin.js'
import CodeFlask from 'codeflask'

// @vue/component
export default TypeComponent.register('code', {
  mixins: [DomMixin],

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

    let changed = false
    let ignoreWatch = false
    let ignoreUpdate = false

    const onChange = () => {
      if (!this.focused && changed) {
        changed = false
        this.onChange()
      }
    }

    const onFocus = () => this.onFocus()

    const onBlur = () => {
      this.onBlur()
      onChange()
    }

    this.domOn(this.$refs.code.querySelector('textarea'), {
      focus: onFocus,
      blur: onBlur
    })

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
        changed = true
        onChange()
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
    focusElement() {
      this.$el.querySelector('textarea')?.focus()
    }
  }
})
</script>
