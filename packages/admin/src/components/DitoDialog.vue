<template lang="pug">
.dito-dialog(
  ref="dialog"
  role="dialog"
  :aria-label="settings.label || 'Dialog'"
  aria-modal="true"
  :style="{ '--width': width, '--min-width': minWidth }"
  @mouseup.self="onMouseUp"
  @keydown="onKeyDown"
)
  UseFocusTrap.dito-dialog__focus-trap(:options="focusTrapOptions")
    form.dito-dialog__form.dito-scroll-parent(
      @submit.prevent="submit"
      @keydown.enter="onEnter"
    )
      // Keep Enter from pressing the clearable buttons:
      button(
        v-show="false"
      )
      DitoSchema(
        :schema="schema"
        :data="dialogData"
        padding="root"
        scrollable
        generateLabels
      )
        template(#buttons)
          DitoButtons.dito-dialog__buttons.dito-buttons--large(
            ref="dialogButtons"
            :buttons="buttonSchemas"
            :data="dialogData"
          )
</template>

<script>
import { computed, useTemplateRef } from 'vue'
import { clone, isNumber } from '@ditojs/utils'
import { UseFocusTrap } from '@vueuse/integrations/useFocusTrap/component'
import { useContainer } from '../composables/useContainer.ts'
import { getButtonSchemas, hasSubmitButton } from '../utils/schema/lookup.js'
import { waitUntilDataModelSettled } from '../utils/services.ts'

export default {
  components: { UseFocusTrap },
  emits: ['remove'],

  props: {
    components: { type: Object, default: () => ({}) },
    buttons: { type: Object, default: null },
    promise: { type: Object, required: true },
    data: { type: Object, default: () => ({}) },
    settings: {
      type: Object,
      default: () => ({ clickToClose: false })
    }
  },

  setup(props, { emit }) {
    // Make sure dialog data contains all the expected keys
    const initialData = clone(props.data)
    for (const key in props.components) {
      if (!(key in initialData)) {
        initialData[key] = null
      }
    }
    const schema = computed(() => ({
      type: 'dialog',
      components: props.components
    }))
    const dialog = useTemplateRef('dialog')
    const dialogButtons = useTemplateRef('dialogButtons')
    const openedAt = Date.now()

    const resolve = value => {
      props.promise.resolve(value)
      emit('remove')
    }

    // Dialogs render in the root, outside of routes and sources:
    const { dataContext, services } = useContainer({
      schema: () => schema.value,
      data: initialData,
      canSave: () => hasSubmitButton(buttonSchemas.value),
      closeDialog: resolve
    })
    const dialogData = computed(() => dataContext.data)

    // Cancelled dialogs resolve with `undefined`, as `null` can be a value:
    const cancel = () => resolve(undefined)

    const submit = async () => {
      // Wait for computed values that depend on pending loads, e.g. options.
      await waitUntilDataModelSettled(services)
      if (dataContext.validate()) {
        // Keep dialogs that are submitted right away, e.g. by password
        // managers, visible for `minDuration`:
        const remaining = (
          (props.settings.minDuration ?? 0) -
          (Date.now() - openedAt)
        )
        if (remaining > 0) {
          await new Promise(resolve => setTimeout(resolve, remaining))
        }
        resolve(dialogData.value)
      }
    }

    const buttonSchemas = computed(() =>
      Object.fromEntries(
        Object.entries(getButtonSchemas(props.buttons) ?? {}).map(
          // Add the default click event of the cancel button:
          ([key, schema]) => [
            key,
            key === 'cancel' ? { onClick: cancel, ...schema } : schema
          ]
        )
      )
    )

    return {
      schema,
      dialogData,
      buttonSchemas,
      submit,

      width: computed(() => toCssLength(props.settings.width)),
      minWidth: computed(() => toCssLength(props.settings.minWidth)),

      focusTrapOptions: {
        immediate: true,
        // Focus the submit button, unless a component has `autofocus` or
        // focused itself, e.g. multiselects. `undefined` falls back to the
        // focused or first tabbable element:
        initialFocus: () => (
          dialog.value.querySelector('[autofocus]') || (
            !dialog.value.contains(document.activeElement) &&
            dialogButtons.value?.$el.querySelector('[type="submit"]')
          ) ||
          undefined
        ),
        fallbackFocus: () => dialog.value,
        // Only dialogs with a cancel button or at most one button can be
        // cancelled, see `onKeyDown()`. The trap is also deactivated on
        // unmount, e.g. after submitting, so it can't cancel then:
        escapeDeactivates: false
      },

      onEnter(event) {
        // Submit on Enter in inputs, also for password managers that simulate
        // an untrusted Enter keypress, which browsers ignore:
        if (event.target instanceof HTMLInputElement) {
          submit()
        }
      },

      onMouseUp() {
        if (props.settings.clickToClose) {
          cancel()
        }
      },

      onKeyDown(event) {
        // Escape keys that the dialog's components handled don't cancel it:
        if (
          event.key === 'Escape' &&
          !event.defaultPrevented && (
            !!buttonSchemas.value.cancel ||
            Object.keys(buttonSchemas.value).length <= 1
          )
        ) {
          event.preventDefault()
          cancel()
        }
      }
    }
  }
}

// Numbers are pixels, strings any CSS length:
function toCssLength(length) {
  return isNumber(length) ? `${length}px` : length
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-dialog {
  $self: &;

  position: fixed;
  display: flex;
  inset: 0;
  z-index: $z-index-dialog;
  padding: $content-padding;
  align-items: center;
  justify-content: center;
  // Prevent scrolling of the page behind the dialog:
  overflow: hidden;
  background: rgb(0, 0, 0, 0.2);

  &__focus-trap {
    display: flex;
    max-height: 100%;
  }

  // Place cancel button visually first even though submit comes first in DOM,
  // so that password managers (e.g. 1Password) find the submit button first.
  .dito-container:has(.dito-button--cancel) {
    order: -1;
  }

  // Keep buttons that are wider than the components off the edges:
  &__buttons {
    padding-inline: $content-padding;
  }

  &__form {
    position: relative;
    display: flex;
    box-sizing: border-box;
    background: white;
    border-radius: $border-radius;
    // The width is that of the content, without the padding around it:
    max-width: calc(var(--width, 35em) + 2 * #{$content-padding});
    // Within the window's padding. Percentages don't resolve in the focus
    // trap, which is as wide as the form:
    min-width: min(
      calc(var(--min-width, 0px) + 2 * #{$content-padding}),
      calc(100vw - 2 * #{$content-padding})
    );
    max-height: 100%;
    box-shadow: 0 20px 60px -2px rgb(27, 33, 58, 0.4);
  }

  &-enter-active,
  &-leave-active {
    transition: opacity 0.15s;

    #{$self}__form {
      transition: transform 0.25s;
    }
  }

  &-enter-from,
  &-leave-to {
    opacity: 0;

    #{$self}__form {
      transform: translateY(-20px);
    }
  }
}
</style>
