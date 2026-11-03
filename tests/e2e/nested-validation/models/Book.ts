import { defineEntity, p, StringType } from '@mikro-orm/core'
import { schemaJson } from '@ditojs/mikro'
import { z } from 'zod'

// Titles must start with an uppercase letter. Only the server knows this rule,
// so the admin learns about violations through the server's errors.
const title = z.string().regex(/^[A-Z]/)
const optionalTitle = title.nullish()

class TitleType extends StringType {
  get schema() {
    return title
  }
}

const BookSchema = defineEntity({
  name: 'Book',
  properties: {
    id: p.integer().primary(),
    title: p.string().type(new TitleType()),
    subtitle: p.string().type(new TitleType()).nullable(),
    edition: p.string().nullable(),
    publisher: p.string().nullable(),
    meta: schemaJson(z.object({ note: optionalTitle })).nullable(),
    credits: p.json<{ editor?: string | null }>().nullable(),
    tags: schemaJson(z.array(z.object({ name: optionalTitle }))).onCreate(
      () => []
    ),
    chapters: schemaJson(
      z.array(
        z.object({
          title: optionalTitle,
          summary: z.string().nullish(),
          sections: z.array(z.object({ title: optionalTitle })).nullish()
        })
      )
    ).onCreate(() => []),
    volumes: schemaJson(
      z.array(
        z.object({
          title: optionalTitle,
          parts: z.array(z.object({ title: optionalTitle })).nullish()
        })
      )
    ).onCreate(() => [])
  }
})
export class Book extends BookSchema.class {}
BookSchema.setClass(Book)
