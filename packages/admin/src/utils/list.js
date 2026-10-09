// Returns a copy of `list` with `item` moved by `delta` positions, e.g. by -1
// to move it up by one, or `null` if `item` isn't in `list` or can't move that
// far. The item is looked up by identity, see `DitoDragHandle`.
export function getListWithMovedItem(list, item, delta) {
  const index = list.indexOf(item)
  const newIndex = index + delta
  return index >= 0 && delta !== 0 && newIndex >= 0 && newIndex < list.length
    ? list.toSpliced(index, 1).toSpliced(newIndex, 0, item)
    : null
}
