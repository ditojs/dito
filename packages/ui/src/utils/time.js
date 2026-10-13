// Helpers for the time parts of the date and time pickers.

const timePartNames = ['hour', 'minute', 'second', 'millisecond']

export function isTimePartName(name) {
  return timePartNames.includes(name)
}

function isDigit(char) {
  return /^\d$/.test(char)
}

// Edits the time in `input` as the key of the keydown `event` is typed, so
// that digits overwrite the existing ones instead of being inserted, and
// removed digits are replaced with zeros, keeping the time's format intact.
// `formattedLength` is the length of the text of the current value.
export function editTimeText(event, input, formattedLength) {
  // Leave keyboard shortcuts alone, e.g. Cmd+A, Ctrl+V or Cmd+Z, but not the
  // characters typed with Option on macOS or with AltGr (Ctrl+Alt) elsewhere.
  if (event.metaKey || (event.ctrlKey && !event.altKey)) return
  const start = input.selectionStart
  if (start !== input.selectionEnd) return
  const { value } = input
  let position = start
  if (event.key.length === 1) {
    if (isDigit(event.key) && position < value.length) {
      if (
        value[position] === ':' &&
        isDigit(value[position - 1]) &&
        isDigit(value[position - 2])
      ) {
        position++
      }
      // Remove next digit so the event overrides it instead of inserting new
      // chars.
      if (
        isDigit(value[position]) && (
          isDigit(value[position + 1]) ||
          isDigit(value[position - 1])
        )
      ) {
        input.value = value.slice(0, position) + value.slice(position + 1)
        input.setSelectionRange(position, position)
      }
    } else if (value.length === formattedLength) {
      event.preventDefault()
    } else if (value.length > formattedLength) {
      input.value = value.slice(0, formattedLength)
      input.setSelectionRange(start, start)
      event.preventDefault()
    }
  } else if (event.key === 'Backspace') {
    if (position === 1 || [' ', ':'].includes(value[position - 2])) {
      if (position === value.length || value[position] === ':') {
        position--
        input.value = (
          value.slice(0, position) +
          ((value[position - 1] ?? '') + '00') +
          value.slice(position + 1)
        )
        input.setSelectionRange(position, position)
      } else if (isDigit(value[position]) && !isDigit(value[position + 1])) {
        // When removing the first of two digits, replace with 0
        input.value = value.slice(0, position) + '0' + value.slice(position)
        input.setSelectionRange(position, position)
      }
    }
  }
}
