// The suffix also holds the clear button, and the info of components without a
// label, as the label shows it otherwise.
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
