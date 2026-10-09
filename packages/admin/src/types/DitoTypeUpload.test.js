import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import VueUpload from 'vue-upload-component'
import { mountSchema, mountForm, stubConfirm } from '../test/mount.js'

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
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

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
    await flushPromises()
    expect(confirm).toHaveBeenCalledWith(
      'Do you really want to remove cover.png?'
    )
    expect(data.attachments).toEqual([scan])
    await findField('file').find('.dito-button--delete').trigger('click')
    await flushPromises()
    expect(data.file).toBe(null)
  })

  it('notifies of removed files with their escaped names', async () => {
    stubConfirm(true)
    const { admin, findField } = await mountForm({
      schema: {
        components: { file: { type: 'upload', deletable: true } }
      },
      data: { file: { ...scan, name: 'Tom & Jerry.pdf' } }
    })
    const notify = vi.spyOn(admin.root, 'notify')
    await findField('file').find('.dito-button--delete').trigger('click')
    await flushPromises()
    expect(notify).toHaveBeenCalledWith({
      type: 'info',
      title: 'Successfully Removed',
      html: [
        'Tom &amp; Jerry.pdf was removed.',
        expect.stringContaining('<b>Note</b>')
      ]
    })
  })

  it('keeps files when the removal is cancelled', async () => {
    const confirm = stubConfirm(false)
    const { findField, data } = await mountForm({
      schema: {
        components: {
          attachments: { type: 'upload', multiple: true, deletable: true }
        }
      },
      data: { attachments: [cover, scan] }
    })
    await findField('attachments')
      .findAll('.dito-button--delete')[0]
      .trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledOnce()
    expect(data.attachments).toEqual([cover, scan])
  })

  it('removes the confirmed files after the files changed', async () => {
    const confirm = stubConfirm()
    const { findField, data } = await mountForm({
      schema: {
        components: {
          attachments: { type: 'upload', multiple: true, deletable: true },
          file: { type: 'upload', deletable: true }
        }
      },
      data: { attachments: [cover], file: cover }
    })
    // Another file is added before it while the dialog is open:
    confirm.mockImplementation(() => {
      data.attachments.unshift(scan)
      return true
    })
    await findField('attachments').find('.dito-button--delete').trigger('click')
    await flushPromises()
    expect(data.attachments).toEqual([scan])
    // The file is replaced while the dialog is open:
    confirm.mockImplementation(() => {
      data.file = scan
      return true
    })
    await findField('file').find('.dito-button--delete').trigger('click')
    await flushPromises()
    expect(data.file).toEqual(scan)
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

  it('posts uploads with the API headers but without `Content-Type`', async () => {
    const { wrapper, getComponent } = await mountForm({
      schema: { components: { file: { type: 'upload' } } },
      data: { file: null },
      api: { headers: { Authorization: 'Bearer secret' } }
    })
    // `DitoAdmin` adds the JSON `Content-Type` to the API headers, which would
    // break the multipart form data of uploads:
    expect(wrapper.findComponent(VueUpload).props('headers')).toEqual({
      Authorization: 'Bearer secret'
    })
    const xhr = { withCredentials: false }
    getComponent('file').onInputFilter({ xhr })
    expect(xhr.withCredentials).toBe(false)
  })

  it('posts uploads with credentials for CORS credentials', async () => {
    const { getComponent } = await mountForm({
      schema: { components: { file: { type: 'upload' } } },
      data: { file: null },
      api: { cors: { credentials: true } }
    })
    const xhr = { withCredentials: false }
    getComponent('file').onInputFilter({ xhr })
    expect(xhr.withCredentials).toBe(true)
  })

  it(`doesn't post uploads in views without resource`, async () => {
    const { getComponent, findField } = await mountSchema({
      schema: { components: { coverImage: { type: 'upload' } } }
    })
    expect(getComponent('coverImage').uploadPath).toBe(null)
    expect(findField('coverImage').find('.dito-upload__footer').exists()).toBe(
      true
    )
  })

  it(`doesn't submit forms with its buttons`, async () => {
    const { findField } = await mountForm({
      schema: {
        components: {
          file: { type: 'upload', deletable: true },
          attachments: { type: 'upload', multiple: true }
        }
      },
      data: { file: scan, attachments: [] }
    })
    const types = [
      ...findField('file').findAll('button'),
      ...findField('attachments').findAll('button')
    ].map(button => button.attributes('type'))
    expect(types).toEqual(['button', 'button', 'button'])
  })

  it('keys the rows by key, not by the names of the files', async () => {
    stubConfirm(true)
    const firstScan = { key: 'scan-1.pdf', ...scan }
    const secondScan = { key: 'scan-2.pdf', ...scan, size: 24_000 }
    const { findField, data } = await mountForm({
      schema: {
        components: {
          attachments: { type: 'upload', multiple: true, deletable: true }
        }
      },
      data: { attachments: [firstScan, secondScan] }
    })
    const field = findField('attachments')
    // Files of the same name need distinct keys for Vue to patch their rows:
    expect(
      field.findAll('tbody tr').map(row => row.element.__vnode.key)
    ).toEqual(['scan-1.pdf', 'scan-2.pdf'])
    await field.findAll('.dito-button--delete')[0].trigger('click')
    await flushPromises()
    expect(data.attachments).toEqual([secondScan])
    expect(getRows(field)).toEqual([['scan.pdf', '24 kB', 'Stored']])
  })

  describe('downloads', () => {
    async function mountDownload(
      response,
      api = {},
      downloadUrl = ({ value }) => `/files/${value.name}`
    ) {
      const fetch = vi.fn(async () => response)
      vi.stubGlobal('fetch', fetch)
      const createObjectURL = vi.fn(() => 'blob:scan')
      const revokeObjectURL = vi.fn()
      vi.spyOn(URL, 'createObjectURL').mockImplementation(createObjectURL)
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revokeObjectURL)
      const result = await mountForm({
        schema: {
          components: {
            file: {
              type: 'upload',
              downloadUrl
            }
          }
        },
        data: { file: scan },
        api
      })
      const download = vi
        .spyOn(result.getComponent('file'), 'download')
        .mockImplementation(() => {})
      return { ...result, fetch, download, revokeObjectURL }
    }

    it('downloads the file and revokes its object URL', async () => {
      const { findField, download, revokeObjectURL } = await mountDownload({
        ok: true,
        blob: async () => new Blob(['scan'])
      })
      vi.useFakeTimers({ toFake: ['setTimeout'] })
      try {
        await findField('file').find('a[download]').trigger('click')
        await flushPromises()
        expect(download).toHaveBeenCalledWith({
          filename: 'scan.pdf',
          url: 'blob:scan'
        })
        vi.runAllTimers()
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:scan')
      } finally {
        vi.useRealTimers()
      }
    })

    it('fetches the file with the API headers', async () => {
      const { findField, fetch } = await mountDownload(
        { ok: true, blob: async () => new Blob(['scan']) },
        { headers: { Authorization: 'Bearer secret' } }
      )
      await findField('file').find('a[download]').trigger('click')
      await flushPromises()
      const [url, options] = fetch.mock.calls[0]
      expect(url).toBe('/files/scan.pdf')
      expect(options.headers).toMatchObject({ Authorization: 'Bearer secret' })
    })

    it('links to and fetches relative URLs inside the API', async () => {
      const { findField, fetch } = await mountDownload(
        { ok: true, blob: async () => new Blob(['scan']) },
        {},
        ({ value }) => `files/${value.name}`
      )
      // The test API is at `/`:
      const link = findField('file').find('a[download]')
      expect(link.attributes('href')).toBe('/files/scan.pdf')
      await link.trigger('click')
      await flushPromises()
      expect(fetch.mock.calls[0][0]).toBe('/files/scan.pdf')
    })

    it(`doesn't download failed responses and notifies`, async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const { findField, download } = await mountDownload({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        blob: async () => new Blob(['Not Found'])
      })
      await findField('file').find('a[download]').trigger('click')
      await flushPromises()
      expect(download).not.toHaveBeenCalled()
      expect(
        document.querySelector('.dito-notification').textContent
      ).toContain(
        'Unable to download scan.pdf: ' +
        'Request failed with status code: 404 (Not Found)'
      )
    })
  })

  describe('reordering', () => {
    async function mountAttachments(attachments = {}) {
      return mountForm({
        schema: {
          components: {
            attachments: {
              type: 'upload',
              multiple: true,
              draggable: true,
              deletable: true,
              ...attachments
            }
          }
        },
        data: { attachments: [cover, scan] }
      })
    }

    it('moves files with their drag handles by keyboard', async () => {
      const { findField, data } = await mountAttachments()
      await findField('attachments')
        .find('.dito-button--drag')
        .trigger('keydown', { key: 'ArrowDown', altKey: true })
      await flushPromises()
      expect(data.attachments).toEqual([scan, cover])
    })

    it('stores the files in the order they are dragged into', async () => {
      const { admin, data } = await mountAttachments()
      admin.wrapper
        .findComponent({ name: 'DitoDraggable' })
        .vm.$emit('update:modelValue', [...data.attachments].reverse())
      await flushPromises()
      expect(data.attachments).toEqual([scan, cover])
    })

    it('disables the drag handles and delete buttons when disabled', async () => {
      const { findField } = await mountAttachments({ disabled: true })
      const field = findField('attachments')
      expect(
        field.findAll('.dito-button--drag').map(handle => handle.classes())
      ).toEqual([
        expect.arrayContaining(['dito-button--disabled']),
        expect.arrayContaining(['dito-button--disabled'])
      ])
      expect(
        field
          .findAll('.dito-button--delete')
          .map(button => button.attributes('disabled'))
      ).toEqual(['', ''])
    })
  })

  describe('dropping files', () => {
    // Dispatches a drag event of files on `element`, like the browser does.
    async function dispatchDragEvent(element, type) {
      const event = new Event(type, { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'dataTransfer', {
        value: { types: ['Files'], dropEffect: 'none' }
      })
      element.dispatchEvent(event)
      await flushPromises()
      return event
    }

    async function mountUploads() {
      return mountSchema({
        schema: {
          components: {
            title: { type: 'text' },
            attachments: { type: 'upload', multiple: true },
            cover: { type: 'upload', disabled: true }
          }
        }
      })
    }

    it('marks only the enabled uploads while dragging files', async () => {
      const { wrapper, findField } = await mountUploads()
      const title = findField('title')
      await dispatchDragEvent(title.element, 'dragenter')
      expect(wrapper.find('.dito-drag-overlay').exists()).toBe(true)
      expect(
        wrapper
          .findAll('.dito-upload--drop-target')
          .map(({ element }) => element)
      ).toEqual([findField('attachments').element])
      await dispatchDragEvent(title.element, 'dragleave')
      expect(wrapper.find('.dito-upload--drop-target').exists()).toBe(false)
    })

    it('lets files be dropped only on the enabled uploads', async () => {
      const { findField } = await mountUploads()
      const getDropEffect = async dataPath => {
        const element = findField(dataPath).find('table').element
        const event = await dispatchDragEvent(element, 'dragover')
        return event.dataTransfer.dropEffect
      }
      expect(await getDropEffect('attachments')).toBe('copy')
      expect(await getDropEffect('cover')).toBe('none')
    })

    it('accepts files once the upload is enabled, and not after', async () => {
      const { findField, data, settle } = await mountSchema({
        schema: {
          components: {
            isLocked: { type: 'checkbox' },
            cover: { type: 'upload', disabled: ({ item }) => item.isLocked }
          }
        },
        data: { isLocked: true }
      })
      const getDropEffect = async () => {
        const element = findField('cover').find('table').element
        const event = await dispatchDragEvent(element, 'dragover')
        return event.dataTransfer.dropEffect
      }
      expect(await getDropEffect()).toBe('none')
      data.isLocked = false
      await settle()
      expect(await getDropEffect()).toBe('copy')
      data.isLocked = true
      await settle()
      expect(await getDropEffect()).toBe('none')
    })

    it('stops accepting files once the upload is removed', async () => {
      const { wrapper, findField, data, settle } = await mountSchema({
        schema: {
          components: {
            hasCover: { type: 'checkbox' },
            cover: { type: 'upload', if: ({ item }) => item.hasCover }
          }
        },
        data: { hasCover: true }
      })
      data.hasCover = false
      await settle()
      expect(wrapper.find('.dito-upload').exists()).toBe(false)
      await dispatchDragEvent(findField('hasCover').element, 'dragenter')
      expect(wrapper.find('.dito-drag-overlay').exists()).toBe(false)
    })

    it('lets the upload handle the files dropped on its target', async () => {
      const { wrapper, findField } = await mountUploads()
      const target = findField('attachments').element
      const upload = wrapper
        .findAllComponents(VueUpload)
        .find(({ element }) => target.contains(element))
      // happy-dom lacks `ondrop`, for which `VueUpload` disables dropping, so
      // enable it to resolve its drop zone, as browsers do:
      upload.vm.features.drop = true
      upload.vm.watchDrop(upload.props('drop'))
      expect(upload.vm.dropElement).toBe(target)
      upload.vm.watchDrop(false)
    })

    it(`doesn't show the overlay without enabled uploads`, async () => {
      const { wrapper, findField } = await mountSchema({
        schema: {
          components: {
            title: { type: 'text' },
            cover: { type: 'upload', disabled: true }
          }
        }
      })
      await dispatchDragEvent(findField('title').element, 'dragenter')
      expect(wrapper.find('.dito-drag-overlay').exists()).toBe(false)
    })
  })
})
