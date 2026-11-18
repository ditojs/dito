// The books of the catalogue, without ids, which the API gives them:
export interface Chapter {
  id?: number
  title: string
  summary: string | null
  order: number | null
}

export interface Book {
  id?: number
  title: string
  author: string
  year: number
  pages: number
  available: boolean
  chapters?: Chapter[]
}

const titles: [string, string, number][] = [
  ['Don Quixote', 'Miguel de Cervantes', 1605],
  ['Pride and Prejudice', 'Jane Austen', 1813],
  ['Emma', 'Jane Austen', 1815],
  ['Persuasion', 'Jane Austen', 1817],
  ['Frankenstein', 'Mary Shelley', 1818],
  ['The Count of Monte Cristo', 'Alexandre Dumas', 1844],
  ['Jane Eyre', 'Charlotte Brontë', 1847],
  ['Wuthering Heights', 'Emily Brontë', 1847],
  ['Vanity Fair', 'William Makepeace Thackeray', 1848],
  ['David Copperfield', 'Charles Dickens', 1850],
  ['Moby-Dick', 'Herman Melville', 1851],
  ['Bleak House', 'Charles Dickens', 1853],
  ['North and South', 'Elizabeth Gaskell', 1854],
  ['Madame Bovary', 'Gustave Flaubert', 1857],
  ['The Woman in White', 'Wilkie Collins', 1859],
  ['Great Expectations', 'Charles Dickens', 1861],
  ['Les Misérables', 'Victor Hugo', 1862],
  ['Crime and Punishment', 'Fyodor Dostoevsky', 1866],
  ['The Moonstone', 'Wilkie Collins', 1868],
  ['Little Women', 'Louisa May Alcott', 1868],
  ['War and Peace', 'Leo Tolstoy', 1869],
  ['Middlemarch', 'George Eliot', 1871],
  ['Far from the Madding Crowd', 'Thomas Hardy', 1874],
  ['Anna Karenina', 'Leo Tolstoy', 1878],
  ['The Portrait of a Lady', 'Henry James', 1881],
  ['Tess of the d’Urbervilles', 'Thomas Hardy', 1891],
  ['Dracula', 'Bram Stoker', 1897]
]

export const books: Book[] = titles.map(([title, author, year], index) => ({
  title,
  author,
  year,
  pages: 180 + ((index * 137) % 700),
  available: index % 3 !== 0,
  chapters: ['Beginning', 'Middle', 'End'].map((title, order) => ({
    title,
    summary: `The ${title.toLowerCase()} of the story.`,
    order
  }))
}))
