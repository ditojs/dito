<template lang="pug">
.dito-code(
  :id="componentPath"
  :style="style"
)
  .dito-code__editor(ref="editor")
  .dito-resize(
    v-if="resizable"
    tabindex="0"
    role="separator"
    aria-orientation="horizontal"
    aria-label="Resize"
    @pointerdown.stop.prevent="onResizePointerDown"
    @keydown="onResizeKeyDown"
  )
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import { getSchemaAccessor } from '../utils/accessor.js'
import { startDragResize, resizeByArrowKey } from '../utils/dragResize.js'
import CodeFlask from 'codeflask'

// @vue/component
export default DitoTypeComponent.register('code', {
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

    // The height of the lines is set through `--lines` and the styles, which
    // add the padding, unless the editor was resized to a height of its own.
    style() {
      return this.height ? { height: this.height } : { '--lines': this.lines }
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

    // The textarea is owned by the editor, so its handlers go with it:
    const textarea = this.$refs.editor.querySelector('textarea')
    textarea.addEventListener('focus', onFocus)
    textarea.addEventListener('blur', onBlur)

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
        this.onInput()
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

    this.$watch(
      () => this.readonly || this.disabled,
      readonly =>
        readonly ? flask.enableReadonlyMode() : flask.disableReadonlyMode(),
      { immediate: true }
    )

    setCode(this.value || '')
  },

  methods: {
    focusElement() {
      this.$el.querySelector('textarea')?.focus()
    },

    blurElement() {
      this.$el.querySelector('textarea')?.blur()
    },

    onResizePointerDown(event) {
      startDragResize(event, this.getResizeOptions())
    },

    onResizeKeyDown(event) {
      resizeByArrowKey(event, this.getResizeOptions())
    },

    getResizeOptions() {
      return {
        element: this.$el,
        onResize: height => {
          this.height = `${height}px`
        }
      }
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
  height: calc(
    var(--lines) * 1em * var(--line-height) + 2 * #{$input-padding-ver}
  );
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
