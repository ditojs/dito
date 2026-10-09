import { labelize } from '@ditojs/utils'

// Returns the attributes of buttons that perform `verb`, e.g. 'delete': the
// modifier class that styles the verb, and the label of buttons that don't
// display text, named by the verb and by its `subject` if known, e.g.
// 'Add Section'. `hasText` states whether the button displays text, which it
// does by default when `text` is set.
export function getVerbButtonAttributes({
  verb,
  subject = null,
  text = null,
  hasText = !!text
}) {
  const label = hasText
    ? null
    : `${labelize(verb)}${subject ? ` ${subject}` : ''}`
  return {
    class: `dito-button--${verb}`,
    ...(label && {
      'title': label,
      'aria-label': label
    })
  }
}
