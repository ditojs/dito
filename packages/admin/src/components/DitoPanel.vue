<template lang="pug">
  .dito-panel
    .dito-tabs(v-if="tabs")
      template(v-for="(desc, key) in tabs")
        input(type="radio", :id="key", :name="name", :checked="key === selectedTab")
        label(:for="key") {{ desc.label }}
        dito-panel(:descriptions="desc", :data="data", :disabled="disabled")
    ul.dito-list(v-if="components")
      li(v-for="(desc, key) in components")
        dito-label(v-if="desc.label", :name="key", :text="desc.label")
        component(:is="typeToComponent(desc.type)", :name="key",
          :desc="desc", :data="data", :disabled="desc.disabled || disabled")
</template>

<style lang="sass">
// CSS-only tabs, based on: https://kyusuf.com/post/completely-css-tabs
.dito-tabs
  display: flex
  flex-wrap: wrap
  margin: 0.5em 0
  &::after
    // Force width
    content: ''
    width: 100%

  > .dito-panel
    display: none
    padding: 0.25em 0.5em
    background: #fff
    border: 1px solid #ccc
    z-index: 1
    // Visually move panels below all tabs
    order: 100

  > label
    padding: 0.3em 0.5em
    background: #eee
    border: 1px solid #ccc
    // Overlap right and bottom borders
    margin: 0 -1px -1px 0
    cursor: pointer
    user-select: none
    z-index: 2
    &:hover
      background: #ddd
    &:active
      background: #ccc

  > input
    width: 0
    border: 0
    opacity: 0
    margin: 0
    @-moz-document url-prefix()
      // On Firefox, we can't use `display: absolute` along with `opacity> 0` to
      // hide the input, as that would break flex layout. And setting width and
      // border to 0 still produces a 2px border, so we have to offset by 2px
      margin: 0 -2px
    &:focus + label
      border: 0
      margin: 1px 0 0 1px
      box-shadow: 0 0 1px 1px ActiveBorder, inset 0 0 1px 1px ActiveBorder
      z-index: 3
    &:checked + label
      background: #fff
      border-bottom: none
      & + .dito-panel
        display: block
</style>

<script>
import BaseComponent from '@/BaseComponent'

function collect(descriptions, tabs) {
  let res = null
  for (var name in descriptions) {
    let desc = descriptions[name]
    if (typeof desc === 'object' && desc.type !== 'tab' ^ tabs) {
      res = res || {}
      res[name] = desc
    }
  }
  return res
}

export default BaseComponent.component('dito-panel', {
  props: ['name', 'descriptions', 'data', 'disabled'],

  computed: {
    components() {
      return collect(this.descriptions, false)
    },

    tabs() {
      return collect(this.descriptions, true)
    },

    selectedTab() {
      // Return the first key from the tabs object
      return this.tabs && Object.keys(this.tabs)[0]
    }
  }
})
</script>
