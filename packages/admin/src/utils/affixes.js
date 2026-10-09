// Returns the props of the `DitoInputAffixes` of the input of a type
// component, by position: The prefix and suffix items come from
// `schema.prefix` and `schema.suffix`. The suffix also holds the clear button
// of clearable components with a value, and their info when they have no label
// to show it, as the label component shows the info otherwise.
export function getInputAffixesProps({
  schema,
  disabled,
  clearable,
  value,
  label,
  info,
  context
}) {
  return {
    prefix: {
      items: schema.prefix ?? null,
      disabled,
      clearable: false,
      hasValue: false,
      inlineInfo: null,
      parentContext: context
    },
    suffix: {
      items: schema.suffix ?? null,
      disabled,
      clearable: !!clearable,
      hasValue: value != null,
      inlineInfo: (!label && info) || null,
      parentContext: context
    }
  }
}
