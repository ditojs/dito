import { reactive } from 'vue'

// Copied data also serves as fallback when the system clipboard can't be read:
const clipboardState = reactive({ data: null })

// Counts copies and reads, to ignore reads overtaken by newer ones:
let clipboardVersion = 0

// Mark the data with `$schema`, and with `$type` if it isn't the data of a
// form, e.g. 'list' or 'upload':
export function createClipboardData(schemaName, data, type) {
  return data ? { $schema: schemaName, $type: type, ...data } : null
}

// Files paste into all uploads, all other data only into schemas of the same
// name and type:
export function matchClipboardData(clipboardData, schemaName, type) {
  if (!clipboardData) {
    return null
  }
  const { $schema, $type, ...data } = clipboardData
  const isMatch = (
    $type === type &&
    (type === 'upload' || $schema === schemaName)
  )
  return isMatch ? data : null
}

export function getClipboardData(schemaName, type) {
  return matchClipboardData(clipboardState.data, schemaName, type)
}

export function hasClipboardData(schemaName, type) {
  return !!getClipboardData(schemaName, type)
}

export async function copyClipboardData(schemaName, data, type) {
  const clipboardData = createClipboardData(schemaName, data, type)
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
