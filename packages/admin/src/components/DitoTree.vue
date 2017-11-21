<template lang="pug">
  .dito-tree
    template(v-if="isObject(data) || isArray(data)")
      .dito-tree-item(@click.stop="opened = !opened")
        .dito-tree-key.dito-tree-chevron(
          v-if="!root"
          :class="{ opened }"
        ) {{ getName() }}
        .dito-tree-info(v-if="!opened") {{ getChildrenInfo() }}
      dito-tree.dito-tree-children(
        v-show="opened"
        v-for="(child, key) in data"
        :key="key"
        :name="key"
        :data="child"
        :open="childrenOpen")
    template(v-else)
      .dito-tree-key {{ getName() }}
      .dito-tree-value {{ getValue() }}
</template>

<style lang="sass">
.dito
  .dito-tree
    .dito-tree-children
      .dito-tree
        margin-left: 18px

    .dito-tree-item
      cursor: pointer
      position: relative
      +user-select(none)

    .dito-tree-key,
    .dito-tree-value,
    .dito-tree-info
      display: inline

    .dito-tree-key
      font-weight: bold

    .dito-tree-info
      color: $color-light

    .dito-tree-chevron
      padding-left: 14px
      &::before
        color: #444
        content: '\25b6'
        font-size: 0.8em
        position: absolute
        top: 0.25em
        left: 0
        transition: transform .1s ease
      &.opened::before
        left: -0.1em
        transform: rotate(90deg)
</style>

<script>
import DitoComponent from '@/DitoComponent'
import { isObject, isArray, isString } from '@/utils'

export default DitoComponent.component('dito-tree', {
  props: ['name', 'data', 'root', 'open', 'childrenOpen'],

  data() {
    return {
      opened: this.open
    }
  },

  methods: {
    isObject,
    isArray,

    getName() {
      return (isString(this.name) ? `"${this.name}": ` : this.name)
    },

    getValue() {
      const value = this.data
      return value === null ? 'null'
        : isString(value) ? `"${value}"`
        : value
    },

    getChildrenInfo() {
      const { data } = this
      const array = isArray(data)
      const count = array ? data.length : Object.keys(data).length
      const suffix = array
        ? count === 1 ? 'item' : 'items'
        : count === 1 ? 'property' : 'properties'
      return ` ${count} ${suffix}`
    }
  }
})
</script>
