// The parts of date and time fields that hold numbers. reka-ui shows them as
// letters or dashes while they're empty, and as digits once entered:
const numberParts = ['year', 'month', 'day', 'hour', 'minute', 'second']

export function isEnteredSegment({ part, value }) {
  return numberParts.includes(part) && /\p{Nd}/u.test(value)
}

export function getSegmentClasses(segment) {
  return {
    'dito-date-segments__part--literal': segment.part === 'literal',
    'dito-date-segments__part--empty': (
      numberParts.includes(segment.part) && !isEnteredSegment(segment)
    )
  }
}

// The part that `element` is, unless it's a literal:
export function findSegment(parts, element) {
  return parts?.find(
    part => part.$el === element && part.$props.part !== 'literal'
  )
}

// Focus the part called `name`, or the first that isn't a literal. reka-ui's
// parts of disabled fields can't take the focus:
export function focusSegment(parts, name) {
  const segment = parts?.find(({ $props }) =>
    name ? $props.part === name : $props.part !== 'literal'
  )
  segment?.$el.focus()
}
