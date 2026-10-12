import {
  isObject,
  isString,
  isNumber,
  isFunction,
  escapeHtml
} from '@ditojs/utils'
import { isListSource } from './structure.js'
import { getItemId } from './data.js'

// Address transient items by their index, as they may lack ids:
export function getItemIdOrIndex(
  sourceSchema,
  item,
  { index, isTransient }
) {
  return isTransient && index != null
    ? String(index)
    : getItemId(sourceSchema, item)
}

// The ids of transient items are their indices already:
export function findItemIndexById(sourceSchema, items, itemId, {
  isTransient
}) {
  const index = isTransient
    ? itemId
    : items?.findIndex(item => getItemId(sourceSchema, item) === itemId)
  return index != null && index !== -1 ? index : null
}

// Labels are HTML: We escape the values of the item, while labels from the
// schema may contain HTML and need to escape the values they include.
export function getItemLabel(
  sourceSchema,
  item,
  {
    index,
    extended = false,
    asObject = false,
    evaluateItemLabel,
    getFormLabel,
    getValueText
  }
) {
  const { itemLabel } = sourceSchema
  if (!item || !extended && itemLabel === false) {
    return null
  }

  let text
  let prefix
  let suffix
  if (isFunction(itemLabel)) {
    const label = evaluateItemLabel()
    if (isObject(label)) {
      ;({ text, prefix, suffix } = label)
    } else {
      text = label
    }
    // It's up to `itemLabel()` entirely to produce the label:
    extended = false
  } else if (isString(itemLabel) && !(itemLabel in item)) {
    // `itemLabel` can be both a key, or simply a label:
    text = itemLabel
  } else {
    // Use `itemLabel` as key, or else the first column, or else `name`:
    const { columns } = sourceSchema
    const key = (
      isString(itemLabel) && itemLabel ||
      isListSource(sourceSchema) && columns && Object.keys(columns)[0] ||
      'name'
    )
    const value = getValueText(key)
    // Arrays and objects fall through to the generated label:
    text = isString(value)
      ? escapeHtml(value)
      : isNumber(value)
        ? value
        : null
  }
  const hadLabel = !!text
  if (text == null) {
    // Generate the label from the index, always in the extended style:
    extended = true
    text = isListSource(sourceSchema) && index != null ? `${index + 1}` : ''
  }
  if (extended) {
    const formLabel = getFormLabel()
    if (formLabel) {
      // Quote found labels after the form label:
      text = `${formLabel} ${hadLabel ? `'${text}'` : text}`
    }
  }
  return asObject
    ? text || prefix || suffix
      ? { text, prefix, suffix }
      : null
    : text
}
