<template lang="pug">
.dito-errors(
  v-if="errors"
)
  ul
    li(
      v-for="error of errors"
    ) {{ error }}
</template>

<script>
import tippy from 'tippy.js'
import DitoComponent from '../DitoComponent.js'
import { markRaw } from 'vue'

// @vue/component
export default DitoComponent.component('DitoErrors', {
  props: {
    errors: { type: Array, default: null }
  },

  data() {
    return {
      tip: null
    }
  },

  watch: {
    errors() {
      this.$nextTick(this.updateErrors)
    }
  },

  unmounted() {
    this.tip?.destroy()
  },

  methods: {
    updateErrors() {
      let { tip } = this
      tip?.hide()
      if (this.errors) {
        tip = this.tip ??= markRaw(tippy(this.$el.closest('.dito-container')))
        tip.setProps({
          content: this.errors.join('\n'),
          theme: 'error',
          trigger: 'manual',
          appendTo: 'parent',
          placement: 'bottom-start',
          animation: 'shift-away-subtle',
          popperOptions: {
            modifiers: [
              {
                name: 'flip',
                enabled: false
              }
            ]
          },
          interactive: true,
          hideOnClick: false,
          offset: [3, 3], // 1/2 form-spacing
          zIndex: 1
        })
        tip.popper.addEventListener('mousedown', () => tip.hide())
        tip.show()
      }
    }
  }
})
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-errors {
  position: absolute;
  opacity: 0;

  ul {
    color: $color-error;
  }
}
</style>
