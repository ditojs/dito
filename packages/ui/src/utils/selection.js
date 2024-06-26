export function setSelection(input, { start, end }) {
  if (input?.setSelectionRange) {
    input.focus()
    input.setSelectionRange(start, end)
  }
}

export function getSelection(input) {
  return input && 'selectionStart' in input
    ? { start: input.selectionStart, end: input.selectionEnd }
    : null
}
