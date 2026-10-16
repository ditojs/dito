import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { mountForm, mountSchema } from '../test/mount.js'

const stored = {
  cover: {
    key: 'a1.png',
    name: 'cover.png',
    type: 'image/png',
    size: 5,
    width: 2,
    height: 1,
    url: '/files/a1.png',
    signature: 'f00'
  },
  scan: {
    key: 'b2.pdf',
    name: 'scan.pdf',
    type: 'application/pdf',
    size: 4,
    url: '/files/b2.pdf',
    signature: 'ba5'
  }
}

const contentsByUrl = {
  '/files/a1.png': 'cover',
  '/files/b2.pdf': 'scan'
}

const reference = {
  cover: {
    key: 'a1.png',
    name: 'cover.png',
    type: 'image/png',
    size: 5,
    width: 2,
    height: 1,
    $file: 'files/a1.png'
  },
  scan: {
    key: 'b2.pdf',
    name: 'scan.pdf',
    type: 'application/pdf',
    size: 4,
    $file: 'files/b2.pdf'
  }
}

function getNotificationTexts() {
  return [...document.querySelectorAll('.dito-notification')].map(
    notification => notification.textContent
  )
}

function createZip(data, files = {}) {
  return zipSync({
    'data.json': strToU8(JSON.stringify(data)),
    ...Object.fromEntries(
      Object.entries(files).map(([path, content]) => [path, strToU8(content)])
    )
  })
}

// Stub the anchor that `downloadBlob()` clicks, and its object URL:
function stubDownloads() {
  const blobs = []
  const filenames = []
  vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => {
    blobs.push(blob)
    return 'blob:download'
  })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
    function () {
      filenames.push(this.download)
    }
  )
  return { blobs, filenames }
}

async function selectMenuItem(clipboard, label) {
  await clipboard.find('.dito-button--interchange').trigger('click')
  await flushPromises()
  const item = clipboard
    .findAll('.dito-menu-button__item')
    .find(item => item.attributes('title') === label)
  await item.trigger('click')
  await flushPromises()
}

// The server stores uploads under new keys and returns them signed:
function createUploadedFile(file) {
  return {
    key: `new-${file.name}`,
    name: file.name,
    type: file.type,
    size: file.size,
    url: `/files/new-${file.name}`,
    signature: 'c0ffee'
  }
}

async function mountBook({
  clipboard: clipboardConfig = { interchange: true },
  data
} = {}) {
  const uploads = []
  const result = await mountForm({
    schema: {
      name: 'book',
      label: 'Book',
      clipboard: clipboardConfig,
      components: {
        title: { type: 'text' },
        cover: { type: 'upload', extensions: ['png'], maxSize: '1 kB' },
        chapters: {
          type: 'list',
          inlined: true,
          form: {
            type: 'form',
            components: {
              heading: { type: 'text' },
              scans: { type: 'upload', multiple: true }
            }
          }
        }
      }
    },
    data: data ?? { title: 'Emma', cover: null, chapters: [] },
    request({ method, url, data }) {
      if (method === 'post' && url.startsWith('/items/upload/')) {
        const [[name, file]] = [...data.entries()]
        uploads.push({ url, name, file })
        return { data: [createUploadedFile(file)] }
      }
      throw new Error(`Unexpected request: ${method} ${url}`)
    }
  })
  const { wrapper } = result
  const clipboard = wrapper.find('.dito-schema-header .dito-clipboard')
  return {
    ...result,
    clipboard,
    uploads,

    selectMenuItem: label => selectMenuItem(clipboard, label),

    async uploadZip(zip) {
      const input = clipboard.find('input[type="file"]')
      const file = new File([zip], 'book.zip', { type: 'application/zip' })
      Object.defineProperty(input.element, 'files', {
        value: [file],
        configurable: true
      })
      await input.trigger('change')
      await vi.waitFor(() => flushPromises())
      await flushPromises()
    }
  }
}

describe('DitoClipboard interchange', () => {
  beforeEach(() => {
    // Notifications are logged too:
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('joins copy and paste without a menu, without `interchange`', async () => {
    const { clipboard } = await mountBook({ clipboard: true })
    expect(clipboard.find('.dito-button--copy').exists()).toBe(true)
    expect(clipboard.find('.dito-button--paste').exists()).toBe(true)
    expect(clipboard.find('.dito-button--interchange').exists()).toBe(false)
    expect(clipboard.find('input[type="file"]').exists()).toBe(false)
  })

  it('offers to download and upload in the menu', async () => {
    const { clipboard } = await mountBook()
    await clipboard.find('.dito-button--interchange').trigger('click')
    await flushPromises()
    const items = clipboard.findAll('.dito-menu-button__item')
    expect(items.map(item => item.attributes('title'))).toEqual([
      'Download',
      'Upload'
    ])
    expect(items.map(item => item.find('.dito-icon').classes())).toEqual([
      ['dito-icon', 'dito-icon--archive-download'],
      ['dito-icon', 'dito-icon--archive-upload']
    ])
    expect(clipboard.find('input[type="file"]').attributes('accept')).toBe(
      '.zip'
    )
  })

  it('downloads the data with its files as a zip', async () => {
    const fetch = vi.fn(async url => ({
      ok: true,
      blob: async () => new Blob([contentsByUrl[url]])
    }))
    vi.stubGlobal('fetch', fetch)
    const { blobs, filenames } = stubDownloads()
    const { selectMenuItem } = await mountBook({
      data: {
        title: 'Emma',
        cover: stored.cover,
        chapters: [{ heading: 'One', scans: [stored.scan, stored.cover] }]
      }
    })
    await selectMenuItem('Download')
    await vi.waitFor(() => expect(blobs).toHaveLength(1))
    expect(filenames).toEqual(['Book.zip'])
    const files = unzipSync(new Uint8Array(await blobs[0].arrayBuffer()))
    expect(Object.keys(files).sort()).toEqual([
      'data.json',
      'files/a1.png',
      'files/b2.pdf'
    ])
    expect(strFromU8(files['files/a1.png'])).toBe('cover')
    expect(strFromU8(files['files/b2.pdf'])).toBe('scan')
    // The file of both fields is only fetched once:
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(JSON.parse(strFromU8(files['data.json']))).toEqual({
      $schema: 'book',
      title: 'Emma',
      cover: reference.cover,
      chapters: [
        { heading: 'One', scans: [reference.scan, reference.cover] }
      ]
    })
  })

  it('names downloads after the form and item label', async () => {
    const { filenames } = stubDownloads()
    const { wrapper } = await mountForm({
      schema: {
        label: 'Page',
        clipboard: { interchange: true },
        components: { name: { type: 'text' } }
      },
      data: { name: 'Home' }
    })
    await selectMenuItem(
      wrapper.find('.dito-schema-header .dito-clipboard'),
      'Download'
    )
    await vi.waitFor(() => expect(filenames).toHaveLength(1))
    expect(filenames).toEqual(['Page Home.zip'])
  })

  it('names downloads through `interchange.filename`', async () => {
    const { filenames } = stubDownloads()
    const { wrapper } = await mountForm({
      schema: {
        label: 'Page',
        clipboard: {
          interchange: {
            filename: ({ clipboardItem }) => `page-${clipboardItem.name}.zip`
          }
        },
        components: { name: { type: 'text' } }
      },
      data: { name: 'Home' }
    })
    await selectMenuItem(
      wrapper.find('.dito-schema-header .dito-clipboard'),
      'Download'
    )
    await vi.waitFor(() => expect(filenames).toHaveLength(1))
    expect(filenames).toEqual(['page-Home.zip'])
  })

  it('names downloads without characters invalid in file names', async () => {
    const { filenames } = stubDownloads()
    const { wrapper } = await mountForm({
      schema: {
        label: 'Page',
        clipboard: { interchange: true },
        components: { name: { type: 'text' } }
      },
      data: { name: `Home: 'Vol. 1' / <Draft>?` }
    })
    await selectMenuItem(
      wrapper.find('.dito-schema-header .dito-clipboard'),
      'Download'
    )
    await vi.waitFor(() => expect(filenames).toHaveLength(1))
    expect(filenames).toEqual([`Page Home 'Vol. 1' Draft.zip`])
  })

  it('names downloads of forms without labels and name `data`', async () => {
    const { filenames } = stubDownloads()
    const { wrapper } = await mountForm({
      schema: {
        clipboard: { interchange: true },
        components: { title: { type: 'text' } }
      },
      data: { title: 'Emma' }
    })
    await selectMenuItem(
      wrapper.find('.dito-schema-header .dito-clipboard'),
      'Download'
    )
    await vi.waitFor(() => expect(filenames).toHaveLength(1))
    expect(filenames).toEqual(['data.zip'])
  })

  it('names downloads of lists after their label', async () => {
    const { filenames } = stubDownloads()
    const { findContainer } = await mountSchema({
      schema: {
        components: {
          links: {
            type: 'list',
            label: 'Links',
            inlined: true,
            clipboard: { interchange: true },
            form: { type: 'form', components: { url: { type: 'text' } } }
          }
        }
      },
      data: { links: [{ url: 'https://example.com' }] }
    })
    await selectMenuItem(
      findContainer('links').find('.dito-clipboard'),
      'Download'
    )
    await vi.waitFor(() => expect(filenames).toHaveLength(1))
    expect(filenames).toEqual(['Links.zip'])
  })

  it('uploads the files of a zip to their fields and pastes its data', async () => {
    const { uploadZip, uploads, data, dataModel } = await mountBook()
    await uploadZip(
      createZip(
        {
          $schema: 'book',
          title: 'Persuasion',
          cover: reference.cover,
          chapters: [{ heading: 'One', scans: [reference.scan] }]
        },
        { 'files/a1.png': 'cover', 'files/b2.pdf': 'scan' }
      )
    )
    expect(
      uploads.map(({ url, name, file }) => [url, name, file.name, file.type])
    ).toEqual([
      ['/items/upload/cover', 'cover', 'cover.png', 'image/png'],
      [
        '/items/upload/chapters/0/scans',
        'chapters/0/scans',
        'scan.pdf',
        'application/pdf'
      ]
    ])
    expect(await uploads[0].file.text()).toBe('cover')
    expect(data.title).toBe('Persuasion')
    expect(data.cover).toEqual(createUploadedFile(reference.cover))
    expect(data.chapters).toMatchObject([
      { heading: 'One', scans: [createUploadedFile(reference.scan)] }
    ])
    expect(dataModel.isDirty).toBe(true)
  })

  it('pastes the result of `clipboard.paste()` after uploading', async () => {
    const paste = vi.fn(({ clipboardItem }) => ({
      ...clipboardItem,
      title: `${clipboardItem.title} (Copy)`
    }))
    const { uploadZip, data } = await mountBook({
      clipboard: { interchange: true, paste }
    })
    await uploadZip(
      createZip(
        { $schema: 'book', title: 'Emma', cover: reference.cover },
        { 'files/a1.png': 'cover' }
      )
    )
    expect(paste.mock.calls[0][0].clipboardItem.cover).toEqual(
      createUploadedFile(reference.cover)
    )
    expect(data.title).toBe('Emma (Copy)')
  })

  it(`doesn't upload zips of other schemas or types`, async () => {
    const { uploadZip, uploads, data } = await mountBook()
    await uploadZip(
      createZip(
        { $schema: 'author', title: 'Jane', cover: reference.cover },
        { 'files/a1.png': 'cover' }
      )
    )
    await uploadZip(
      createZip({ $schema: 'book', $type: 'list', items: [] })
    )
    expect(uploads).toEqual([])
    expect(data.title).toBe('Emma')
    expect(
      getNotificationTexts().filter(text =>
        text.includes(`The file doesn't contain data of 'book'.`)
      )
    ).toHaveLength(2)
  })

  it('leaves out unreferenced entries, and files that fields reject', async () => {
    const { uploadZip, uploads, data } = await mountBook()
    await uploadZip(
      createZip(
        {
          $schema: 'book',
          title: 'Persuasion',
          // Declared smaller than the file in the zip, which exceeds `maxSize`:
          cover: reference.cover,
          chapters: [
            {
              heading: 'One',
              scans: [reference.scan, { ...reference.scan, $file: 'missing' }]
            }
          ]
        },
        {
          'files/a1.png': 'x'.repeat(2000),
          'files/b2.pdf': 'scan',
          '../etc/passwd': 'root'
        }
      )
    )
    expect(uploads.map(({ name }) => name)).toEqual(['chapters/0/scans'])
    expect(data.title).toBe('Persuasion')
    expect(data.cover).toBe(null)
    expect(data.chapters[0].scans).toEqual([
      createUploadedFile(reference.scan)
    ])
    expect(getNotificationTexts().join()).toContain(
      'Not accepted when uploading: cover.png, scan.pdf'
    )
  })

  it(`doesn't upload files with extensions that the field rejects`, async () => {
    const { uploadZip, uploads, data } = await mountBook()
    await uploadZip(
      createZip(
        { $schema: 'book', title: 'Emma', cover: reference.scan },
        { 'files/b2.pdf': 'scan' }
      )
    )
    expect(uploads).toEqual([])
    expect(data.cover).toBe(null)
  })

  it('notifies zips without data', async () => {
    const { uploadZip } = await mountBook()
    await uploadZip(zipSync({ 'other.json': strToU8('{}') }))
    expect(getNotificationTexts().join()).toContain(
      `Unable to find 'data.json' in the zip file.`
    )
  })

  describe('uploads', () => {
    async function mountGallery() {
      const uploads = []
      const result = await mountForm({
        schema: {
          components: {
            gallery: {
              type: 'upload',
              multiple: true,
              clipboard: { interchange: true }
            }
          }
        },
        data: { gallery: [] },
        request({ method, url, data }) {
          if (method === 'post') {
            const [[name, file]] = [...data.entries()]
            uploads.push({ url, name })
            return { data: [createUploadedFile(file)] }
          }
          throw new Error(`Unexpected request: ${method} ${url}`)
        }
      })
      return { ...result, uploads }
    }

    it('names downloads after the label of the field', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({ ok: true, blob: async () => new Blob(['x']) }))
      )
      const { filenames } = stubDownloads()
      const { findContainer, data } = await mountGallery()
      data.gallery.push(stored.cover)
      await flushPromises()
      await selectMenuItem(
        findContainer('gallery').find('.dito-clipboard'),
        'Download'
      )
      await vi.waitFor(() => expect(filenames).toHaveLength(1))
      expect(filenames).toEqual(['Gallery.zip'])
    })

    it('uploads files of other upload fields into the field', async () => {
      const { findContainer, uploads, data } = await mountGallery()
      const input = findContainer('gallery').find('input[accept=".zip"]')
      const zip = createZip(
        { $schema: 'cover', $type: 'upload', files: [reference.cover] },
        { 'files/a1.png': 'cover' }
      )
      Object.defineProperty(input.element, 'files', {
        value: [new File([zip], 'cover.zip')]
      })
      await input.trigger('change')
      await vi.waitFor(() => expect(data.gallery).toHaveLength(1))
      expect(uploads).toEqual([
        { url: '/items/upload/gallery', name: 'gallery' }
      ])
      expect(data.gallery).toEqual([createUploadedFile(reference.cover)])
    })
  })
})
