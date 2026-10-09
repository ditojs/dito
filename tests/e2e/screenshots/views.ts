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
        components: {
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
          components: {
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
              options: ['Design', 'Backend', 'Frontend', 'Research']
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
              events: {
                click: ({ component }) => {
                  component?.showDialog({
                    components: {
                      message: {
                        type: 'text',
                        label: 'Message',
                        required: true
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
          }
        },
        details: {
          type: 'tab',
          label: 'Details',
          components: {
            notes: { type: 'markup', label: 'Notes' },
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
              components: {
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
              components: {
                slug: { type: 'text', label: 'Slug' }
              }
            }
          }
        },
        planning: {
          type: 'tab',
          label: 'Planning',
          components: {
            contacts: {
              type: 'list',
              label: 'Contacts',
              inlined: true,
              creatable: true,
              deletable: true,
              draggable: true,
              form: {
                type: 'form',
                components: {
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
                components: {
                  title: { type: 'text', label: 'Title' },
                  due: { type: 'date', label: 'Due' }
                }
              }
            },
            phases: {
              type: 'tree-list',
              label: 'Phases',
              itemLabel: 'name',
              open: true,
              editable: true,
              deletable: true,
              draggable: true,
              form: {
                type: 'form',
                components: { name: { type: 'text', label: 'Phase Name' } }
              },
              children: {
                name: 'tasks',
                itemLabel: 'name',
                editable: true,
                form: {
                  type: 'form',
                  components: { name: { type: 'text', label: 'Task Name' } }
                }
              }
            }
          }
        },
        extras: {
          type: 'tab',
          label: 'Extras',
          components: {
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
              components: {
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
              extensions: 'png,pdf'
            },
            links: {
              type: 'list',
              label: 'Links',
              inlined: true,
              creatable: true,
              deletable: true,
              draggable: true,
              forms: {
                link: {
                  type: 'form',
                  label: 'Link',
                  components: {
                    url: { type: 'url', label: 'Link URL' }
                  }
                },
                note: {
                  type: 'form',
                  label: 'Note',
                  components: {
                    text: { type: 'text', label: 'Note Text' }
                  }
                }
              },
              panels: {
                linksInfo: {
                  type: 'panel',
                  label: 'Links Info',
                  components: {
                    linksHint: { type: 'label', label: 'Links open in tabs' }
                  }
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
          components: {
            owner: { type: 'label', label: 'Owner: Ada' }
          }
        }
      }
    }
  }
)

// Further views in a sub-menu, for screenshots of the menus, each listing the
// projects of one scope.
function createScopeView(scope: 'planned' | 'done') {
  return createWidgetView<Project>(
    'Project',
    'projects',
    {},
    {
      columns: { name: { label: 'Name' } },
      scopes: { [scope]: { defaultScope: true } }
    }
  )
}

export const reports = {
  type: 'menu',
  label: 'Reports',
  items: {
    planned: { ...createScopeView('planned'), label: 'Planned Projects' },
    done: { ...createScopeView('done'), label: 'Done Projects' }
  }
} as const
