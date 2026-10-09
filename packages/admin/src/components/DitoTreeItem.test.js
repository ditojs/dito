import { vi } from 'vitest'
import { asArray } from '@ditojs/utils'
import { flushPromises } from '@vue/test-utils'
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
})
