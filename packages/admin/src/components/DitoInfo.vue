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
  //- In the pane, outside of the buttons and labels around the info. The popup
  //- is fixed, so that scrolling panes don't clip it, and stays in the scroll
  //- area of the info, e.g. a sidebar, flipping below the info where it has no
  //- room above it:
  PopoverPortal(
    :to="pane"
    :disabled="!pane"
  )
    PopoverContent.dito-info__popup(
      side="top"
      :sideOffset="2"
      :collisionBoundary="scrollArea"
      :collisionPadding="8"
      positionStrategy="fixed"
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
    const scrollArea = shallowRef(null)
    onMounted(() => {
      const element = trigger.value.$el
      pane.value = element.closest('.dito-pane')
      scrollArea.value = element.closest('.dito-scroll')
    })

    const open = ref(false)
    let timer = null
    // Open and close after a delay, so that the pointer can pass over the info
    // and move from it to the popup:
    const setOpenLater = value => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        open.value = value
      }, 250)
    }

    return {
      pane,
      scrollArea,
      open,
      html: computed(() => getHtml(props.info)),

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
