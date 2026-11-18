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

// Focus the first part that isn't a literal. reka-ui's parts of disabled
// fields can't take the focus:
export function focusSegment(parts) {
  parts?.find(part => part.$props.part !== 'literal')?.$el.focus()
}
