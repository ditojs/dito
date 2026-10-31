// What ORM packages build their model controllers with, from
// `@ditojs/server-next/base`: the base layer of default verbs and slots, and
// the parsed list parameters that their default `get` applies.

export { withBase } from './define.ts'
export { parseListQuery } from './list-query.ts'
export type { ListQuery, Slots } from './types.ts'
