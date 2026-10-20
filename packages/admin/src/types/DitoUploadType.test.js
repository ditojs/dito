import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import VueUpload from 'vue-upload-component'
import Sortable from 'sortablejs'
import {
  mountSchema,
  mountForm,
  stubConfirm,
  unmountAdmin
} from '../test/mount.js'
import { copyClipboardData, getClipboardData } from '../utils/clipboard.js'

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
// then finish uploading, see `DitoUploadType.onInputFile()`.
function createUploadFile(file, id = 'upload-1') {
  return { id, name: file.name, size: file.size, type: file.type }
}

// Uploads are posted to the resource of the form, see `uploadPath`, so they're
// tested in forms.
describe('DitoUploadType', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('lists the stored files with their size', async () => {
    const { findField } = await mountForm({
      schema: {
        fields: { attachments: { type: 'upload', multiple: true } }
      },
      data: { attachments: [cover, scan] }
    })
    expect(getRows(findField('attachments'))).toEqual([
      ['cover.png', '2.5 MB', 'Stored'],
      ['scan.pdf', '12 kB', 'Stored']
    ])
  })

  it('holds an empty array by default with `multiple`', async () => {
    const { data } = await mountForm({
      schema: {
        fields: {
          attachments: { type: 'upload', multiple: true },
          attachment: { type: 'upload' }
        }
      }
    })
    expect(data.attachments).toEqual([])
    expect(data.attachment).toBe(null)
  })

  it('sends single files with a `multiple()` callback that is false', async () => {
    const { submit } = await mountForm({
      schema: {
        fields: {
          attachment: { type: 'upload', multiple: ({ item }) => item.isGallery }
        }
      },
      data: { isGallery: false, attachment: cover },
      request: ({ data }) => ({ data })
    })
    expect((await submit()).attachment).toEqual(cover)
  })

  it('renders files with `render()`', async () => {
    const { findField } = await mountForm({
      schema: {
        fields: {
          attachments: {
            type: 'upload',
            multiple: true,
            render: ({ value, valueIndex }) =>
              `${valueIndex + 1}: ${value.name}`
          }
        }
      },
      data: { attachments: [cover, scan] }
    })
    expect(getRows(findField('attachments')).map(([name]) => name)).toEqual(
      ['1: cover.png', '2: scan.pdf']
    )
  })

  it('points its label to its input', async () => {
    const { findContainer } = await mountForm({
      schema: {
        // Tabs add their name to the component path, but not to the data path:
        tabs: {
          files: {
            type: 'tab',
            fields: { file: { type: 'upload', label: 'File' } }
          }
        }
      }
    })
    const container = findContainer('file')
    const { id } = container.find('input[type="file"]').attributes()
    expect(container.find('label').attributes('for')).toBe(id)
  })

  it('links files to the URLs of `downloadUrl()`', async () => {
    const { findField } = await mountForm({
      schema: {
        fields: {
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
    const { findField, data, routeComponent } = await mountForm({
      schema: {
        fields: {
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
    expect(routeComponent.routeContext.isDirty).toBe(true)
    await findField('file').find('.dito-button--delete').trigger('click')
    await flushPromises()
    expect(data.file).toBe(null)
  })

  it('notifies of removed files with their escaped names', async () => {
    stubConfirm(true)
    const { admin, findField } = await mountForm({
      schema: {
        fields: { file: { type: 'upload', deletable: true } }
      },
      data: { file: { ...scan, name: 'Tom & Jerry.pdf' } }
    })
    const notify = vi.spyOn(admin.context, 'notify')
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
        fields: {
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
        fields: {
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
    const { findField, getComponent, data, routeComponent } = await mountForm({
      schema: {
        fields: {
          attachments: { type: 'upload', multiple: true, onChange }
        }
      },
      data: { attachments: [scan] }
    })
    const upload = getComponent('attachments')
    const uploadFile = createUploadFile(cover)
    upload.onInputFile(uploadFile, null)
    await flushPromises()
    expect(routeComponent.routeContext.isDirty).toBe(true)
    expect(data.attachments).toEqual([
      scan,
      {
        id: 'upload-1',
        name: 'cover.png',
        size: 2_500_000,
        // Refers to the upload by id, as the upload component replaces its
        // file objects on each update:
        upload: { id: 'upload-1', success: false }
      }
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
    expect(data.attachments[1].upload).toEqual({
      id: 'upload-1',
      success: true
    })
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
      schema: { fields: { file: { type: 'upload' } } }
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

  describe('submitting while files upload', () => {
    // Clicks the submit button while a file uploads, without waiting for the
    // form to settle, as it waits for the upload.
    async function submitWhileUploading() {
      const { wrapper, getComponent, request, settle } = await mountForm({
        schema: {
          fields: { attachments: { type: 'upload', multiple: true } }
        },
        data: { attachments: [scan] },
        request: ({ data }) => ({ data })
      })
      const upload = getComponent('attachments')
      const uploadFile = createUploadFile(cover)
      upload.onInputFile(uploadFile, null)
      await wrapper
        .find('.dito-buttons--main button[type="submit"]')
        .trigger('click')
      await flushPromises()
      // Returns the data that the form sent, or `null`:
      const getSentData = () => (
        request.mock.calls.find(
          ([{ method = 'get' }]) => method !== 'get'
        )?.[0].data ?? null
      )
      return { upload, uploadFile, settle, getSentData }
    }

    it('sends the files once they are uploaded', async () => {
      const { upload, uploadFile, settle, getSentData } =
        await submitWhileUploading()
      expect(getSentData()).toBe(null)
      upload.onInputFile(
        {
          ...uploadFile,
          success: true,
          response: [{ id: 'stored-1', ...cover }]
        },
        uploadFile
      )
      await settle()
      expect(getSentData()).toMatchObject({
        attachments: [scan, { id: 'stored-1', ...cover }]
      })
    })

    it(`doesn't wait for uploads that are removed`, async () => {
      const { upload, uploadFile, settle, getSentData } =
        await submitWhileUploading()
      upload.onInputFile(undefined, uploadFile)
      await settle()
      expect(getSentData()).toMatchObject({ attachments: [scan] })
    })

    it(`doesn't send files that fail to upload`, async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const { upload, uploadFile, settle, getSentData } =
        await submitWhileUploading()
      upload.onInputFile({ ...uploadFile, error: 'network' }, uploadFile)
      await settle()
      expect(getSentData()).toMatchObject({ attachments: [scan] })
    })
  })

  it('posts uploads to the upload resource of the data path', async () => {
    const { getComponent } = await mountForm({
      schema: { fields: { coverImage: { type: 'upload' } } },
      data: { coverImage: null }
    })
    expect(getComponent('coverImage').uploadPath).toBe(
      '/items/upload/coverImage'
    )
  })

  it('posts uploads with the API headers but without `Content-Type`', async () => {
    const { wrapper, getComponent } = await mountForm({
      schema: { fields: { file: { type: 'upload' } } },
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
      schema: { fields: { file: { type: 'upload' } } },
      data: { file: null },
      api: { cors: { credentials: true } }
    })
    const xhr = { withCredentials: false }
    getComponent('file').onInputFilter({ xhr })
    expect(xhr.withCredentials).toBe(true)
  })

  it(`doesn't post uploads in views without resource`, async () => {
    const { getComponent, findField } = await mountSchema({
      schema: { fields: { coverImage: { type: 'upload' } } }
    })
    expect(getComponent('coverImage').uploadPath).toBe(null)
    expect(findField('coverImage').find('.dito-upload__footer').exists()).toBe(
      true
    )
  })

  it(`doesn't submit forms with its buttons`, async () => {
    const { findField } = await mountForm({
      schema: {
        fields: {
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
        fields: {
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

  it('passes `accept` and `maxSize` to the file input', async () => {
    const { findField, wrapper } = await mountForm({
      schema: {
        fields: {
          file: {
            type: 'upload',
            accept: ['image/*', '.pdf'],
            maxSize: '2 MB'
          }
        }
      },
      data: { file: null }
    })
    expect(
      findField('file').find('input[type="file"]').attributes()
    ).toMatchObject(
      { accept: 'image/*,.pdf' }
    )
    expect(wrapper.findComponent(VueUpload).props('size')).toBe(2_000_000)
  })

  it('links files with `url` to their own URL', async () => {
    const { findField } = await mountForm({
      schema: {
        fields: {
          file: { type: 'upload', downloadUrl: () => '/files/other.pdf' }
        }
      },
      data: { file: { ...scan, url: 'https://example.com/scan.pdf' } }
    })
    expect(findField('file').find('a[download]').attributes('href')).toBe(
      'https://example.com/scan.pdf'
    )
  })

  it('removes deleted uploaded files from the upload component', async () => {
    stubConfirm(true)
    const { findField, getComponent, data } = await mountForm({
      schema: {
        fields: {
          attachments: { type: 'upload', multiple: true, deletable: true }
        }
      },
      data: { attachments: [] }
    })
    const upload = getComponent('attachments')
    const remove = vi.spyOn(upload.$refs.upload, 'remove')
    const uploadFile = createUploadFile(cover)
    upload.onInputFile(uploadFile, null)
    upload.onInputFile(
      {
        ...uploadFile,
        success: true,
        response: [{ id: 'stored-1', ...cover }]
      },
      uploadFile
    )
    await flushPromises()
    await findField('attachments').find('.dito-button--delete').trigger('click')
    await flushPromises()
    expect(data.attachments).toEqual([])
    expect(remove).toHaveBeenCalledWith('upload-1')
  })

  it('adds uploading files to multiple uploads without value', async () => {
    const { getComponent, data } = await mountForm({
      schema: {
        fields: { attachments: { type: 'upload', multiple: true } }
      },
      data: { attachments: null }
    })
    getComponent('attachments').onInputFile(createUploadFile(cover), null)
    expect(data.attachments).toEqual([
      expect.objectContaining({ id: 'upload-1', name: 'cover.png' })
    ])
  })

  it('ignores finished uploads of files that were removed meanwhile', async () => {
    const { getComponent, data } = await mountForm({
      schema: {
        fields: { attachments: { type: 'upload', multiple: true } }
      },
      data: { attachments: [scan] }
    })
    const upload = getComponent('attachments')
    const uploadFile = createUploadFile(cover)
    upload.onInputFile(uploadFile, null)
    data.attachments.splice(1, 1)
    const response = [{ id: 'stored-1', ...cover }]
    upload.onInputFile({ ...uploadFile, success: true, response }, uploadFile)
    expect(data.attachments).toEqual([scan])
    data.attachments = null
    upload.onInputFile({ ...uploadFile, success: true, response }, uploadFile)
    expect(data.attachments).toBe(null)
  })

  it('removes uploaded files without a file in the response', async () => {
    const { getComponent, data } = await mountForm({
      schema: {
        fields: { attachments: { type: 'upload', multiple: true } }
      },
      data: { attachments: [scan] }
    })
    const upload = getComponent('attachments')
    const uploadFile = createUploadFile(cover)
    upload.onInputFile(uploadFile, null)
    upload.onInputFile(
      { ...uploadFile, success: true, response: [] },
      uploadFile
    )
    expect(data.attachments).toEqual([scan])
  })

  it('notifies unknown upload errors with their code', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { getComponent } = await mountForm({
      schema: { fields: { file: { type: 'upload' } } }
    })
    const upload = getComponent('file')
    const uploadFile = createUploadFile(cover)
    upload.onInputFile(uploadFile, null)
    upload.onInputFile({ ...uploadFile, error: 'quota' }, uploadFile)
    await flushPromises()
    expect(document.querySelector('.dito-notification').textContent).toContain(
      `Unknown File Upload Error: 'quota'`
    )
  })

  it('opens the file dialog of the hidden input with the upload button', async () => {
    const { findField } = await mountForm({
      schema: { fields: { file: { type: 'upload' } } },
      data: { file: null }
    })
    const field = findField('file')
    const onClick = vi.fn(event => event.preventDefault())
    field.find('input[type="file"]').element.addEventListener('click', onClick)
    await field.find('tfoot .dito-button--upload').trigger('click')
    expect(onClick).toHaveBeenCalledOnce()
    expect(onClick.mock.calls[0][0]).toBeInstanceOf(MouseEvent)
  })

  describe('uploading', () => {
    // Records the requests of the upload component, which uploads with
    // `XMLHttpRequest`, so the tests can report progress and responses.
    function stubXMLHttpRequest() {
      const requests = []
      class XMLHttpRequest {
        upload = {}
        status = 0
        responseText = ''
        headers = {}
        constructor() {
          requests.push(this)
        }

        open(method, url) {
          Object.assign(this, { method, url })
        }

        setRequestHeader(name, value) {
          this.headers[name] = value
        }

        getResponseHeader() {
          return 'application/json'
        }

        send(body) {
          this.body = body
        }

        abort() {}

        progress(loaded) {
          this.upload.onprogress({ lengthComputable: true, loaded, total: 100 })
        }

        respond(file) {
          this.status = 200
          this.responseText = JSON.stringify([file])
          this.onload({ type: 'load' })
        }
      }
      vi.stubGlobal('XMLHttpRequest', XMLHttpRequest)
      return requests
    }

    it('uploads added files right away and shows their average progress', async () => {
      const requests = stubXMLHttpRequest()
      const { wrapper, findField, data } = await mountForm({
        schema: {
          fields: { attachments: { type: 'upload', multiple: true } }
        },
        data: { attachments: [] }
      })
      const field = findField('attachments')
      const upload = wrapper.findComponent(VueUpload)
      await upload.vm.add([
        new File(['cover'], 'cover.png', { type: 'image/png' }),
        new File(['scan'], 'scan.pdf', { type: 'application/pdf' })
      ])
      await flushPromises()
      expect(data.attachments.map(({ name }) => name)).toEqual([
        'cover.png',
        'scan.pdf'
      ])
      // The upload activates itself on the next tick, without a click, and
      // uploads one file after the other:
      await vi.waitFor(() => expect(requests).toHaveLength(1))
      expect(upload.vm.active).toBe(true)
      expect(requests[0]).toMatchObject({
        method: 'POST',
        url: '/items/upload/attachments'
      })
      // The progress bar shows the average of the progress of all files:
      requests[0].progress(50)
      await flushPromises()
      expect(field.find('progress').element.value).toBe(25)
      requests[0].respond({
        id: 'stored-1',
        name: 'cover.png',
        type: 'image/png',
        size: 5
      })
      await vi.waitFor(() => expect(requests).toHaveLength(2))
      await flushPromises()
      expect(field.find('progress').element.value).toBe(50)
      requests[1].progress(100)
      requests[1].respond({
        id: 'stored-2',
        name: 'scan.pdf',
        type: 'application/pdf',
        size: 4
      })
      await vi.waitFor(() => expect(upload.vm.active).toBe(false))
      await flushPromises()
      expect(data.attachments).toMatchObject([
        { id: 'stored-1', name: 'cover.png' },
        { id: 'stored-2', name: 'scan.pdf' }
      ])
      expect(getRows(field)).toEqual([
        ['cover.png', '5 B', 'Uploaded'],
        ['scan.pdf', '4 B', 'Uploaded']
      ])
      expect(field.find('progress').exists()).toBe(false)
    })

    it('shows the files that are uploading as such', async () => {
      const requests = stubXMLHttpRequest()
      const { wrapper, findField } = await mountForm({
        schema: {
          fields: { attachments: { type: 'upload', multiple: true } }
        },
        data: { attachments: [] }
      })
      await wrapper
        .findComponent(VueUpload)
        .vm.add([new File(['cover'], 'cover.png', { type: 'image/png' })])
      await vi.waitFor(() => expect(requests).toHaveLength(1))
      await flushPromises()
      expect(getRows(findField('attachments'))).toEqual([
        ['cover.png', '5 B', 'Uploading...']
      ])
    })

    it('previews the images that are uploading', async () => {
      const requests = stubXMLHttpRequest()
      const { wrapper, findField } = await mountForm({
        schema: {
          fields: {
            attachments: { type: 'upload', multiple: true, thumbnails: true }
          }
        },
        data: { attachments: [] }
      })
      await wrapper
        .findComponent(VueUpload)
        .vm.add([new File(['cover'], 'cover.png', { type: 'image/png' })])
      await vi.waitFor(() => expect(requests).toHaveLength(1))
      await vi.waitFor(() =>
        expect(
          findField('attachments').find('.dito-thumbnail img').attributes('src')
        ).toMatch(/^data:image\/png;base64,/)
      )
    })
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
          fields: {
            file: {
              type: 'upload',
              downloadUrl
            }
          }
        },
        data: { file: scan },
        api
      })
      // The download clicks a link with the file's name and URL:
      const download = vi.fn()
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
        function () {
          download({ filename: this.download, url: this.href })
        }
      )
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
          fields: {
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

    it(`doesn't move files past the ends of the list`, async () => {
      const { findField, data } = await mountAttachments()
      await findField('attachments')
        .find('.dito-button--drag')
        .trigger('keydown', { key: 'ArrowUp', altKey: true })
      await flushPromises()
      expect(data.attachments).toEqual([cover, scan])
    })

    it('stores the files in the order they are dragged into', async () => {
      const { findField, data, dataModel } = await mountAttachments()
      Sortable.get(findField('attachments').find('tbody').element).option(
        'onEnd'
      )({ oldIndex: 0, newIndex: 1 })
      await flushPromises()
      expect(data.attachments).toEqual([scan, cover])
      expect(dataModel.isDirty).toBe(true)
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
          fields: {
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
          fields: {
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
          fields: {
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
          fields: {
            title: { type: 'text' },
            cover: { type: 'upload', disabled: true }
          }
        }
      })
      await dispatchDragEvent(findField('title').element, 'dragenter')
      expect(wrapper.find('.dito-drag-overlay').exists()).toBe(false)
    })
  })

  describe('clipboard', () => {
    const stored = {
      cover: { ...cover, key: 'a1.png', url: '/a1.png', signature: 'f00' },
      scan: { ...scan, key: 'b2.pdf', url: '/b2.pdf', signature: 'ba5' }
    }

    afterEach(async () => {
      await copyClipboardData('reset', null)
    })

    async function mountImages({ name = 'images', schema, data }) {
      const result = await mountForm({
        schema: {
          fields: {
            [name]: { type: 'upload', clipboard: true, ...schema }
          }
        },
        data: { [name]: data }
      })
      const container = result.findContainer(name)
      return {
        ...result,
        copyButton: container.find('.dito-button--copy'),
        pasteButton: container.find('.dito-button--paste')
      }
    }

    // Copy from a field of another name in another admin, like in another
    // record:
    async function copyImages(images) {
      const { admin, copyButton } = await mountImages({
        name: 'gallery',
        schema: { multiple: true },
        data: images
      })
      await copyButton.trigger('click')
      await flushPromises()
      // Forms teleport their header into the first admin:
      unmountAdmin(admin)
    }

    it('copies the stored files of the field', async () => {
      await copyImages([stored.cover, stored.scan])
      expect(getClipboardData('gallery', 'upload')).toEqual({
        files: [stored.cover, stored.scan]
      })
    })

    it('shows the clipboard before the upload button', async () => {
      const { findField } = await mountImages({
        schema: { multiple: true },
        data: [stored.scan]
      })
      const buttons = findField('images').findAll(
        '.dito-upload__footer > .dito-buttons > *'
      )
      expect(buttons.map(button => button.classes())).toEqual([
        expect.arrayContaining(['dito-clipboard']),
        expect.arrayContaining(['dito-button--upload'])
      ])
    })

    it('shows the clipboard before the upload button of single files', async () => {
      const { findField } = await mountImages({ data: stored.scan })
      const field = findField('images')
      const buttons = field.findAll('tbody .dito-table__buttons > div > *')
      expect(buttons.map(button => button.classes())).toEqual([
        expect.arrayContaining(['dito-clipboard']),
        expect.arrayContaining(['dito-button--upload'])
      ])
      expect(field.find('tfoot').exists()).toBe(false)
    })

    it('adds pasted files to multiple files, except existing ones', async () => {
      await copyImages([stored.cover, stored.scan])
      const { pasteButton, data, dataModel } = await mountImages({
        schema: { multiple: true },
        data: [stored.scan]
      })
      await pasteButton.trigger('click')
      await flushPromises()
      expect(data.images).toEqual([stored.scan, stored.cover])
      expect(dataModel.isDirty).toBe(true)
    })

    it('replaces a single file with the first pasted file', async () => {
      await copyImages([stored.cover, stored.scan])
      const { pasteButton, data, dataModel } = await mountImages({
        data: stored.scan
      })
      await pasteButton.trigger('click')
      await flushPromises()
      expect(data.images).toEqual(stored.cover)
      expect(dataModel.isDirty).toBe(true)
    })

    it(`doesn't paste files with other extensions and notifies`, async () => {
      await copyImages([stored.cover, stored.scan])
      const { pasteButton, data } = await mountImages({
        schema: { multiple: true, extensions: ['pdf'] },
        data: []
      })
      await pasteButton.trigger('click')
      await flushPromises()
      expect(data.images).toEqual([stored.scan])
      expect(
        document.querySelector('.dito-notification').textContent
      ).toContain('Not accepted when pasting: cover.png')
    })

    it(`doesn't paste the data of forms with the same name`, async () => {
      const { pasteButton } = await mountImages({ data: null })
      await copyClipboardData('images', { files: [stored.cover] })
      await flushPromises()
      expect(pasteButton.attributes('disabled')).toBeDefined()
    })

    it(`doesn't paste files into forms with the same name`, async () => {
      await copyImages([stored.cover])
      const { wrapper } = await mountForm({
        schema: {
          name: 'gallery',
          clipboard: true,
          fields: { title: { type: 'text' } }
        },
        data: { title: 'Emma' }
      })
      const pasteButton = wrapper.find('.dito-clipboard .dito-button--paste')
      expect(pasteButton.attributes('disabled')).toBeDefined()
    })

    it(`doesn't paste into disabled fields`, async () => {
      await copyImages([stored.cover])
      const { pasteButton } = await mountImages({
        schema: { disabled: true },
        data: null
      })
      expect(pasteButton.attributes('disabled')).toBeDefined()
    })
  })
})
