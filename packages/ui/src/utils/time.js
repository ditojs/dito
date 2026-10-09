// Helpers for the time parts of the date and time pickers.

const timePartNames = ['hour', 'minute', 'second', 'millisecond']

export function isTimePartName(name) {
  return timePartNames.includes(name)
}

// Returns the values from 0 to `count - 1` that `isDisabled()` allows.
export function getEnabledValues(count, isDisabled) {
  const values = []
  for (let value = 0; value < count; value++) {
    if (!isDisabled(value)) {
      values.push(value)
    }
  }
  return values
}

// Returns the enabled value that follows `value` in the direction of `step`,
// wrapping around at the ends. `value` itself doesn't need to be enabled.
export function stepEnabledValue(values, value, step) {
  if (values.length === 0) return null
  if (step > 0) {
    return values.find(enabled => enabled > value) ?? values[0]
  } else {
    return values.findLast(enabled => enabled < value) ?? values.at(-1)
  }
}

// Returns `value` if it is enabled, or else the enabled value that follows it.
export function getEnabledValue(values, value) {
  return values.includes(value) ? value : stepEnabledValue(values, value, 1)
}

export function isTimeDisabled(
  date,
  { disabledHour, disabledMinute, disabledSecond }
) {
  return (
    disabledHour(date.getHours()) ||
    disabledMinute(date.getMinutes()) ||
    disabledSecond(date.getSeconds())
  )
}

function isDigit(char) {
  return !isNaN(Number(char))
}

// Edits the time in `input` as the key of the keydown `event` is typed, so
// that digits overwrite the existing ones instead of being inserted, and
// removed digits are replaced with zeros, keeping the time's format intact.
// `formattedLength` is the length of the text of the current value.
export function editTimeText(event, input, formattedLength) {
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
