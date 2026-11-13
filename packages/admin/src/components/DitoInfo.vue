<template lang="pug">
//- In the `TooltipProvider` of `DitoRoot`:
TooltipRoot
  TooltipTrigger(asChild)
    .dito-info(ref="icon")
  //- In the pane, outside of labels, which are buttons or pass clicks on to
  //- their inputs. The tooltip is fixed, so that scrolling panes don't clip
  //- it, and flips below the info where the pane has no room above it:
  TooltipPortal(
    :to="pane"
    :disabled="!pane"
  )
    TooltipContent.dito-tooltip(
      side="top"
      :sideOffset="2"
      :collisionBoundary="pane"
      positionStrategy="fixed"
    )
      .dito-tooltip__content(
        v-html="html"
      )
      TooltipArrow.dito-tooltip__arrow(
        :width="16"
        :height="8"
      )
</template>

<script>
import { computed, onMounted, shallowRef, useTemplateRef } from 'vue'
import {
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  TooltipRoot,
  TooltipTrigger
} from 'reka-ui'
import { getHtml } from '../utils/html.js'

// An info icon that shows `info` in a tooltip, built on reka-ui's `Tooltip`.
export default {
  components: {
    TooltipArrow,
    TooltipContent,
    TooltipPortal,
    TooltipRoot,
    TooltipTrigger
  },

  props: {
    // Text or `html`:
    info: { type: [String, Object], required: true }
  },

  setup(props) {
    const icon = useTemplateRef('icon')
    const pane = shallowRef(null)
    onMounted(() => {
      pane.value = icon.value?.closest('.dito-pane') ?? null
    })
    return {
      pane,
      html: computed(() => getHtml(props.info))
    }
  }
}
</script>
