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
  const prefix = {
    items: schema.prefix ?? null,
    disabled,
    clearable: false,
    hasValue: false,
    inlineInfo: null,
    parentContext: context
  }
  const suffix = {
    items: schema.suffix ?? null,
    disabled,
    clearable: !!clearable,
    // Empty strings are no value to clear either:
    hasValue: value != null && value !== '',
    inlineInfo: (!label && info) || null,
    parentContext: context
  }
  return {
    prefix,
    suffix,
    // Most fields have no affixes, so we only mount the ones with content:
    hasPrefix: hasContent(prefix),
    hasSuffix: hasContent(suffix)
  }
}

function hasContent({ items, clearable, hasValue, inlineInfo }) {
  return !!(items || clearable && hasValue || inlineInfo)
}
