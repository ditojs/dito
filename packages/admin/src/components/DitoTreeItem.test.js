import { vi } from 'vitest'
import { asArray } from '@ditojs/utils'
import { flushPromises } from '@vue/test-utils'
import Sortable from 'sortablejs'
import { mountForm, stubConfirm, enterValue } from '../test/mount.js'

const chapterForm = {
  type: 'form',
  label: 'Chapter',
  components: { title: { type: 'text' } }
}

async function mountBookForm() {
  const result = await mountForm({
    schema: {
      components: {
        chapters: {
          type: 'tree-list',
          path: 'chapters',
          itemLabel: 'title',
          form: chapterForm,
          open: true,
          children: {
            name: 'sections',
            path: 'sections',
            itemLabel: 'title',
            form: chapterForm,
            open: true,
            deletable: true
          }
        }
      }
    },
    data: {
      chapters: [{ title: 'Intro', sections: [{ title: 'Tom & Jerry' }] }]
    }
  })
  // Tree items notify through the root component, see `DitoMixin.notify()`:
  const notify = vi.spyOn(result.admin.root, 'notify')
  return { ...result, notify }
}

describe('DitoTreeItem', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders compact square edit buttons, unlike lists', async () => {
    const { wrapper } = await mountBookForm()
    const buttons = wrapper.findAll('.dito-tree-header .dito-edit-buttons')
    expect(buttons.length).toBeGreaterThan(0)
    for (const button of buttons) {
      expect(button.classes()).toContain('dito-buttons--small')
      expect(button.classes()).not.toContain('dito-buttons--round')
    }
  })

  describe('deleteChild()', () => {
    it('confirms with the text and notifies with the HTML label', async () => {
      const confirm = stubConfirm()
      const { findField, notify } = await mountBookForm()
      await findField('chapters').find('.dito-button--remove').trigger('click')
      await flushPromises()
      expect(confirm).toHaveBeenCalledWith(
        `Do you really want to remove Chapter 'Tom & Jerry'?`
      )
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          html: [
            `Chapter 'Tom &amp; Jerry' was removed.`,
            expect.stringContaining('<b>Note</b>')
          ]
        })
      )
    })

    it('keeps the child when cancelled', async () => {
      const confirm = stubConfirm(false)
      const { findField, data, notify } = await mountBookForm()
      await findField('chapters').find('.dito-button--remove').trigger('click')
      await flushPromises()
      expect(confirm).toHaveBeenCalledOnce()
      expect(data.chapters[0].sections).toEqual([{ title: 'Tom & Jerry' }])
      expect(notify).not.toHaveBeenCalled()
    })

    it('removes the confirmed child after the children changed', async () => {
      const confirm = stubConfirm()
      const { findField, data } = await mountBookForm()
      // Another child is inserted before it while the dialog is open:
      confirm.mockImplementation(() => {
        data.chapters[0].sections.unshift({ title: 'Prologue' })
        return true
      })
      await findField('chapters').find('.dito-button--remove').trigger('click')
      await flushPromises()
      expect(data.chapters[0].sections).toEqual([{ title: 'Prologue' }])
    })
  })

  describe('editPath()', () => {
    it('keeps the filters of the route query', async () => {
      const { admin, findField, settle } = await mountForm({
        schema: {
          components: {
            notes: {
              type: 'list',
              resource: { path: 'notes' },
              filters: { text: { filter: 'text' } },
              itemLabel: 'text'
            },
            chapters: {
              type: 'tree-list',
              path: 'chapters',
              itemLabel: 'title',
              form: chapterForm,
              editable: true
            }
          }
        },
        data: { chapters: [{ title: 'Intro' }] },
        request: () => ({ data: [] })
      })
      const filterInput = admin.wrapper.find(
        '.dito-panel input[name$="text"]'
      )
      await enterValue(filterInput, 'draft')
      await settle()
      const filter = ['text:"draft"']
      expect(admin.router.currentRoute.value.query.filter).toEqual(filter)
      await findField('chapters').find('.dito-button--edit').trigger('click')
      await settle()
      const route = admin.router.currentRoute.value
      expect(route.path).toBe('/items/1/chapters/0')
      expect(asArray(route.query.filter)).toEqual(filter)
    })
  })

  describe('children', () => {
    // Mounts a book form with a tree of draggable and editable chapters and
    // their sections, which are closed.
    async function mountChaptersForm(chapters) {
      return mountForm({
        schema: {
          components: {
            chapters: {
              type: 'tree-list',
              path: 'chapters',
              itemLabel: 'title',
              form: chapterForm,
              editable: true,
              children: {
                name: 'sections',
                path: 'sections',
                itemLabel: 'title',
                form: chapterForm,
                editable: true,
                draggable: true,
                deletable: true
              }
            }
          }
        },
        data: { chapters }
      })
    }

    const findItem = (wrapper, label) =>
      wrapper
        .findAll('.dito-tree-item')
        .find(
          item => (
            item.element.querySelector(
              ':scope > .dito-tree-header .dito-tree-label'
            )?.textContent === label
          )
        )

    it('renders items without children as leaves', async () => {
      const { wrapper } = await mountChaptersForm([
        { title: 'Intro', sections: [{ title: 'Welcome' }] },
        { title: 'Outro', sections: null }
      ])
      expect(
        findItem(wrapper, 'Intro')
          .find('.dito-tree-header > .dito-tree-branch')
          .exists()
      ).toBe(true)
      const outro = findItem(wrapper, 'Outro')
      expect(outro.find('.dito-tree-leaf').exists()).toBe(true)
      expect(outro.find('.dito-draggable').exists()).toBe(true)
      expect(outro.findAll('.dito-tree-item')).toHaveLength(0)
    })

    it('opens the items in the path of the edited child', async () => {
      const { admin, wrapper, settle } = await mountChaptersForm([
        { title: 'Intro', sections: [{ title: 'Welcome' }] }
      ])
      const chevron = findItem(wrapper, 'Intro').find('.dito-chevron')
      expect(chevron.classes()).not.toContain('dito-chevron--open')
      await admin.navigate('/items/1/chapters/0/sections/0')
      await settle()
      expect(chevron.classes()).toContain('dito-chevron--open')
      // The items stay open after the child's form is closed:
      await admin.navigate('/items/1')
      await settle()
      expect(chevron.classes()).toContain('dito-chevron--open')
    })

    it('moves children with their drag handles', async () => {
      const { wrapper, data } = await mountChaptersForm([
        {
          title: 'Intro',
          sections: [{ title: 'Welcome' }, { title: 'Overview' }]
        }
      ])
      const getTitles = () =>
        data.chapters[0].sections.map(section => section.title)
      const findHandle = label =>
        findItem(wrapper, label).find('.dito-button--drag')
      await findHandle('Welcome').trigger('keydown', {
        key: 'ArrowUp',
        altKey: true
      })
      await flushPromises()
      // The first child can't move up:
      expect(getTitles()).toEqual(['Welcome', 'Overview'])
      await findHandle('Welcome').trigger('keydown', {
        key: 'ArrowDown',
        altKey: true
      })
      await flushPromises()
      expect(getTitles()).toEqual(['Overview', 'Welcome'])
    })

    it('marks the item while its children are dragged', async () => {
      const { wrapper } = await mountChaptersForm([
        {
          title: 'Intro',
          sections: [{ title: 'Welcome' }, { title: 'Overview' }]
        }
      ])
      const intro = findItem(wrapper, 'Intro')
      const sortable = Sortable.get(intro.find('.dito-draggable').element)
      sortable.option('onStart')()
      await flushPromises()
      expect(intro.classes()).toContain('dito-tree-item--dragging')
      sortable.option('onEnd')({ oldIndex: 0, newIndex: 0 })
      await flushPromises()
      expect(intro.classes()).not.toContain('dito-tree-item--dragging')
    })

    it(`doesn't notify the removal of children removed meanwhile`, async () => {
      const confirm = stubConfirm()
      const { wrapper, data, admin } = await mountChaptersForm([
        { title: 'Intro', sections: [{ title: 'Welcome' }] }
      ])
      const notify = vi.spyOn(admin.root, 'notify')
      // The child is removed while the dialog is open:
      confirm.mockImplementation(() => {
        data.chapters[0].sections = []
        return true
      })
      await findItem(wrapper, 'Welcome')
        .find('.dito-button--remove')
        .trigger('click')
      await flushPromises()
      expect(confirm).toHaveBeenCalledOnce()
      expect(data.chapters[0].sections).toEqual([])
      expect(notify).not.toHaveBeenCalled()
    })
  })
})
