import { defineEntity, p } from '@mikro-orm/core'

export interface Chooser {
  source?: { topics?: { label: string; value: string }[] }
  topic?: string | null
}

const ArticleSchema = defineEntity({
  name: 'Article',
  properties: {
    id: p.integer().primary(),
    title: p.string(),
    slug: p.string().nullable(),
    titleLength: p.integer().nullable(),
    status: p.string().nullable(),
    category: p.string().nullable(),
    topic: p.string().nullable(),
    chooser: p.json<Chooser>().nullable(),
    lines: p.json<{ amount?: number | null }[]>().nullable(),
    customFactor: p.double().nullable(),
    tags: p.json<string[]>().nullable(),
    version: p.json<number[]>().nullable(),
    references: p.json<{ id: number; title: string }[]>().nullable(),
    keywords: p.json<(string | null)[]>().default([])
  }
})
export class Article extends ArticleSchema.class {}
ArticleSchema.setClass(Article)
