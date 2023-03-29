import { useSlots, Comment } from 'vue'
import { isString, asArray } from '@ditojs/utils'

export function hasVNodeContent(vnode) {
  return vnode && asArray(vnode).some(vnode => vnode.type !== Comment)
}

export function hasSlotContent(slot, props = {}) {
  slot = isString(slot) ? useSlots()[slot] : slot
  return hasVNodeContent(slot?.(props))
}
