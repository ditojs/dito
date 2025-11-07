<template lang="pug">
component(
  v-if="options?.text != null"
  :is="tagName"
  :class="classes"
  :style="styles"
) {{ options.text }}
component(
  v-else-if="options?.html != null"
  :is="tagName"
  :class="classes"
  :style="styles"
  v-html="options.html"
)
</template>

<script>
import DitoComponent from '../DitoComponent.js'
import { isObject, isString, asArray } from '@ditojs/utils'

// @vue/component
export default DitoComponent.component('DitoElement', {
  props: {
    as: { type: String, default: 'span' },
    content: { type: [String, Object], default: null }
  },

  computed: {
    options() {
      const { content } = this
      return content != null
        ? isObject(content)
          ? content
          : { text: content }
        : null
    },

    tagName() {
      return this.options.as || this.as
    },

    classes() {
      return {
        ...asObject(this.$attrs.class),
        ...asObject(this.options.class)
      }
    },

    styles() {
      return {
        ...asObject(this.$attrs.style),
        ...asObject(this.options.style)
      }
    }
  }
})

function asObject(value) {
  return asArray(value).reduce((object, entry) => {
    if (isString(entry)) {
      object[entry] = true
    } else if (isObject(entry)) {
      Object.assign(object, entry)
    }
    return object
  }, {})
}
</script>
