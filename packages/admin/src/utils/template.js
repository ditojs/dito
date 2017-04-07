// Lifted and adapted from vue/src/compiler/parser/text-parser.js

export function parse(text) {
  const exp = /\{\{((?:.|\n)+?)\}\}/g
  if (exp.test(text)) {
    const parts = []
    let lastIndex = exp.lastIndex = 0
    let match, index
    while ((match = exp.exec(text))) {
      index = match.index
      // push text token
      if (index > lastIndex) {
        parts.push(JSON.stringify(text.slice(lastIndex, index)))
      }
      // tag token
      parts.push(match[1].trim())
      lastIndex = index + match[0].length
    }
    if (lastIndex < text.length) {
      parts.push(JSON.stringify(text.slice(lastIndex)))
    }
    return parts.join('+')
  }
}

export function compile(text, ...parameters) {
  return new Function(...(parameters || []).concat(`return ${parse(text)}`))
}
