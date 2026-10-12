<template lang="pug">
.dito-code(
  :id="componentPath"
  ref="element"
  :style="style"
)
  .dito-code__editor(ref="editor")
  DitoResizeHandle(
    v-if="resizable"
    :getElement="() => $el"
    @resize="height = `${$event}px`"
  )
</template>

<script>
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import { defineType } from '../utils/schema/types.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import { createChangeOnceEdited } from '../utils/changeOnceEdited.js'
import DitoResizeHandle from '../components/DitoResizeHandle.vue'
import CodeFlask from 'codeflask'

// @vue/component
const DitoTypeCode = {
  name: 'DitoTypeCode',
  components: { DitoResizeHandle },
  props: fieldProps,

  setup(props) {
    const editor = useTemplateRef('editor')
    const getTextarea = () => editor.value.querySelector('textarea')
    const field = useField(props, {
      focusElement: () => getTextarea().focus(),
      blurElement: () => getTextarea().blur()
    })
    const { value, focused, readonly, disabled, getSchemaValue } = field
    const height = ref(null)

    const language = computed(() =>
      getSchemaValue('language', { type: String, default: 'javascript' })
    )

    onMounted(() => {
      const flask = new CodeFlask(editor.value, {
        language: language.value,
        indentSize: getSchemaValue('indentSize', { type: Number, default: 2 }),
        lineNumbers: false
      })

      let ignoreWatch = false
      let ignoreUpdate = false

      const changeOnceEdited = createChangeOnceEdited({
        isEditing: () => focused.value,
        emitChange: () => field.onChange()
      })

      // The textarea is owned by the editor, so its handlers go with it:
      const textarea = getTextarea()
      textarea.addEventListener('focus', () => field.onFocus())
      textarea.addEventListener('blur', () => {
        field.onBlur()
        changeOnceEdited.emitIfDone()
      })

      const setCode = code => {
        if (code !== flask.code) {
          ignoreUpdate = true
          flask.updateCode(code)
        }
      }

      flask.onUpdate(code => {
        if (ignoreUpdate) {
          ignoreUpdate = false
        } else if (code !== value.value) {
          ignoreWatch = true
          value.value = code
          changeOnceEdited.markEdited()
          field.onInput()
          changeOnceEdited.emitIfDone()
        }
      })

      watch(value, code => {
        if (ignoreWatch) {
          ignoreWatch = false
        } else {
          setCode(code || '')
        }
      })

      watch(language, language => flask.updateLanguage(language))

      watch(
        () => readonly.value || disabled.value,
        readonly =>
          readonly ? flask.enableReadonlyMode() : flask.disableReadonlyMode(),
        { immediate: true }
      )

      setCode(value.value || '')
    })

    return {
      ...field,
      height,
      resizable: computed(() =>
        getSchemaValue('resizable', { type: Boolean, default: false })
      ),

      // The styles add the padding to `--lines`, unless the editor was resized:
      style: computed(() =>
        height.value
          ? { height: height.value }
          : { '--lines': getSchemaValue('lines', { type: Number, default: 3 }) }
      )
    }
  }
}

defineType({
  type: 'code',
  component: DitoTypeCode
})

export default DitoTypeCode
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
