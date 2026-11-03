import { defineEntity, p, type EntityDTO } from '@mikro-orm/core'

export interface Contact {
  name: string
  email?: string | null
}

export interface Milestone {
  title: string
  due?: string | null
  steps?: { text?: string | null }[] | null
  review?: { reviewer?: string | null } | null
}

export interface Phase {
  name: string
  lead?: string | null
  tasks?: { name: string }[]
}

const ProjectSchema = defineEntity({
  name: 'Project',
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    description: p.text().nullable(),
    budget: p.double().nullable(),
    status: p.string().nullable(),
    tags: p.json<string[]>().nullable(),
    priority: p.string().nullable(),
    features: p.json<string[]>().nullable(),
    active: p.boolean().nullable(),
    archived: p.boolean().nullable(),
    progress: p.double().nullable(),
    color: p.string().nullable(),
    startDate: p.date().nullable(),
    notes: p.text().nullable(),
    config: p.text().nullable(),
    contacts: p.json<Contact[]>().nullable(),
    milestones: p.json<Milestone[]>().nullable(),
    phases: p.json<Phase[]>().nullable(),
    settings: p
      .json<{ visibility?: string | null; reviewer?: string | null }>()
      .nullable(),
    advanced: p.json<{ slug?: string | null }>().nullable(),
    website: p.string().nullable(),
    startTime: p.datetime().nullable(),
    meetingAt: p.datetime().nullable(),
    files: p.json<object[]>().nullable(),
    links: p.json<object[]>().nullable(),
    attachment: p.json<object>().nullable(),
    references: p.json<{ url?: string | null }[]>().nullable(),
    contactInfo: p
      .json<{ phone?: string | null; email?: string | null }>()
      .nullable(),
    approved: p.boolean().nullable(),
    approval: p
      .json<{ approver?: string | null; approvedOn?: string | null }>()
      .nullable()
  }
})
export class Project extends ProjectSchema.class {}
ProjectSchema.setClass(Project)

// A project as the admin edits it. Buttons and labels don't hold data of their
// own, so their keys are `never`.
export type ProjectItem = EntityDTO<Project> & {
  openDialog?: never
  owner?: never
  editSettings?: never
}
