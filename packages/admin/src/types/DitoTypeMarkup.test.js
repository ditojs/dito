import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import {
  mountSchema,
  mountForm,
  unmountAdmin,
  enterValue
} from '../test/mount.js'

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

// Drags the resize `handle` with the pointer from `startY` to `endY`.
async function dragResizeHandle(handle, startY, endY) {
  const options = { pointerId: 1, button: 0 }
  await handle.trigger('pointerdown', { ...options, clientY: startY })
  await handle.trigger('pointermove', { ...options, clientY: endY })
  await handle.trigger('pointerup', { ...options, clientY: endY })
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

  // Edits made right before unmounting are written before the editor is
  // destroyed, as reading the destroyed editor throws.
  it('writes pending edits before destroying the editor', async () => {
    const { admin, getComponent, data } = await mountSchema({
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
    expect(data.body).toBe('<p>Emma!</p>')
  })

  it('applies subscript with `marks.subscript`', async () => {
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

  it('applies superscript with `marks.superscript`', async () => {
    const { findField, getComponent, data } = await mountSchema({
      schema: {
        components: {
          formula: { type: 'markup', marks: { superscript: true } }
        }
      },
      data: { formula: '<p>E=mc2</p>' }
    })
    getComponent('formula').editor.commands.selectAll()
    await clickButton(findField('formula'), 'Superscript')
    await vi.waitFor(() => expect(data.formula).toBe('<p><sup>E=mc2</sup></p>'))
  })

  it('passes `autofocus` and `enableRules` to the editor', async () => {
    const { getComponent } = await mountSchema({
      schema: {
        components: {
          body: { type: 'markup' },
          notes: {
            type: 'markup',
            autofocus: true,
            enableRules: { input: true, paste: false }
          }
        }
      }
    })
    const { options: bodyOptions } = getComponent('body').editor
    expect(bodyOptions.autofocus).toBe(false)
    expect(bodyOptions.enableInputRules).toBe(false)
    expect(bodyOptions.enablePasteRules).toBe(false)
    const { options: notesOptions } = getComponent('notes').editor
    expect(notesOptions.autofocus).toBe(true)
    expect(notesOptions.enableInputRules).toBe(true)
    expect(notesOptions.enablePasteRules).toBe(false)
  })

  it('clears the editor when the value becomes null with `hardBreak`', async () => {
    const { getComponent, data, settle } = await mountSchema({
      schema: { components: { caption: { type: 'markup', hardBreak: true } } },
      data: { caption: 'Emma' }
    })
    data.caption = null
    await settle()
    expect(getComponent('caption').editor.getText()).toBe('')
  })

  it(`doesn't submit forms with the toolbar buttons`, async () => {
    const { findField } = await mountSchema({
      schema: {
        components: { body: { type: 'markup', marks: { bold: true } } }
      }
    })
    const types = findField('body')
      .findAll('.dito-buttons--toolbar button')
      .map(button => button.attributes('type'))
    expect(types).toEqual(['button'])
  })

  it('resizes the editor by dragging and with the arrow keys', async () => {
    const { findField, settle } = await mountSchema({
      schema: {
        components: { body: { type: 'markup', resizable: true } }
      }
    })
    const field = findField('body')
    // happy-dom doesn't lay out, so the editor gets a height to start from:
    const editor = field.find('.dito-markup-editor').element
    editor.style.height = '100px'
    editor.style.fontSize = '10px'
    const handle = field.find('.dito-resize')
    await dragResizeHandle(handle, 50, 80)
    await settle()
    expect(editor.style.height).toBe('130px')
    await handle.trigger('keydown', { key: 'ArrowUp' })
    await settle()
    expect(editor.style.height).toBe('120px')
  })

  describe('links', () => {
    const schema = {
      components: { body: { type: 'markup', marks: { link: true } } }
    }

    // Clicks the link button and returns the wrapper of the dialog it opens.
    async function openLinkDialog(admin, field) {
      await clickButton(field, 'Link')
      await vi.waitFor(() => {
        if (!admin.wrapper.find('.dito-dialog').exists()) {
          throw new Error('No dialog yet')
        }
      })
      return admin.wrapper.find('.dito-dialog')
    }

    async function clickDialogButton(dialog, label) {
      await dialog.find(`button[aria-label="${label}"]`).trigger('click')
      await flushPromises()
    }

    async function mountLinkSchema(body) {
      const result = await mountSchema({ schema, data: { body } })
      result.getComponent('body').editor.commands.selectAll()
      return result
    }

    it('adds links and prefixes them with `https://`', async () => {
      const { admin, findField, data } = await mountLinkSchema('<p>Emma</p>')
      const dialog = await openLinkDialog(admin, findField('body'))
      await enterValue(dialog.find('input[name="href"]'), 'example.com')
      await enterValue(dialog.find('input[name="title"]'), 'Novel')
      await dialog.find('form').trigger('submit')
      await vi.waitFor(() =>
        expect(data.body).toBe(
          '<p><a href="https://example.com" title="Novel">Emma</a></p>'
        )
      )
    })

    it('keeps the protocol of links that are valid URLs', async () => {
      const { admin, findField, data } = await mountLinkSchema('<p>Emma</p>')
      const dialog = await openLinkDialog(admin, findField('body'))
      await enterValue(
        dialog.find('input[name="href"]'),
        'mailto:emma@example.com'
      )
      await dialog.find('form').trigger('submit')
      await vi.waitFor(() =>
        expect(data.body).toBe(
          '<p><a href="mailto:emma@example.com">Emma</a></p>'
        )
      )
    })

    it('edits the attributes of existing links', async () => {
      const { admin, findField, data } = await mountLinkSchema(
        '<p><a href="https://example.com" title="Old">Emma</a></p>'
      )
      const dialog = await openLinkDialog(admin, findField('body'))
      expect(dialog.find('input[name="href"]').element.value).toBe(
        'https://example.com'
      )
      expect(dialog.find('input[name="title"]').element.value).toBe('Old')
      await enterValue(dialog.find('input[name="title"]'), 'New')
      await dialog.find('form').trigger('submit')
      await vi.waitFor(() =>
        expect(data.body).toBe(
          '<p><a href="https://example.com" title="New">Emma</a></p>'
        )
      )
    })

    it('removes links with the remove button', async () => {
      const { admin, findField, data } = await mountLinkSchema(
        '<p><a href="https://example.com">Emma</a></p>'
      )
      const dialog = await openLinkDialog(admin, findField('body'))
      await clickDialogButton(dialog, 'Remove')
      await vi.waitFor(() => expect(data.body).toBe('<p>Emma</p>'))
    })

    // Bug: Applying the dialog without a URL creates an `<a href="">` link to
    // the current page, instead of removing the link like the remove button.
    it.fails('removes the link when applied without a URL', async () => {
      const { admin, findField, data } = await mountLinkSchema(
        '<p><a href="https://example.com">Emma</a></p>'
      )
      const dialog = await openLinkDialog(admin, findField('body'))
      await enterValue(dialog.find('input[name="href"]'), '')
      await dialog.find('form').trigger('submit')
      await vi.waitFor(() => expect(data.body).toBe('<p>Emma</p>'))
    })

    it('keeps links when the dialog is cancelled', async () => {
      const { admin, findField, getComponent, settle } = await mountLinkSchema(
        '<p><a href="https://example.com">Emma</a></p>'
      )
      const dialog = await openLinkDialog(admin, findField('body'))
      await clickDialogButton(dialog, 'Cancel')
      await settle()
      expect(admin.wrapper.find('.dito-dialog').exists()).toBe(false)
      expect(getComponent('body').editor.getHTML()).toBe(
        '<p><a href="https://example.com">Emma</a></p>'
      )
    })
  })

  it('applies the enabled marks through the toolbar', async () => {
    const marks = ['underline', 'strike', 'small', 'code']
    const { findField, getComponent } = await mountSchema({
      schema: {
        components: {
          body: {
            type: 'markup',
            marks: Object.fromEntries(marks.map(mark => [mark, true]))
          }
        }
      }
    })
    const field = findField('body')
    const { editor } = getComponent('body')
    const results = {}
    for (const label of getButtonLabels(field)) {
      editor.commands.setContent('<p>Emma</p>')
      editor.commands.selectAll()
      await clickButton(field, label)
      results[label] = editor.getHTML()
    }
    expect(results).toEqual({
      Underline: '<p><u>Emma</u></p>',
      Strike: '<p><s>Emma</s></p>',
      Small: '<p><small>Emma</small></p>',
      Code: '<p><code>Emma</code></p>'
    })
  })

  it('parses, sets and unsets `<small>` with `marks.small`', async () => {
    const { getComponent } = await mountSchema({
      schema: {
        components: { body: { type: 'markup', marks: { small: true } } }
      },
      data: { body: '<p><small>Emma</small></p>' }
    })
    const { editor } = getComponent('body')
    editor.commands.selectAll()
    expect(editor.isActive('small')).toBe(true)
    editor.commands.unsetSmall()
    expect(editor.getHTML()).toBe('<p>Emma</p>')
    editor.commands.setSmall()
    expect(editor.getHTML()).toBe('<p><small>Emma</small></p>')
  })

  it('formats blocks with the enabled list and block nodes', async () => {
    const nodes = ['bulletList', 'orderedList', 'blockquote', 'codeBlock']
    const { findField, getComponent } = await mountSchema({
      schema: {
        components: {
          body: {
            type: 'markup',
            nodes: Object.fromEntries(nodes.map(node => [node, true]))
          }
        }
      },
      data: { body: '<p>Emma</p>' }
    })
    const field = findField('body')
    const { editor } = getComponent('body')
    const results = {}
    for (const label of getButtonLabels(field)) {
      editor.commands.setContent('<p>Emma</p>')
      editor.commands.selectAll()
      await clickButton(field, label)
      results[label] = editor.getHTML()
    }
    expect(results).toEqual({
      'Bullet List': '<ul><li><p>Emma</p></li></ul>',
      'Ordered List': '<ol><li><p>Emma</p></li></ol>',
      'Blockquote': '<blockquote><p>Emma</p></blockquote>',
      'Code Block': '<pre><code>Emma</code></pre>'
    })
  })

  // Bug: `nodes.heading: true` is passed to Tiptap as `levels: true`, which
  // throws as it expects an array, so the editor isn't created.
  it.fails(
    'supports all heading levels with `nodes.heading: true`',
    async () => {
      const { getComponent } = await mountSchema({
        schema: {
          components: { body: { type: 'markup', nodes: { heading: true } } }
        },
        data: { body: '<h2>Emma</h2>' }
      })
      expect(getComponent('body').editor.getHTML()).toBe('<h2>Emma</h2>')
    }
  )

  it('sets paragraphs with the paragraph button', async () => {
    const { findField, getComponent, data } = await mountSchema({
      schema: {
        components: {
          body: {
            type: 'markup',
            nodes: { paragraph: true, heading: [1] }
          }
        }
      },
      data: { body: '<h1>Emma</h1>' }
    })
    getComponent('body').editor.commands.selectAll()
    await clickButton(findField('body'), 'Paragraph')
    await vi.waitFor(() => expect(data.body).toBe('<p>Emma</p>'))
  })

  it('parses horizontal rules with `nodes.horizontalRule`', async () => {
    const { getComponent } = await mountSchema({
      schema: {
        components: {
          body: { type: 'markup', nodes: { horizontalRule: true } }
        }
      },
      data: { body: '<p>Emma</p><hr><p>Persuasion</p>' }
    })
    expect(getComponent('body').editor.getHTML()).toBe(
      '<p>Emma</p><hr><p>Persuasion</p>'
    )
  })

  it('undoes and redoes edits with the history buttons', async () => {
    const { findField, getComponent } = await mountForm({
      schema: {
        components: { body: { type: 'markup', tools: { history: true } } }
      },
      data: { body: '<p>Emma</p>' }
    })
    const field = findField('body')
    const { editor } = getComponent('body')
    editor.chain().focus('end').insertContent('!').run()
    expect(editor.getText()).toBe('Emma!')
    await clickButton(field, 'Undo')
    expect(editor.getText()).toBe('Emma')
    await clickButton(field, 'Redo')
    expect(editor.getText()).toBe('Emma!')
  })

  it('adds footnotes with `tools.footnotes`', async () => {
    const { findField, getComponent } = await mountSchema({
      schema: {
        components: { body: { type: 'markup', tools: { footnotes: true } } }
      },
      data: { body: '<p>Emma</p>' }
    })
    const { editor } = getComponent('body')
    editor.commands.focus('end')
    await clickButton(findField('body'), 'Footnotes')
    const html = editor.getHTML()
    expect(html).toContain('<p>Emma<sup id="fnref:1"><a class="footnote-ref"')
    expect(html).toContain('<ol class="footnotes"><li id="fn:1"')
  })

  it('clears the editor when the value becomes null', async () => {
    const { getComponent, data, settle } = await mountSchema({
      schema: { components: { body: { type: 'markup' } } },
      data: { body: '<p>Emma</p>' }
    })
    data.body = null
    await settle()
    expect(getComponent('body').editor.getHTML()).toBe('<p></p>')
  })

  it('focuses and blurs the editor', async () => {
    const { getComponent } = await mountSchema({
      schema: { components: { body: { type: 'markup' } } }
    })
    const component = getComponent('body')
    await component.focus()
    await vi.waitFor(() => expect(component.focused).toBe(true))
    expect(component.editor.isFocused).toBe(true)
    component.blur()
    await flushPromises()
    expect(component.editor.isFocused).toBe(false)
    expect(component.focused).toBe(false)
  })

  describe('hard breaks', () => {
    // Presses `key` in the editor, as the browser does.
    function pressKey(editor, key, options = {}) {
      const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
        ...options
      })
      editor.view.dom.dispatchEvent(event)
    }

    it('inserts hard breaks with Shift-Enter', async () => {
      const { getComponent } = await mountSchema({
        schema: { components: { body: { type: 'markup' } } },
        data: { body: '<p>Emma</p>' }
      })
      const { editor } = getComponent('body')
      editor.commands.focus('end')
      pressKey(editor, 'Enter', { shiftKey: true })
      expect(editor.getHTML()).toBe('<p>Emma<br></p>')
    })

    it('inserts hard breaks with Enter with `hardBreak`', async () => {
      const { getComponent } = await mountSchema({
        schema: {
          components: { caption: { type: 'markup', hardBreak: true } }
        },
        data: { caption: 'Emma' }
      })
      const { editor } = getComponent('caption')
      editor.commands.focus('end')
      pressKey(editor, 'Enter')
      expect(editor.getHTML()).toBe('<p>Emma<br></p>')
    })

    it('pastes paragraphs as lines with `hardBreak`', async () => {
      const { getComponent, data } = await mountSchema({
        schema: {
          components: {
            caption: { type: 'markup', hardBreak: true, marks: { bold: true } }
          }
        },
        data: { caption: '' }
      })
      const { editor } = getComponent('caption')
      editor.commands.focus()
      editor.view.pasteHTML('<p>Emma</p><p><strong>Persuasion</strong></p>')
      expect(editor.getHTML()).toBe(
        '<p>Emma<br><strong>Persuasion</strong></p>'
      )
      await vi.waitFor(() =>
        expect(data.caption).toBe('Emma<br><strong>Persuasion</strong>')
      )
    })

    // Bug: The pasted paragraph is inserted as a closed node, which splits
    // the line into two paragraphs, stored as `Emma</p><p>Persuasion`.
    it.fails('pastes into the existing line with `hardBreak`', async () => {
      const { getComponent, data } = await mountSchema({
        schema: {
          components: { caption: { type: 'markup', hardBreak: true } }
        },
        data: { caption: 'Emma' }
      })
      const { editor } = getComponent('caption')
      editor.commands.focus('end')
      editor.view.pasteHTML('<p> Persuasion</p>')
      await vi.waitFor(() => expect(data.caption).toBe('Emma Persuasion'))
    })

    // Bug: Pasted block nodes other than paragraphs are moved into the
    // paragraph of the line, which they aren't valid content of.
    it.fails('keeps the document valid when pasting block nodes', async () => {
      const { getComponent } = await mountSchema({
        schema: {
          components: {
            caption: {
              type: 'markup',
              hardBreak: true,
              nodes: { blockquote: true }
            }
          }
        },
        data: { caption: '' }
      })
      const { editor } = getComponent('caption')
      editor.commands.focus()
      editor.view.pasteHTML(
        '<p>Emma</p><blockquote><p>Persuasion</p></blockquote>'
      )
      expect(() => editor.state.doc.check()).not.toThrow()
    })
  })
})
