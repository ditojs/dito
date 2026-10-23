import { isArray } from '../base/index.js'
import { escapeHtml } from './escapeHtml.js'

const SYMBOL_HTML = Symbol.for('dito.html')

class Html {
  constructor(value) {
    this.value = value
  }

  // The brand by which `isHtml()` recognizes the values of `html`, also across
  // copies of this module:
  get [SYMBOL_HTML]() {
    return true
  }

  toString() {
    return this.value
  }
}

export function html(strings, ...values) {
  return new Html(
    strings.reduce(
      (result, string, index) => result + toHtml(values[index - 1]) + string
    )
  )
}

export function isHtml(arg) {
  return !!arg?.[SYMBOL_HTML]
}

// The HTML of `Html` values, and of anything else as escaped text:
export function asHtml(arg) {
  return isHtml(arg) ? arg.value : escapeHtml(arg)
}

function toHtml(value) {
  return isArray(value)
    ? value.map(toHtml).join('')
    : value === false
      ? ''
      : asHtml(value)
}
