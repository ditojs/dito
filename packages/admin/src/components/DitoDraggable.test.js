import Sortable from 'sortablejs'
import { mountForm } from '../test/mount.js'

const scan = {
  key: 'scan.pdf',
  name: 'scan.pdf',
  size: 12_000,
  type: 'application/pdf'
}
const cover = {
  key: 'cover.png',
  name: 'cover.png',
  size: 2_500_000,
  type: 'image/png'
}

describe('DitoDraggable', () => {
  it('keeps its children when it becomes draggable', async () => {
    // Uploads are only draggable with more than one file:
    const { findField, data, settle } = await mountForm({
      schema: {
        components: {
          attachments: { type: 'upload', multiple: true, draggable: true }
        }
      },
      data: { attachments: [scan] }
    })
    const getBody = () => findField('attachments').find('tbody').element
    const body = getBody()
    const row = body.querySelector('tr')
    expect(Sortable.get(body).option('disabled')).toBe(true)
    data.attachments.push(cover)
    await settle()
    expect(getBody()).toBe(body)
    expect(body.querySelector('tr')).toBe(row)
    expect(Sortable.get(body).option('disabled')).toBe(false)
    data.attachments.pop()
    await settle()
    expect(Sortable.get(body).option('disabled')).toBe(true)
  })
})
