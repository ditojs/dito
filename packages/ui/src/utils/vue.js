import { markRaw, onMounted, shallowReactive, useSlots, Comment } from 'vue'
import { isString, asArray } from '@ditojs/utils'
import { getScrollContainer } from './element.js'

export function hasVNodeContent(vnode) {
  return vnode && asArray(vnode).some(vnode => vnode.type !== Comment)
}

export function hasSlotContent(slot, props = {}) {
  slot = isString(slot) ? useSlots()[slot] : slot
  return hasVNodeContent(slot?.(props))
}

export function raw(value) {
  return markRaw({ value })
}

// The props of reka-ui's popup contents that place them: fixed, so that
// scrolling panels don't clip them, and inside the closest container that
// scrolls around the element that `getElement()` returns once mounted:
export function usePopupPlacement(getElement) {
  const placement = shallowReactive({
    positionStrategy: 'fixed',
    collisionBoundary: null
  })
  onMounted(() => {
    placement.collisionBoundary = getScrollContainer(getElement())
  })
  return placement
}
