<template lang="pug">
.dito-dialog(
  ref="dialog"
  :style="{ '--width': width, '--min-width': minWidth }"
)
  //- The dialog stays open until `DitoRoot` removes it. reka-ui only reports
  //- dismissals, see `onOpenChange()`:
  DialogRoot(
    :open="true"
    @update:open="onOpenChange"
  )
    DialogContent.dito-dialog__content(
      :aria-describedby="undefined"
      @open-auto-focus="onOpenAutoFocus"
      @escape-key-down="onEscapeKeyDown"
      @pointer-down-outside="onPointerDownOutside"
    )
      VisuallyHidden
        DialogTitle {{ settings.label || 'Dialog' }}
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
          :store="store"
          padding="root"
          scrollable
          generateLabels
        )
          template(#buttons)
            DitoButtons.dito-dialog__buttons.dito-buttons--large(
              :buttons="buttonSchemas"
              :data="dialogData"
            )
</template>

<script>
import { computed, useTemplateRef } from 'vue'
import { clone, isNumber } from '@ditojs/utils'
import { DialogContent, DialogRoot, DialogTitle, VisuallyHidden } from 'reka-ui'
import { useContainer } from '../composables/useContainer.ts'
import { getButtonSchemas, hasSubmitButton } from '../utils/schema/lookup.js'
import { waitUntilDataModelSettled } from '../utils/services.ts'

export default {
  components: { DialogContent, DialogRoot, DialogTitle, VisuallyHidden },
  emits: ['remove'],

  props: {
    fields: { type: Object, default: () => ({}) },
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
    for (const key in props.fields) {
      if (!(key in initialData)) {
        initialData[key] = null
      }
    }
    const schema = computed(() => ({
      type: 'dialog',
      fields: props.fields
    }))
    const dialog = useTemplateRef('dialog')
    const openedAt = Date.now()

    const resolve = value => {
      props.promise.resolve(value)
      emit('remove')
    }

    // Dialogs render in the root, outside of routes and sources:
    const { dataContext, services, store } = useContainer({
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
          // Add the default click event and the class of the cancel button:
          ([key, schema]) => [
            key,
            key === 'cancel'
              ? {
                  onClick: cancel,
                  ...schema,
                  class: ['dito-dialog__cancel', schema.class]
                }
              : schema
          ]
        )
      )
    )

    return {
      schema,
      store,
      dialogData,
      buttonSchemas,
      submit,

      width: computed(() => toCssLength(props.settings.width)),
      minWidth: computed(() => toCssLength(props.settings.minWidth)),

      onOpenAutoFocus(event) {
        // Focus the element with `autofocus`, or else the first submit or
        // primary button. reka-ui calls this only if no component focused
        // itself, e.g. a multiselect, and focuses the first tabbable element
        // if this doesn't:
        const element = (
          event.target.querySelector('[autofocus]') ||
          event.target.querySelector(
            '.dito-dialog__buttons :is([type="submit"], .dito-button--primary)'
          )
        )
        if (element) {
          event.preventDefault()
          element.focus()
        }
      },

      onEscapeKeyDown(event) {
        // Only dialogs with a cancel button or at most one button can be
        // cancelled. reka-ui passes Escape only to the topmost of its layers,
        // e.g. to a popup in the dialog:
        if (
          !buttonSchemas.value.cancel &&
          Object.keys(buttonSchemas.value).length > 1
        ) {
          event.preventDefault()
        }
      },

      onPointerDownOutside(event) {
        // Close only on presses on the overlay:
        if (
          !props.settings.clickToClose ||
          event.detail.originalEvent.target !== dialog.value
        ) {
          event.preventDefault()
        }
      },

      onOpenChange(open) {
        if (!open) {
          cancel()
        }
      },

      onEnter(event) {
        // Submit on Enter in inputs, also for password managers that simulate
        // an untrusted Enter keypress, which browsers ignore. Prevent the
        // implicit submission of trusted ones, which would submit again:
        if (event.target instanceof HTMLInputElement) {
          event.preventDefault()
          submit()
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
  // reka-ui turns off pointer events on the body while the dialog is open.
  // The overlay takes them, for `clickToClose`:
  pointer-events: auto;

  &__content {
    display: flex;
    max-height: 100%;
  }

  // Place cancel button visually first even though submit comes first in DOM,
  // so that password managers (e.g. 1Password) find the submit button first.
  &__cancel {
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
    // Within the window's padding. Percentages don't resolve in the content,
    // which is as wide as the form:
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
