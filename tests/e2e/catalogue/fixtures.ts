import { defineScenario, ScenarioController } from '../../utils/fixture-app.js'
import { Book } from './models/Book.js'
import { Chapter } from './models/Chapter.js'
import { books } from '../../../examples/showcase/src/data.js'

export { expect } from '@playwright/test'

// A library catalogue that shows the features of list tables: sorting,
// pagination, scopes, filters, and collapsible inlined lists.
class Books extends ScenarioController {
  override modelClass = Book
  override scope = ['^withChapters']
  override graph = true
}

export const test = defineScenario({
  dirname: import.meta.dirname,
  models: { Book, Chapter },
  controllers: { Books },
  beforeEach: async () => {
    await Book.query().insertGraph(books)
  }
})
