import { test } from './fixtures.js'
import { caseEntries } from './cases/index.js'
import { runCase } from './runner.js'

for (const type of new Set(caseEntries.map(entry => entry.type))) {
  test.describe(type, () => {
    for (const entry of caseEntries.filter(entry => entry.type === type)) {
      test(entry.title, ({ page, url }) => runCase(page, url, entry))
    }
  })
}
