<template lang="pug">
.dito-code(
  :id="dataPath"
  :style="style"
)
  .dito-code__editor(ref="editor")
  .dito-resize(
    v-if="resizable"
    @mousedown.stop.prevent="onDragResize"
  )
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import DomMixin from '../mixins/DomMixin.js'
import { getSchemaAccessor } from '../utils/accessor.js'
import CodeFlask from 'codeflask'

// @vue/component
export default DitoTypeComponent.register('code', {
  mixins: [DomMixin],

  data() {
    return {
      height: null
    }
  },

  computed: {
    lines: getSchemaAccessor('lines', {
      type: Number,
      default: 3
    }),

    language: getSchemaAccessor('language', {
      type: String,
      default: 'javascript'
    }),

    indentSize: getSchemaAccessor('indentSize', {
      type: Number,
      default: 2
    }),

    resizable: getSchemaAccessor('resizable', {
      type: Boolean,
      default: false
    }),

    style() {
      return {
        height: this.height || `calc(${this.lines}em * var(--line-height))`
      }
    }
  },

  mounted() {
    const flask = new CodeFlask(this.$refs.editor, {
      language: this.language,
      indentSize: this.indentSize,
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

    this.domOn(this.$refs.editor.querySelector('textarea'), {
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

    this.$watch('language', language => {
      flask.updateLanguage(language)
    })

    setCode(this.value || '')
  },

  methods: {
    focusElement() {
      this.$el.querySelector('textarea')?.focus()
    },

    blurElement() {
      this.$el.querySelector('textarea')?.blur()
    },

    onDragResize(event) {
      const getPoint = ({ clientX: x, clientY: y }) => ({ x, y })

      let prevY = getPoint(event).y
      let height = parseFloat(getComputedStyle(this.$el).height)

      const mousemove = event => {
        const { y } = getPoint(event)
        height += y - prevY
        prevY = y
        this.height = `${Math.max(height, 0)}px`
      }

      const handlers = this.domOn(document, {
        mousemove,

        mouseup(event) {
          mousemove(event)
          handlers.remove()
        }
      })
    }
  }
})
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-code {
  @extend %input;

  position: relative;
  // For proper sizing of content along with :style="style" setting above,
  // for proper line-height calculation.
  padding: $input-padding;
  min-height: calc(1em * var(--line-height) + 2 * $input-padding-ver);

  .codeflask {
    background: none;
    // Ignore the parent padding defined above which is only needed to set
    // the desired height with :style="style".
    top: 0;
    left: 0;

    &__textarea,
    &__pre {
      // Use same padding as .dito-code
      padding: $input-padding;
    }

    &__textarea,
    &__code,
    &__lines {
      font-family: $font-family-mono;
      font-size: var(--font-size);
      line-height: var(--line-height);
    }

    &__lines {
      padding: $input-padding;
    }
  }
}
</style>
