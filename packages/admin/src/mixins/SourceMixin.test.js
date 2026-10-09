import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountForm, stubConfirm } from '../test/mount.js'

async function mountBookForm() {
  return mountForm({
    schema: {
      components: {
        chapters: {
          type: 'list',
          inlined: true,
          deletable: true,
          itemLabel: 'title',
          form: {
            type: 'form',
            label: 'Chapter',
            components: { title: { type: 'text' } }
          }
        }
      }
    },
    data: { chapters: [{ title: 'Tom & Jerry <img src=x>' }] }
  })
}

describe('SourceMixin', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('deleteItem()', () => {
    it('confirms with the text and notifies with the label', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {})
      const confirm = stubConfirm()
      const { findField, data } = await mountBookForm()
      await findField('chapters').find('.dito-button--remove').trigger('click')
      await flushPromises()
      expect(confirm).toHaveBeenCalledWith(
        `Do you really want to remove Chapter 'Tom & Jerry <img src=x>'?`
      )
      expect(data.chapters).toEqual([])
      const notification = document.querySelector('.dito-notification')
      expect(notification.querySelector('img')).toBe(null)
      const paragraphs = [...notification.querySelectorAll('p')].map(
        paragraph => paragraph.textContent
      )
      expect(paragraphs).toEqual([
        `Chapter 'Tom & Jerry <img src=x>' was removed.`,
        'Note: the parent still needs to be saved ' +
        'in order to persist this change.'
      ])
    })
  })
})
