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
// The kinds of changes in the order of the sections, and the packages in the
// order of their entries in each section, the others follow:
const kinds = ['Behaviour changes', 'Deprecations', 'New', 'Fixes', 'Internal']
const packages = ['server', 'admin', 'ui', 'router', 'schema', 'utils', 'build']

const { version } = JSON.parse(fs.readFileSync('lerna.json', 'utf8'))
const files = fs
  .readdirSync(folder)
  .filter(file => file.endsWith('.md') && file !== 'README.md')
  .sort()
  .map(file => path.join(folder, file))

const entries = new Map()
for (const file of files) {
  const [text, ...sections] = fs.readFileSync(file, 'utf8').split(/^### /m)
  if (text.trim()) {
    fail(`Invalid text before the first heading in '${file}'.`)
  }
  if (sections.length === 0) {
    fail(`Unable to find changelog entries in '${file}'.`)
  }
  for (const section of sections) {
    const [heading, ...lines] = section.split('\n')
    // Each entry is a list item, with its indented lines:
    const items = lines
      .join('\n')
      .split(/\n(?=- )/)
      .map(item => item.trim())
      .filter(Boolean)
    if (!kinds.includes(heading)) {
      fail(`Unknown heading '### ${heading}' in '${file}'.`)
    }
    if (items.length === 0) {
      fail(`Unable to find entries under '### ${heading}' in '${file}'.`)
    }
    entries.set(heading, [...(entries.get(heading) ?? []), ...items])
  }
}

if (entries.size === 0) {
  fail(`Unable to find changelog entries in '${folder}'.`)
}

const rank = (list, value) =>
  list.includes(value) ? list.indexOf(value) : list.length
// Entries for several packages, like `**server, admin:**`, sort by the first:
const getPackage = item => item.match(/^- \*\*([a-z]+)/)?.[1]
const sections = [...entries]
  .sort(([a], [b]) => rank(kinds, a) - rank(kinds, b))
  .map(([heading, items]) => {
    const sorted = items.toSorted(
      (a, b) => rank(packages, getPackage(a)) - rank(packages, getPackage(b))
    )
    return `### ${heading}\n\n${sorted.join('\n')}\n`
  })
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

function fail(message) {
  console.error(message)
  process.exit(1)
}
