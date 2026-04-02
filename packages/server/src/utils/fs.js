import fs from 'fs/promises'

export async function exists(path) {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

export async function removeIfEmpty(dir) {
  try {
    if ((await fs.readdir(dir)).length === 0) {
      await fs.rmdir(dir)
      return true
    }
  } catch (err) {
    // The directory may already have been deleted by another async call,
    // fail silently here in this case.
    if (err.code !== 'ENOENT') {
      throw err
    }
  }
  return false
}
