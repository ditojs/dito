// The suffix also holds the clear button.
export function getInputAffixesProps({
  schema,
  disabled,
  clearable,
  value,
  context
}) {
  const prefix = {
    items: schema.prefix ?? null,
    disabled,
    clearable: false,
    hasValue: false,
    parentContext: context
  }
  const suffix = {
    items: schema.suffix ?? null,
    disabled,
    clearable: !!clearable,
    // Empty strings are no value to clear either:
    hasValue: value != null && value !== '',
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

function hasContent({ items, clearable, hasValue }) {
  return !!(items || clearable && hasValue)
}
