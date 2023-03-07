import fs from 'fs/promises'

export async function exists(path) {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}
