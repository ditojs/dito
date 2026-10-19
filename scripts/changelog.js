// Collects the changelog entries of the unreleased changes, one file per change
// in `changelog/unreleased/`, into a section of the new version at the top of
// `CHANGELOG.md`, and deletes them. Run by the `version` script of `lerna
// version`, after the version is bumped: `node scripts/changelog.js`
//
// Each file holds the entries of one change under the headings of their kind,
// in the format of `CHANGELOG.md`, so that pull requests don't conflict:
//
//   ### New
//
//   - **admin:** …

import fs from 'node:fs'
import path from 'node:path'

const folder = 'changelog/unreleased'
// The kinds of changes in the order of the sections, the others follow:
const order = ['Behaviour changes', 'Deprecations', 'New', 'Fixes', 'Internal']

const { version } = JSON.parse(fs.readFileSync('lerna.json', 'utf8'))
const files = fs
  .readdirSync(folder)
  .filter(file => file.endsWith('.md') && file !== 'README.md')
  .sort()
  .map(file => path.join(folder, file))

const entries = new Map()
for (const file of files) {
  for (const section of fs.readFileSync(file, 'utf8').split(/^### /m)) {
    const [heading, ...lines] = section.split('\n')
    const text = lines.join('\n').trim()
    if (heading && text) {
      entries.set(heading, [...(entries.get(heading) ?? []), text])
    }
  }
}

if (entries.size === 0) {
  console.error(`Unable to find changelog entries in '${folder}'.`)
  process.exit(1)
}

const rank = heading =>
  order.includes(heading) ? order.indexOf(heading) : order.length
const sections = [...entries]
  .sort(([a], [b]) => rank(a) - rank(b))
  .map(([heading, texts]) => `### ${heading}\n\n${texts.join('\n')}\n`)
const date = new Date().toLocaleDateString('sv') // YYYY-MM-DD
const changelog = fs.readFileSync('CHANGELOG.md', 'utf8')
// Insert the new version above the latest one:
const index = changelog.search(/^## /m)
fs.writeFileSync(
  'CHANGELOG.md',
  changelog.slice(0, index) +
  `## ${version} (${date})\n\n${sections.join('\n')}\n` +
  changelog.slice(index)
)
for (const file of files) {
  fs.rmSync(file)
}
