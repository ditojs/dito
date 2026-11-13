import { isString } from '@ditojs/utils'

export function getTarget(component) {
  const target = isString(component.target)
    ? component.$refs[component.target]
    : component.target
  return target?.$el ?? target
}

// The side and alignment of a `placement`, e.g. `bottom-right`, for reka-ui.
// `bottom-right` lines up the right edges, `bottom` the left ones:
export function getSideAndAlign(placement) {
  const [side, alignment] = placement.split('-')
  const align = (
    { right: 'end', bottom: 'end', center: 'center' }[alignment] ?? 'start'
  )
  return { side, align }
}
