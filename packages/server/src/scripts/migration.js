import path from 'path'
import fs from 'fs-extra'

async function createMigration(modelName) {
  const filename = `${yyyymmddhhmmss()}_${modelName}.js`
  const migrationDir = path.join(process.cwd(), 'migrations')
  const file = path.join(migrationDir, filename)
  // TODO: Create migration code from modelName.properties and
  // modelName.relations content!
  await fs.writeFile(file, modelName)
  process.exit()
}

// Ensure that we have 2 places for each of the date segments.
function padDate(segment) {
  return segment.toString().padStart(2, '0')
}

// Get a date object in the correct format, without requiring a full out library
// like "moment.js".
function yyyymmddhhmmss() {
  const d = new Date()
  return d.getFullYear().toString() +
    padDate(d.getMonth() + 1) +
    padDate(d.getDate()) +
    padDate(d.getHours()) +
    padDate(d.getMinutes()) +
    padDate(d.getSeconds())
}

createMigration(process.argv[2])
