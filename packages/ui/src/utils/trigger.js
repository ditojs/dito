// The side and alignment of a `placement`, e.g. `bottom-right`, for reka-ui.
// `bottom-right` lines up the right edges, `bottom` the left ones:
export function getSideAndAlign(placement) {
  const [side, alignment] = placement.split('-')
  const align = (
    { right: 'end', bottom: 'end', center: 'center' }[alignment] ?? 'start'
  )
  return { side, align }
}
