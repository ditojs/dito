import { defineEntity, p } from '@mikro-orm/core'

export interface Widget {
  title?: string | null
  sizes?: Record<string, { columns?: number | null }> | null
}

const DashboardSchema = defineEntity({
  name: 'Dashboard',
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    widgets: p.json<Widget[]>().nullable()
  }
})
export class Dashboard extends DashboardSchema.class {}
DashboardSchema.setClass(Dashboard)
