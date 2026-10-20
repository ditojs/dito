import type { ListSchema } from '@ditojs/admin'
import type { Project } from './models/Project.js'
import { createWidgetView } from '../../utils/views.js'

const statusOptions = ['Planned', 'Active', 'Done']

// A showcase of the admin's components, for screenshots of their styling: all
// field types, lists, sections, tabs, panels, trees, buttons and dialogs.
export const projects = createWidgetView<Project>(
  'Project',
  'projects',
  {},
  {
    creatable: true,
    deletable: true,
    columns: {
      name: { label: 'Name', sortable: true },
      status: { label: 'Status' },
      budget: { label: 'Budget' }
    },
    scopes: {
      $default: { label: 'All' },
      planned: { label: 'Planned' },
      active: { label: 'Active' },
      done: { label: 'Done' }
    },
    filters: {
      search: {
        fields: {
          search: { label: 'Search', type: 'text' }
        }
      }
    },
    paginate: 2,
    form: {
      type: 'form',
      tabs: {
        main: {
          type: 'tab',
          label: 'Main',
          defaultTab: true,
          fields: {
            name: { type: 'text', label: 'Name', required: true },
            budget: { type: 'number', label: 'Budget', width: '1/4' },
            status: {
              type: 'select',
              label: 'Status',
              width: '1/4',
              options: statusOptions
            },
            description: { type: 'textarea', label: 'Description', lines: 3 },
            tags: {
              type: 'multiselect',
              label: 'Tags',
              multiple: true,
              searchable: true,
              // Loaded options, which keep the tags that aren't among them:
              options: {
                data: () => ['Design', 'Backend', 'Frontend', 'Research']
              }
            },
            priority: {
              type: 'radio',
              label: 'Priority',
              layout: 'horizontal',
              width: '1/2',
              options: ['Low', 'Medium', 'High']
            },
            features: {
              type: 'checkboxes',
              label: 'Features',
              layout: 'horizontal',
              width: '1/2',
              options: ['Search', 'Export', 'Sharing']
            },
            active: { type: 'switch', label: 'Active', width: '1/4' },
            archived: { type: 'checkbox', label: 'Archived', width: '1/4' },
            progress: {
              type: 'slider',
              label: 'Progress',
              width: '1/2',
              range: [0, 100]
            },
            color: { type: 'color', label: 'Color', width: '1/4' },
            startDate: { type: 'date', label: 'Start Date', width: '1/4' },
            openDialog: {
              type: 'button',
              text: 'Open Dialog',
              onClick: ({ showDialog }) => {
                showDialog({
                  fields: {
                    message: {
                      type: 'text',
                      label: 'Message',
                      required: true,
                      clearable: true
                    }
                  },
                  buttons: {
                    cancel: { text: 'Cancel' },
                    submit: { text: 'Send' }
                  }
                })
              }
            }
          }
        },
        details: {
          type: 'tab',
          label: 'Details',
          fields: {
            notes: {
              type: 'markup',
              label: 'Notes',
              marks: {
                bold: true,
                italic: true,
                underline: true,
                strike: true,
                link: true
              },
              nodes: { bulletList: true, orderedList: true }
            },
            config: {
              type: 'code',
              label: 'Config',
              language: 'json',
              resizable: true
            },
            settings: {
              type: 'section',
              label: 'Settings',
              nested: true,
              collapsible: true,
              fields: {
                visibility: {
                  type: 'select',
                  label: 'Visibility',
                  width: '1/2',
                  options: ['Private', 'Public']
                },
                reviewer: { type: 'text', label: 'Reviewer', width: '1/2' }
              }
            },
            advanced: {
              type: 'section',
              label: 'Advanced',
              nested: true,
              collapsible: true,
              collapsed: true,
              fields: {
                slug: { type: 'text', label: 'Slug' }
              }
            },
            // A row of a checkbox and a section without labels, whose fields
            // have labels. Only planned projects show it, so that the other
            // screenshots stay the same:
            approved: {
              type: 'checkbox',
              label: false,
              width: '1/4',
              if: ({ item }) => item.status === 'Planned'
            },
            approval: {
              type: 'section',
              label: false,
              nested: true,
              width: '3/4',
              if: ({ item }) => item.status === 'Planned',
              fields: {
                approver: { type: 'text', label: 'Approver', width: '1/2' },
                approvedOn: { type: 'date', label: 'Approved On', width: '1/2' }
              }
            }
          }
        },
        planning: {
          type: 'tab',
          label: 'Planning',
          fields: {
            contacts: {
              type: 'list',
              label: 'Contacts',
              inlined: true,
              creatable: true,
              deletable: true,
              draggable: true,
              form: {
                type: 'form',
                fields: {
                  name: { type: 'text', label: 'Contact Name', width: '1/2' },
                  email: { type: 'email', label: 'Email', width: '1/2' }
                }
              }
            },
            milestones: {
              type: 'list',
              label: 'Milestones',
              itemLabel: 'title',
              creatable: true,
              editable: true,
              deletable: true,
              columns: {
                title: { label: 'Title' },
                due: { label: 'Due' }
              },
              form: {
                type: 'form',
                label: 'Milestone',
                fields: {
                  title: { type: 'text', label: 'Title', required: true },
                  due: { type: 'date', label: 'Due' }
                }
              }
            },
            phases: {
              type: 'tree-list',
              label: 'Phases',
              itemLabel: 'name',
              collapsed: false,
              editable: true,
              deletable: true,
              draggable: true,
              form: {
                type: 'form',
                fields: { name: { type: 'text', label: 'Phase Name' } }
              },
              children: {
                name: 'tasks',
                itemLabel: 'name',
                editable: true,
                form: {
                  type: 'form',
                  fields: {
                    name: { type: 'text', label: 'Task Name', required: true }
                  }
                }
              }
            }
          }
        },
        extras: {
          type: 'tab',
          label: 'Extras',
          fields: {
            website: {
              type: 'url',
              label: 'Website',
              width: '1/2'
            },
            startTime: { type: 'time', label: 'Start Time', width: '1/4' },
            meetingAt: { type: 'datetime', label: 'Meeting', width: '1/4' },
            contactInfo: {
              type: 'section',
              label: 'Contact Info',
              nested: true,
              fields: {
                phone: { type: 'text', label: 'Phone', width: '1/2' },
                email: { type: 'email', label: 'Contact Email', width: '1/2' }
              }
            },
            files: {
              type: 'upload',
              label: 'Files',
              multiple: true,
              draggable: true,
              deletable: true,
              extensions: 'png,pdf',
              clipboard: { interchange: true }
            },
            links: {
              type: 'list',
              label: 'Links',
              inlined: true,
              creatable: true,
              deletable: true,
              draggable: true,
              collapsible: 'all',
              clipboard: { interchange: true },
              // Long suffixes are clipped with an ellipsis:
              itemLabel: ({
                formLabel,
                item
              }: {
                formLabel: string | null
                item: { url?: string; text?: string }
              }) => ({
                text: formLabel ?? '',
                suffix: { html: ` — <small>${item.url ?? item.text}</small>` }
              }),
              forms: {
                link: {
                  type: 'form',
                  label: 'Link',
                  fields: {
                    url: { type: 'url', label: 'Link URL' }
                  }
                },
                note: {
                  type: 'form',
                  label: 'Note',
                  fields: {
                    text: { type: 'text', label: 'Note Text' }
                  }
                }
              },
              panels: {
                linksInfo: {
                  type: 'panel',
                  label: 'Links Info',
                  fields: {
                    linksHint: { type: 'label', label: 'Links open in tabs' }
                  }
                }
              }
            },
            // A single upload and a list without labels:
            attachment: {
              type: 'upload',
              label: false,
              clipboard: true
            },
            references: {
              type: 'list',
              label: false,
              inlined: true,
              collapsible: 'all',
              clipboard: true,
              form: {
                type: 'form',
                label: 'Reference',
                clipboard: { interchange: true },
                fields: {
                  url: { type: 'url', label: 'Reference URL' }
                }
              }
            }
          }
        }
      },
      panels: {
        summary: {
          type: 'panel',
          label: 'Summary',
          fields: {
            owner: { type: 'label', label: 'Owner: Ada' }
          }
        }
      }
    }
  }
)

// Further views in a sub-menu, for screenshots of the menus, each listing the
// projects of one scope.
function createScopeView(
  scope: 'planned' | 'done',
  listOptions: Partial<ListSchema<Project>> = {}
) {
  return createWidgetView<Project>(
    'Project',
    'projects',
    {},
    {
      columns: { name: { label: 'Name' } },
      scopes: { [scope]: { defaultScope: true } },
      ...listOptions
    }
  )
}

export const reports = {
  type: 'menu',
  label: 'Reports',
  items: {
    planned: {
      // A list and scopes wider than narrow windows, with a button below:
      ...createScopeView('planned', {
        creatable: true,
        paginate: 20,
        scopes: {
          $default: { label: 'All Projects' },
          planned: { label: 'Planned Projects', defaultScope: true },
          active: { label: 'Active Projects' },
          done: { label: 'Done Projects' }
        },
        columns: {
          name: { label: 'Name' },
          status: { label: 'Status' },
          budget: { label: 'Budget' },
          priority: { label: 'Priority' },
          progress: { label: 'Progress' },
          startDate: { label: 'Start Date' },
          website: { label: 'Website' }
        }
      }),
      label: 'Planned Projects'
    },
    done: { ...createScopeView('done'), label: 'Done Projects' }
  }
} as const

export const account = {
  settings: {
    type: 'form',
    label: 'Account',
    fields: {
      name: { type: 'text', label: 'Name' },
      email: { type: 'email', label: 'Email' },
      password: { type: 'password', label: 'New Password' }
    }
  }
} as const
