import { test } from '../fixtures.js'
import { caseEntries } from '../cases/index.js'
import { runCase } from '../runner.js'

// Run the plain date cases with the browser in another timezone than the
// server and database, which must not shift dates to another day.

test.describe('date in another timezone', () => {
  test.use({ timezoneId: 'America/New_York' })

  for (const entry of caseEntries) {
    if (entry.type === 'date' && entry.property.type === 'date') {
      test(entry.title, ({ page, url }) => runCase(page, url, entry))
    }
  }
})
