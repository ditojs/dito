<template lang="pug">
  component(
    v-if="content"
    :is="options.tag || tag"
    :class="classes"
    :style="styles"
  ) {{ options.text }}
</template>

<script>
import DitoComponent from '../DitoComponent.js'
import { isObject, isString, asArray } from '@ditojs/utils'

// @vue/component
export default DitoComponent.component('dito-element', {
  props: {
    tag: { type: String, default: 'span' },
    content: { type: [String, Object] }
  },

  computed: {
    options() {
      const { content } = this
      return isObject(content) ? content : { text: content }
    },

    classes() {
      return {
        ...this.$attrs.class,
        ...asObject(this.options.class)
      }
    },

    styles() {
      return {
        ...this.$attrs.style,
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
