import {
  isObject,
  isString,
  isNumber,
  isFunction,
  escapeHtml
} from '@ditojs/utils'
import { isListSource } from './structure.js'
import { getItemId } from './data.js'

// Returns the id of `item`, by which routes address it. Transient items aren't
// stored yet and may lack ids, so they're addressed by their `index` instead,
// when it's known.
export function getItemIdOrIndex(
  sourceSchema,
  item,
  { index = null, isTransient }
) {
  return isTransient && index !== null
    ? String(index)
    : getItemId(sourceSchema, item)
}

// Returns the index of the item in `items` that `itemId` addresses, see
// `getItemIdOrIndex()`, or `null` if there is none. The ids of transient items
// are their indices already, and are returned as they are.
export function findItemIndexById(sourceSchema, items, itemId, {
  isTransient
}) {
  const index = isTransient
    ? itemId
    : items?.findIndex(item => getItemId(sourceSchema, item) === itemId)
  return index != null && index !== -1 ? index : null
}

// Returns the label of `item` as HTML: Values of the item are escaped,
// while labels that the schema provides, e.g. through `itemLabel()`, can
// contain HTML, so they need to escape the values that they include.
// The label depends on the component that displays the item through two
// callbacks: `evaluateItemLabel()` calls `sourceSchema.itemLabel()` with the
// item's context, and `getFormLabel()` returns the label of the item's form.
export function getItemLabel(
  sourceSchema,
  item,
  {
    index = null,
    extended = false,
    asObject = false,
    evaluateItemLabel,
    getFormLabel
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
    // `itemLabel` can be both a key, or simply a label.
    text = itemLabel
  } else {
    // Look up the name on the item, by these rules:
    // 1. If `itemLabel` is a string, use it as the property key
    // 2. Otherwise, if there are columns, use the value of the first
    // 3. Otherwise, see if the item has a property named 'name'
    const { columns } = sourceSchema
    const key = (
      isString(itemLabel) && itemLabel ||
      isListSource(sourceSchema) && columns && Object.keys(columns)[0] ||
      'name'
    )
    const value = item[key]
    // Only primitives display as a label. If the property holds an array
    // or object, fall through to the auto-generated label. Strings are
    // escaped, as the label is rendered as HTML.
    text = isString(value)
      ? escapeHtml(value)
      : isNumber(value)
        ? value
        : null
  }
  const hadLabel = !!text
  // If no label was found so far, try to produce one from the index.
  if (text == null) {
    // Always use extended style when auto-generating labels from index/id:
    extended = true
    text = isListSource(sourceSchema) && index !== null ? `${index + 1}` : ''
  }
  if (extended) {
    const formLabel = getFormLabel()
    if (formLabel) {
      // If a label was provided, put in quotes when prefixed with the
      // form label for the extended style:
      text = `${formLabel} ${hadLabel ? `'${text}'` : text}`
    }
  }
  return asObject
    ? text || prefix || suffix
      ? { text, prefix, suffix }
      : null
    : text
}
