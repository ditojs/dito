export function shuffle(array) {
  // Do the Fisher-Yates (aka Knuth) Shuffle:
  const res = array.slice()
  for (let i = array.length; i; ) {
    const r = Math.floor(Math.random() * i)
    const t = res[--i]
    res[i] = res[r]
    res[r] = t
  }
  return res
}
