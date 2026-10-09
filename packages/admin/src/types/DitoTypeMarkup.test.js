import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSchema, mountForm, unmountAdmin } from '../test/mount.js'

function getButtonLabels(field) {
  return field
    .findAll('.dito-buttons--toolbar button')
    .map(button => button.attributes('aria-label'))
}

async function clickButton(field, label) {
  await field
    .find(`.dito-buttons--toolbar button[aria-label="${label}"]`)
    .trigger('click')
  await flushPromises()
}

describe('DitoTypeMarkup', () => {
  it('displays the value in the editor', async () => {
    const { findField } = await mountSchema({
      schema: { components: { body: { type: 'markup' } } },
      data: { body: '<p>Call me <strong>Ishmael</strong>.</p>' }
    })
    expect(findField('body').find('.ProseMirror').html()).toContain(
      '<p>Call me Ishmael.</p>'
    )
  })

  it('renders the toolbar buttons of the enabled marks and nodes', async () => {
    const { findField } = await mountSchema({
      schema: {
        components: {
          body: {
            type: 'markup',
            marks: { bold: true, italic: true, link: true },
            nodes: { heading: [1, 2], bulletList: true },
            tools: { history: true }
          }
        }
      }
    })
    expect(getButtonLabels(findField('body'))).toEqual([
      'Bold',
      'Italic',
      'Link',
      'Heading 1',
      'Heading 2',
      'Bullet List',
      'Undo',
      'Redo'
    ])
  })

  it('applies marks to the selection and writes the value', async () => {
    const { findField, getComponent, data } = await mountSchema({
      schema: {
        components: { body: { type: 'markup', marks: { bold: true } } }
      },
      data: { body: '<p>Emma</p>' }
    })
    const field = findField('body')
    getComponent('body').editor.commands.selectAll()
    await clickButton(field, 'Bold')
    await vi.waitFor(() =>
      expect(data.body).toBe('<p><strong>Emma</strong></p>')
    )
    expect(
      field.find('button[aria-label="Bold"]').attributes('aria-pressed')
    ).toBe('true')
  })

  it('formats blocks as headings of the enabled levels', async () => {
    const { findField, getComponent, data } = await mountSchema({
      schema: {
        components: { body: { type: 'markup', nodes: { heading: [2] } } }
      },
      data: { body: '<p>Chapter One</p>' }
    })
    getComponent('body').editor.commands.selectAll()
    await clickButton(findField('body'), 'Heading 2')
    await vi.waitFor(() => expect(data.body).toBe('<h2>Chapter One</h2>'))
  })

  it('updates the editor when the value changes', async () => {
    const { findField, data, settle } = await mountSchema({
      schema: { components: { body: { type: 'markup' } } },
      data: { body: '<p>Emma</p>' }
    })
    data.body = '<p>Persuasion</p>'
    await settle()
    expect(findField('body').find('.ProseMirror').text()).toBe('Persuasion')
  })

  it('stores single paragraphs without `<p>` with `hardBreak`', async () => {
    const { getComponent, data } = await mountSchema({
      schema: {
        components: {
          caption: { type: 'markup', hardBreak: true, marks: { bold: true } }
        }
      },
      data: { caption: 'Emma' }
    })
    const { editor } = getComponent('caption')
    expect(editor.getHTML()).toBe('<p>Emma</p>')
    editor.chain().selectAll().toggleBold().run()
    await vi.waitFor(() => expect(data.caption).toBe('<strong>Emma</strong>'))
  })

  it(`doesn't allow editing disabled fields`, async () => {
    const { getComponent, data, settle } = await mountSchema({
      schema: {
        components: {
          isLocked: { type: 'checkbox' },
          body: { type: 'markup', disabled: ({ item }) => item.isLocked }
        }
      },
      data: { isLocked: true, body: '<p>Emma</p>' }
    })
    expect(getComponent('body').editor.isEditable).toBe(false)
    data.isLocked = false
    await settle()
    expect(getComponent('body').editor.isEditable).toBe(true)
  })

  it('emits change once the editor is blurred', async () => {
    const onChange = vi.fn()
    const { getComponent, data } = await mountForm({
      schema: {
        components: {
          body: { type: 'markup', marks: { italic: true }, onChange }
        }
      },
      data: { body: '<p>Emma</p>' }
    })
    const { editor } = getComponent('body')
    editor.commands.focus()
    editor.chain().selectAll().toggleItalic().run()
    editor.commands.blur()
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledOnce())
    expect(data.body).toBe('<p><em>Emma</em></p>')
    // Let the debounced write of the edit pass, see the test below:
    await new Promise(resolve => setTimeout(resolve, 150))
  })

  // Bug: The debounced write of edits isn't cancelled on unmount, so edits
  // made right before unmounting read the destroyed editor, which throws.
  test.fails(`doesn't read the destroyed editor after unmounting`, async () => {
    const { admin, getComponent } = await mountSchema({
      schema: { components: { body: { type: 'markup' } } },
      data: { body: '<p>Emma</p>' }
    })
    const { editor } = getComponent('body')
    let hasReadDestroyedEditor = false
    // Record the reads instead of throwing like the destroyed editor does:
    vi.spyOn(editor, 'getHTML').mockImplementation(() => {
      hasReadDestroyedEditor ||= editor.isDestroyed
      return '<p>Emma!</p>'
    })
    editor.commands.insertContent('!')
    unmountAdmin(admin)
    await new Promise(resolve => setTimeout(resolve, 150))
    expect(hasReadDestroyedEditor).toBe(false)
  })

  // Bug: `getExtensions()` swaps the extensions of `marks.subscript` and
  // `marks.superscript`, so the subscript button has no command to run.
  test.fails('applies subscript with `marks.subscript`', async () => {
    const { findField, getComponent, data } = await mountSchema({
      schema: {
        components: { formula: { type: 'markup', marks: { subscript: true } } }
      },
      data: { formula: '<p>H2O</p>' }
    })
    getComponent('formula').editor.commands.selectAll()
    await clickButton(findField('formula'), 'Subscript')
    await vi.waitFor(() => expect(data.formula).toBe('<p><sub>H2O</sub></p>'))
  })
})
