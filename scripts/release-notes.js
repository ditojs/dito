// Prints the section of a version in `CHANGELOG.md`, without its heading, as
// the notes of its GitHub release: `node scripts/release-notes.js v4.8.0`

import fs from 'node:fs'

const version = process.argv[2]?.replace(/^v/, '')
const section = fs
  .readFileSync('CHANGELOG.md', 'utf8')
  .split(/^## /m)
  .find(section => section.startsWith(`${version} `))
const notes = section?.replace(/^.*/, '').trim()

if (version && notes) {
  process.stdout.write(`${notes}\n`)
} else {
  console.error(`Unable to find the changelog of version '${version}'.`)
  process.exit(1)
}
