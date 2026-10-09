import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountForm, stubConfirm } from '../test/mount.js'

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
  })
})
