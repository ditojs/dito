import { Author, Book } from './index.js'

const book = new Book()

/** @type {string} */
export const title = book.title
/** @type {Date | null | undefined} */
export const publishedAt = book.publishedAt
/** @type {Date} */
export const createdAt = book.createdAt
/** @type {boolean} */
export const isPublished = book.isPublished
/** @type {string | undefined} */
export const street = book.author?.address?.street
/** @type {Book[] | undefined} */
export const books = book.author?.books

// @ts-expect-error - title is a string
book.title = 1

const author = new Author()
/** @type {string | undefined} */
export const password = author.password
/** @type {import('@ditojs/server').SerializedModel<Author>} */
// @ts-expect-error - hidden properties aren't serialized
export const json = { name: 'Jane', password: 'secret' }
