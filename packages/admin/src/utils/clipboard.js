import { reactive } from 'vue'

// Copied data also serves as fallback when the system clipboard can't be read:
const clipboardState = reactive({ data: null })

// Counts copies and reads, to ignore reads overtaken by newer ones:
let clipboardVersion = 0

export function getClipboardData(schemaName, type) {
  if (!clipboardState.data) {
    return null
  }
  const { $schema, $type, ...data } = clipboardState.data
  // Files paste into all uploads, all other data only into schemas of the same
  // name and type:
  const isMatch = (
    $type === type &&
    (type === 'upload' || $schema === schemaName)
  )
  return isMatch ? data : null
}

export function hasClipboardData(schemaName, type) {
  return !!getClipboardData(schemaName, type)
}

// Mark the data with `$schema`, and with `$type` if it isn't the data of a
// form, e.g. 'list' or 'upload':
export async function copyClipboardData(schemaName, data, type) {
  const clipboardData = data
    ? { $schema: schemaName, $type: type, ...data }
    : null
  clipboardVersion++
  clipboardState.data = clipboardData
  try {
    const json = JSON.stringify(clipboardData, null, 2)
    await navigator.clipboard?.writeText?.(json)
  } catch (error) {
    // The copied data remains available inside the admin.
    console.error(error, error.name, error.message)
  }
}

// Throw `SyntaxError` for content that isn't JSON, and the errors of the
// Clipboard API, leaving the state unchanged.
export async function readClipboardData() {
  const version = ++clipboardVersion
  const json = await navigator.clipboard?.readText?.()
  // Keep the state if the clipboard is empty:
  if (json && version === clipboardVersion) {
    clipboardState.data = JSON.parse(json)
  }
}
