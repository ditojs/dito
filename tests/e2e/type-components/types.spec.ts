import { test } from './fixtures.js'
import { caseEntries } from './cases/index.js'
import { runCase } from './runner.js'

// Each worker has its own app and database, so cases can run in parallel.
test.describe.configure({ mode: 'parallel' })

for (const type of new Set(caseEntries.map(entry => entry.type))) {
  test.describe(type, () => {
    for (const entry of caseEntries.filter(entry => entry.type === type)) {
      test(entry.title, ({ page, url }) => runCase(page, url, entry))
    }
  })
}
