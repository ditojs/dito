import { reactive } from 'vue'
import appState from '../appState.js'

// Copied data also serves as fallback when the system clipboard can't be read:
const clipboardState = reactive({ data: null })

// Counts copies and reads, to ignore reads overtaken by newer ones:
let clipboardVersion = 0

let isWatchingClipboard = false

// Mark the data with `$name`, and with `$type` if it isn't the data of a
// form, e.g. 'list' or 'upload':
export function createClipboardData(name, data, type) {
  return data ? { $name: name, $type: type, ...data } : null
}

// Name copies by the first name of the clipboards of the schemas, or else by
// the first name of the schemas, e.g. of a form and of the source of its item:
export function getClipboardName(...schemas) {
  const findName = getName => schemas.map(getName).find(Boolean)
  return (
    findName(schema => schema?.clipboard?.name) ||
    findName(schema => schema?.name) ||
    null
  )
}

// Files paste into all uploads, all other data only into schemas of the same
// name and type, and never without a name:
export function matchClipboardData(clipboardData, name, type) {
  if (!clipboardData) {
    return null
  }
  const { $name, $type, ...data } = clipboardData
  const isMatch = (
    $type === type &&
    (type === 'upload' || $name && $name === name)
  )
  return isMatch ? data : null
}

export function getClipboardData(name, type) {
  return matchClipboardData(clipboardState.data, name, type)
}

export function hasClipboardData(name, type) {
  return !!getClipboardData(name, type)
}

export async function copyClipboardData(name, data, type) {
  const clipboardData = createClipboardData(name, data, type)
  const json = JSON.stringify(clipboardData, null, 2)
  clipboardVersion++
  // Hold the data as the system clipboard does, without `undefined` values:
  clipboardState.data = JSON.parse(json)
  try {
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

// Read the system clipboard once for all clipboards, and again when it can
// change, on copy and window focus:
export function watchClipboardData() {
  if (!isWatchingClipboard) {
    isWatchingClipboard = true
    updateClipboardData()
    document.addEventListener('copy', updateClipboardData)
    window.addEventListener('focus', updateClipboardData)
  }
}

function updateClipboardData() {
  // Only Chrome reads the clipboard without asking for permission:
  if (appState.agent.chrome) {
    readClipboardData().catch(() => {}) // Report errors only when pasting.
  }
}
