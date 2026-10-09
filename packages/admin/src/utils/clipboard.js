import { reactive } from 'vue'

// The clipboard data that the admin knows of, shared by all clipboard buttons:
// The data last copied, or read from the system clipboard. Copied data also
// serves as fallback when the system clipboard can't be read.
const clipboardState = reactive({
  data: null
})

// Counts the copies and the reads of the system clipboard, so that the result
// of a read is ignored when a newer copy or read started in the meantime.
let clipboardVersion = 0

// Returns the clipboard data if it was copied from a schema named
// `schemaName`, without the `$schema` marker, otherwise `null`. Reactive, so
// it can be used in computed properties.
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

// Copies `data` of the schema named `schemaName`, marked with `$schema` so
// that it can only be pasted into schemas of the same name.
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

// Reads the system clipboard into the clipboard state. Throws a `SyntaxError`
// when its content isn't JSON, and the errors of the Clipboard API, e.g. when
// reading isn't permitted. In both cases, the state remains unchanged.
export async function readClipboardData() {
  const version = ++clipboardVersion
  const json = await navigator.clipboard?.readText?.()
  // Ignore the result if a newer copy or read started in the meantime, as it
  // may be outdated, and keep the state if the clipboard is empty.
  if (json && version === clipboardVersion) {
    clipboardState.data = JSON.parse(json)
  }
}
