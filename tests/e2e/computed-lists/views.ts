import type { Assignment, Team } from './models/Team.js'
import type { Dashboard } from './models/Dashboard.js'
import { createWidgetView } from '../../utils/views.js'

// The assignments of each rota are computed from the team's members, keeping
// the days of members that are already assigned. Their forms contain a
// button, which has no value, a field with a default that the compute doesn't
// return, and computed checkboxes with options that depend on the rota.
export const teams = createWidgetView<Team>('name', 'teams', {
  name: { type: 'text', label: 'Name' },
  members: {
    type: 'list',
    label: 'Members',
    inlined: true,
    creatable: true,
    collapsible: true,
    collapsed: true,
    form: {
      type: 'form',
      components: { name: { type: 'text', label: 'Member Name' } }
    }
  },
  rotas: {
    type: 'list',
    label: 'Rotas',
    inlined: true,
    creatable: true,
    collapsible: true,
    collapsed: true,
    form: {
      type: 'form',
      components: {
        numDays: { type: 'number', label: 'Number of Days', default: 5 },
        assignments: {
          type: 'list',
          label: 'Assignments',
          inlined: true,
          form: {
            type: 'form',
            components: {
              notify: { type: 'button', text: 'Notify' },
              member: { type: 'text', label: 'Member', readonly: true },
              hours: { type: 'number', label: 'Hours', default: 0 },
              days: {
                type: 'checkboxes',
                layout: 'horizontal',
                options: {
                  data: ({ parentItem: rota }) =>
                    Array.from({ length: rota.numDays }, (_, index) => ({
                      label: `Day ${index + 1}`,
                      value: index + 1
                    }))
                },
                // Drops the days that the rota doesn't have anymore.
                compute: ({ value: days, parentItem: rota }) =>
                  days.filter((day: number) => day <= rota.numDays)
              }
            }
          },
          compute: ({ value: assignments, parentItem: team }) =>
            team.members.map(({ name }: { name: string }) => ({
              member: name,
              days: assignments?.find(
                (assignment: Assignment) => assignment.member === name
              )?.days ?? []
            }))
        }
      }
    }
  }
})

type SizeEntry = { screen: string; columns?: number | null }

const screens = ['small', 'medium', 'large']

// The sizes of the collapsed widgets are stored as an object keyed by screen,
// and edited as a list of entries, which `compute()` converts the object to.
// Each screen's form is only offered while it has no entry.
export const dashboards = createWidgetView<Dashboard>('name', 'dashboards', {
  name: { type: 'text', label: 'Name' },
  widgets: {
    type: 'list',
    label: 'Widgets',
    inlined: true,
    creatable: true,
    collapsible: true,
    collapsed: true,
    form: {
      type: 'form',
      components: {
        title: { type: 'text', label: 'Widget Title' },
        sizes: {
          type: 'object',
          label: 'Sizes',
          default: {},
          components: {
            entries: {
              type: 'list',
              label: false,
              exclude: true,
              default: null,
              inlined: true,
              creatable: { label: 'Add Size' },
              deletable: true,
              forms: Object.fromEntries(
                screens.map(screen => [
                  screen,
                  {
                    type: 'form',
                    label: screen,
                    visible: ({ value }: { value: SizeEntry[] }) =>
                      value.every(entry => entry.screen !== screen),
                    components: {
                      columns: { type: 'number', label: 'Columns' }
                    }
                  }
                ])
              ),
              compute: ({ value, item: sizes }) =>
                Array.isArray(value)
                  ? value
                  : Object.entries(sizes)
                      .filter(([key]) => screens.includes(key))
                      .map(([screen, size]) => ({
                        screen,
                        ...(size as object)
                      })),
              process: ({ value, processedItem }) => {
                for (const { screen, ...size } of value) {
                  processedItem[screen] = size
                }
              }
            }
          }
        }
      }
    }
  }
})
