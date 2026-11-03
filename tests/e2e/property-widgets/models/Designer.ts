import { defineEntity, IntegerType, p, StringType } from '@mikro-orm/core'
import { schemaJson } from '@ditojs/mikro'
import { z } from 'zod'

// The server checks the lengths of names and titles, which the admin doesn't,
// so that its errors are routed to the widgets:
const nameSchema = z.string().max(20)
const emailSchema = z.email()
const rankSchema = z.int().min(1)

class NameType extends StringType {
  get schema() {
    return nameSchema
  }
}

class EmailType extends StringType {
  get schema() {
    return emailSchema
  }
}

class RankType extends IntegerType {
  get schema() {
    return rankSchema
  }
}

const awardSchema = z.object({
  title: z.string().max(12),
  year: z.int().nullish()
})

export type Award = z.infer<typeof awardSchema>

const DesignerSchema = defineEntity({
  name: 'Designer',
  properties: {
    id: p.integer().primary(),
    name: p.string().type(new NameType()),
    email: p.string().type(new EmailType()).nullable(),
    isFeatured: p.boolean().default(false),
    rank: p.integer().type(new RankType()).nullable(),
    awards: schemaJson(z.array(awardSchema)).nullable(),
    address: schemaJson(z.object({ city: z.string().optional() })).nullable()
  }
})
export class Designer extends DesignerSchema.class {}
DesignerSchema.setClass(Designer)
