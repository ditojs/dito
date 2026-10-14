import {
  isObject,
  isString,
  isNumber,
  isFunction,
  escapeHtml
} from '@ditojs/utils'
import { getHtml } from '../html.js'
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

// Item labels are HTML, as dialogs and notifications combine them with HTML.
// Item values and labels are text unless they're given as `{ html }`:
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

  let html
  let prefix
  let suffix
  if (isFunction(itemLabel)) {
    const label = evaluateItemLabel()
    if (isObject(label)) {
      ;({ prefix, suffix } = label)
    }
    html = getHtml(label)
    // It's up to `itemLabel()` entirely to produce the label:
    extended = false
  } else if (isString(itemLabel) && !(itemLabel in item)) {
    // `itemLabel` can be both a key, or simply a label:
    html = getHtml(itemLabel)
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
    html = isString(value)
      ? escapeHtml(value)
      : isNumber(value)
        ? value
        : null
  }
  const hadLabel = !!html
  if (html == null) {
    // Generate the label from the index, always in the extended style:
    extended = true
    html = isListSource(sourceSchema) && index != null ? `${index + 1}` : ''
  }
  if (extended) {
    const formLabel = getHtml(getFormLabel())
    if (formLabel) {
      // Quote found labels after the form label:
      html = `${formLabel} ${hadLabel ? `'${html}'` : html}`
    }
  }
  return asObject
    ? html || prefix || suffix
      ? { html, prefix, suffix }
      : null
    : html
}
