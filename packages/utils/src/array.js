import { isArray } from './base'

export function flatten(array, maxDepth = Infinity, _depth = 0) {
  const res = []
  for (let i = 0, l = array.length; i < l; i++) {
    const value = array[i]
    if (_depth < maxDepth && isArray(value)) {
      res.push(...flatten(value, maxDepth, _depth + 1))
    } else {
      res.push(value)
    }
  }
  return res
}

export function shuffle(array) {
  // Do the Fisher-Yates (aka Knuth) Shuffle:
  const res = array.slice()
  for (let i = array.length; i;) {
    const r = Math.floor(Math.random() * i)
    const t = res[--i]
    res[i] = res[r]
    res[r] = t
  }
  return res
}
