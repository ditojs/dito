<template lang="pug">
PopoverRoot(
  v-model:open="open"
)
  //- Hovering opens the popup too, after a delay:
  PopoverTrigger.dito-info(
    ref="trigger"
    :aria-label="label ? `Info: ${label}` : 'Info'"
    @pointerenter="onPointerEnter"
    @pointerleave="onPointerLeave"
  )
  //- In the pane, outside of the buttons and labels around the info:
  PopoverPortal(
    :to="pane"
    :disabled="!pane"
  )
    PopoverContent.dito-info__popup(
      v-bind="placement"
      side="top"
      :sideOffset="2"
      :collisionPadding="8"
      @open-auto-focus="onOpenAutoFocus"
      @close-auto-focus="onCloseAutoFocus"
      @pointerenter="onPointerEnter"
      @pointerleave="onPointerLeave"
    )
      .dito-info__content(
        v-html="html"
      )
      PopoverArrow.dito-info__arrow(
        :width="16"
        :height="8"
      )
</template>

<script>
import { computed, onMounted, ref, shallowRef, useTemplateRef } from 'vue'
import {
  PopoverArrow,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger
} from 'reka-ui'
import { usePopupPlacement } from '@ditojs/ui/src'
import { getHtml } from '../utils/html.js'

// An info button that shows `info` in a popup.
export default {
  components: {
    PopoverArrow,
    PopoverContent,
    PopoverPortal,
    PopoverRoot,
    PopoverTrigger
  },

  props: {
    // Text or `html`:
    info: { type: [String, Object], required: true },
    // The text of the label that the info is about, to name the button:
    label: { type: String, default: null }
  },

  setup(props) {
    const trigger = useTemplateRef('trigger')
    const pane = shallowRef(null)
    const placement = usePopupPlacement(() => trigger.value.$el)
    onMounted(() => {
      pane.value = trigger.value.$el.closest('.dito-pane')
    })

    const open = ref(false)
    let timer = null
    // Whether hovering opened the popup, so that it leaves the focus alone:
    let hovered = false
    // Open and close after a delay, so that the pointer can pass over the info
    // and move from it to the popup:
    const setOpenLater = value => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (value && !open.value) {
          hovered = true
        }
        open.value = value
      }, 250)
    }

    return {
      pane,
      placement,
      open,
      html: computed(() => getHtml(props.info)),

      // A mouse that passes over the info doesn't take the focus away from the
      // field that the user types in:
      onOpenAutoFocus(event) {
        if (hovered) {
          event.preventDefault()
        }
      },

      onCloseAutoFocus(event) {
        if (hovered) {
          event.preventDefault()
          hovered = false
        }
      },

      // Only mice hover. Touches and keys toggle the popup with clicks:
      onPointerEnter(event) {
        if (event.pointerType === 'mouse') {
          setOpenLater(true)
        }
      },

      onPointerLeave(event) {
        if (event.pointerType === 'mouse') {
          setOpenLater(false)
        }
      }
    }
  }
}
</script>
