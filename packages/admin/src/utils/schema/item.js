import {
  isObject,
  isString,
  isNumber,
  isFunction,
  isHtml,
  html
} from '@ditojs/utils'
import { getContent, getHtml } from '../html.js'
import { isListSource } from './structure.js'
import { getItemId } from './data.js'
import { getNamedSchemas } from './lookup.js'

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

// Item labels are `html`, as dialogs and notifications combine them with HTML.
// Item values and labels are text unless they're marked with `html`:
export function getItemLabel(
  sourceSchema,
  item,
  {
    index,
    extended = false,
    asObject = false,
    evaluateItemLabel,
    getFormLabel,
    getDisplayValue
  }
) {
  const { itemLabel } = sourceSchema
  if (!item || !extended && itemLabel === false) {
    return null
  }

  let label
  let prefix
  let suffix
  if (isFunction(itemLabel)) {
    const result = evaluateItemLabel()
    if (isObject(result) && !isHtml(result)) {
      ;({ prefix, suffix } = result)
    }
    label = getContent(result)
    // It's up to `itemLabel()` entirely to produce the label:
    extended = false
  } else if (isString(itemLabel) && !(itemLabel in item)) {
    // `itemLabel` can be both a key, or simply a label:
    label = itemLabel
  } else {
    // Use `itemLabel` as key, or else the first column, or else `name`:
    const columns = getNamedSchemas(sourceSchema.columns)
    const key = (
      isString(itemLabel) && itemLabel ||
      isListSource(sourceSchema) && columns && Object.keys(columns)[0] ||
      'name'
    )
    const value = getDisplayValue(key)
    // Arrays and objects fall through to the generated label:
    label = isString(value) || isNumber(value) ? value : null
  }
  const hadLabel = !!getHtml(label)
  if (label == null) {
    // Generate the label from the index, always in the extended style:
    extended = true
    label = isListSource(sourceSchema) && index != null ? `${index + 1}` : ''
  }
  if (extended) {
    const formLabel = getContent(getFormLabel())
    if (getHtml(formLabel)) {
      // Quote found labels after the form label:
      label = hadLabel
        ? html`${formLabel} '${label}'`
        : html`${formLabel} ${label}`
    }
  }
  label = html`${label}`
  return asObject
    ? label.value || prefix || suffix
      ? { text: label, prefix, suffix }
      : null
    : label
}
