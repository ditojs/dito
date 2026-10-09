import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountForm, stubConfirm } from '../test/mount.js'

const cover = { name: 'cover.png', size: 2_500_000, type: 'image/png' }
const scan = { name: 'scan.pdf', size: 12_000, type: 'application/pdf' }

function getRows(field) {
  return field
    .findAll('tbody tr')
    .map(row =>
      row
        .findAll('td')
        .slice(0, 3)
        .map(cell => cell.text())
    )
}

// Simulates the file objects of the upload component as they're added and
// then finish uploading, see `DitoTypeUpload.onInputFile()`.
function createUploadFile(file, id = 'upload-1') {
  return { id, name: file.name, size: file.size, type: file.type }
}

// Uploads are posted to the resource of the form, see `uploadPath`, so they're
// tested in forms.
describe('DitoTypeUpload', () => {
  it('lists the stored files with their size', async () => {
    const { findField } = await mountForm({
      schema: {
        components: { attachments: { type: 'upload', multiple: true } }
      },
      data: { attachments: [cover, scan] }
    })
    expect(getRows(findField('attachments'))).toEqual([
      ['cover.png', '2.5 MB', 'Stored'],
      ['scan.pdf', '12 kB', 'Stored']
    ])
  })

  it('renders files with `render()`', async () => {
    const { findField } = await mountForm({
      schema: {
        components: {
          attachments: {
            type: 'upload',
            multiple: true,
            render: ({ value, index }) => `${index + 1}: ${value.name}`
          }
        }
      },
      data: { attachments: [cover, scan] }
    })
    expect(getRows(findField('attachments')).map(([name]) => name)).toEqual(
      ['1: cover.png', '2: scan.pdf']
    )
  })

  it('links files to the URLs of `downloadUrl()`', async () => {
    const { findField } = await mountForm({
      schema: {
        components: {
          file: {
            type: 'upload',
            downloadUrl: ({ value }) => `/files/${value.name}`
          }
        }
      },
      data: { file: scan }
    })
    const link = findField('file').find('a[download]')
    expect(link.attributes()).toMatchObject({
      download: 'scan.pdf',
      href: '/files/scan.pdf'
    })
  })

  it('removes files after confirmation', async () => {
    const confirm = stubConfirm(true)
    const { findField, data } = await mountForm({
      schema: {
        components: {
          attachments: { type: 'upload', multiple: true, deletable: true },
          file: { type: 'upload', deletable: true }
        }
      },
      data: { attachments: [cover, scan], file: scan }
    })
    await findField('attachments')
      .findAll('.dito-button--delete')[0]
      .trigger('click')
    expect(confirm).toHaveBeenCalledWith(
      'Do you really want to remove cover.png?'
    )
    expect(data.attachments).toEqual([scan])
    await findField('file').find('.dito-button--delete').trigger('click')
    expect(data.file).toBe(null)
  })

  it('adds uploading files and replaces them with the uploaded files', async () => {
    const onChange = vi.fn()
    const { findField, getComponent, data } = await mountForm({
      schema: {
        components: {
          attachments: { type: 'upload', multiple: true, onChange }
        }
      },
      data: { attachments: [scan] }
    })
    const upload = getComponent('attachments')
    const uploadFile = createUploadFile(cover)
    upload.onInputFile(uploadFile, null)
    await flushPromises()
    expect(data.attachments).toEqual([
      scan,
      { id: 'upload-1', name: 'cover.png', size: 2_500_000, upload: uploadFile }
    ])
    upload.onInputFile(
      { ...uploadFile, active: true },
      uploadFile
    )
    const uploadedFile = {
      ...uploadFile,
      success: true,
      response: [{ id: 'stored-1', ...cover }]
    }
    upload.onInputFile(uploadedFile, uploadFile)
    await flushPromises()
    expect(data.attachments).toHaveLength(2)
    expect(data.attachments[1]).toMatchObject({ id: 'stored-1', ...cover })
    expect(data.attachments[1].upload.success).toBe(true)
    expect(getRows(findField('attachments'))[1]).toEqual([
      'cover.png',
      '2.5 MB',
      'Uploaded'
    ])
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledOnce())
  })

  it('removes files that fail to upload and notifies the error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { getComponent, data } = await mountForm({
      schema: { components: { file: { type: 'upload' } } }
    })
    const upload = getComponent('file')
    const uploadFile = createUploadFile(cover)
    upload.onInputFile(uploadFile, null)
    expect(data.file).toMatchObject({ name: 'cover.png' })
    upload.onInputFile({ ...uploadFile, error: 'size' }, uploadFile)
    await flushPromises()
    expect(data.file).toBe(null)
    expect(document.querySelector('.dito-notification').textContent).toContain(
      'File is too large: 2.5 MB'
    )
  })

  it(`doesn't send files that weren't uploaded`, async () => {
    const { getComponent, submit } = await mountForm({
      schema: {
        components: { attachments: { type: 'upload', multiple: true } }
      },
      data: { attachments: [scan] },
      request: ({ data }) => ({ data })
    })
    getComponent('attachments').onInputFile(createUploadFile(cover), null)
    expect(await submit()).toMatchObject({ attachments: [scan] })
  })

  it('posts uploads to the upload resource of the data path', async () => {
    const { getComponent } = await mountForm({
      schema: { components: { coverImage: { type: 'upload' } } },
      data: { coverImage: null }
    })
    expect(getComponent('coverImage').uploadPath).toBe(
      '/items/upload/coverImage'
    )
  })
})
