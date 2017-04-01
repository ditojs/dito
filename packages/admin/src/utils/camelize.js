export default function(str) {
  return str.replace(/(?:^|-)(\w)/g, function(all, chr) {
    return chr.toUpperCase()
  })
}
