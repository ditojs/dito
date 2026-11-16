<template lang="pug">
PopoverRoot
  //- Infos can sit in buttons, e.g. in the affixes of button fields, which the
  //- click on the info doesn't press:
  PopoverTrigger.dito-info(
    ref="trigger"
    :aria-label="label ? `Info: ${label}` : 'Info'"
    @click.stop
  )
  //- In the pane, outside of the buttons and labels around the info. The popup
  //- is fixed, so that scrolling panes don't clip it, and flips below the info
  //- where the pane has no room above it:
  PopoverPortal(
    :to="pane"
    :disabled="!pane"
  )
    PopoverContent.dito-info__popup(
      side="top"
      :sideOffset="2"
      :collisionBoundary="pane"
      positionStrategy="fixed"
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
import { computed, onMounted, shallowRef, useTemplateRef } from 'vue'
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
    onMounted(() => {
      pane.value = trigger.value.$el.closest('.dito-pane')
    })
    return {
      pane,
      html: computed(() => getHtml(props.info))
    }
  }
}
</script>
