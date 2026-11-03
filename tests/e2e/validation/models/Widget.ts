import { defineEntity, p, StringType } from '@mikro-orm/core'
import { z } from 'zod'

const nameSchema = z.string().min(3)
const emailSchema = z.email()

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

const WidgetSchema = defineEntity({
  name: 'Widget',
  properties: {
    id: p.integer().primary(),
    name: p.string().type(new NameType()),
    email: p.string().type(new EmailType()).nullable()
  }
})
export class Widget extends WidgetSchema.class {}
WidgetSchema.setClass(Widget)
