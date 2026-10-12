import { reactive } from 'vue'

// Copied data also serves as fallback when the system clipboard can't be read:
const clipboardState = reactive({ data: null })

// Counts copies and reads, to ignore reads overtaken by newer ones:
let clipboardVersion = 0

export function getClipboardData(schemaName) {
  if (!clipboardState.data) {
    return null
  }
  const { $schema, ...data } = clipboardState.data
  return $schema === schemaName ? data : null
}

export function hasClipboardData(schemaName) {
  return !!getClipboardData(schemaName)
}

// Mark the data with `$schema`, to only paste it into schemas of the same name:
export async function copyClipboardData(schemaName, data) {
  const clipboardData = data ? { $schema: schemaName, ...data } : null
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
