import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountForm, mountSchema, stubConfirm } from '../test/mount.js'

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

    it('keeps the item when cancelled', async () => {
      const confirm = stubConfirm(false)
      const { findField, data } = await mountBookForm()
      await findField('chapters').find('.dito-button--remove').trigger('click')
      await flushPromises()
      expect(confirm).toHaveBeenCalledOnce()
      expect(data.chapters).toEqual([{ title: 'Tom & Jerry <img src=x>' }])
      expect(document.querySelector('.dito-notification')).toBe(null)
    })

    it('removes the confirmed item after the list changed', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {})
      const confirm = stubConfirm()
      const { findField, data } = await mountBookForm()
      // Another item is inserted before it while the dialog is open:
      confirm.mockImplementation(() => {
        data.chapters.unshift({ title: 'Prologue' })
        return true
      })
      await findField('chapters').find('.dito-button--remove').trigger('click')
      await flushPromises()
      expect(data.chapters).toEqual([{ title: 'Prologue' }])
    })

    it('keeps an object that was replaced while confirming', async () => {
      const confirm = stubConfirm()
      const { findField, data } = await mountSchema({
        schema: {
          components: {
            address: {
              type: 'object',
              inlined: true,
              deletable: true,
              form: {
                type: 'form',
                components: { street: { type: 'text' } }
              }
            }
          }
        },
        data: { address: { street: 'Main St' } }
      })
      // The object is replaced while the dialog is open:
      confirm.mockImplementation(() => {
        data.address = { street: 'Side St' }
        return true
      })
      await findField('address').find('.dito-button--remove').trigger('click')
      await flushPromises()
      expect(data.address).toEqual({ street: 'Side St' })
      expect(document.querySelector('.dito-notification')).toBe(null)
    })
  })

  describe('navigateToComponent()', () => {
    it('completes with the route component navigated to', async () => {
      const { admin, getComponent, routeComponent } = await mountForm({
        schema: {
          components: {
            chapters: {
              type: 'list',
              form: {
                type: 'form',
                components: { title: { type: 'text' } }
              }
            }
          }
        },
        data: { chapters: [{ title: 'Arrakis' }, { title: 'Caladan' }] }
      })
      const chapters = getComponent('chapters')
      // Navigate back and forth, so that route components are replaced:
      await admin.navigate('/items/1/chapters/0')
      await admin.navigate('/items/1')
      await admin.navigate('/items/1/chapters/1')
      await admin.navigate('/items/1')
      const onComplete = vi.fn(([component]) => component)
      const chapterForm = await chapters.navigateToComponent(
        'chapters/1/title',
        onComplete
      )
      await flushPromises()
      expect(admin.router.currentRoute.value.path).toBe('/items/1/chapters/1')
      expect(chapterForm).not.toBe(routeComponent)
      expect(chapterForm.isForm).toBe(true)
      expect(chapterForm.data).toEqual({ title: 'Caladan' })
    })
  })
})
