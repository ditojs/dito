export function setSelection(field, start, end) {
  if (field.createTextRange) {
    const range = field.createTextRange()
    range.collapse(true)
    range.moveStart('character', start)
    range.moveEnd('character', end)
    range.select()
    field.focus()
  } else if (field.setSelectionRange) {
    field.focus()
    field.setSelectionRange(start, end)
  } else if ('selectionStart' in field) {
    field.selectionStart = start
    field.selectionEnd = end
    field.focus()
  }
}
