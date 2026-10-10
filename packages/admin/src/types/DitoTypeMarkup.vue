<template lang="pug">
.dito-markup(:id="componentPath")
  .dito-buttons.dito-buttons--toolbar(
    v-if="groupedButtons.length > 0"
  )
    .dito-buttons__group(
      v-for="buttons in groupedButtons"
    )
      DitoButton(
        v-for="{ id, label, icon, isActive, onClick } in buttons"
        :key="id"
        :class="{ 'dito-button--active': isActive }"
        :aria-label="label"
        :aria-pressed="isActive"
        @click="onClick"
      )
        DitoIcon(:name="icon")
  EditorContent.dito-markup-editor(
    ref="editor"
    :editor="editor"
    :style="styles"
  )
  DitoResizeHandle(
    v-if="resizable"
    :getElement="() => $refs.editor.$el"
    @resize="height = `${$event}px`"
  )
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import { getSchemaAccessor } from '../utils/accessor.js'
import { createChangeOnceEdited } from '../utils/changeOnceEdited.js'
import DitoResizeHandle from '../components/DitoResizeHandle.vue'
// Tiptap:
import { Editor, EditorContent, Mark, getMarkAttributes } from '@tiptap/vue-3'
import { Slice, Fragment } from '@tiptap/pm/model'
// Essentials:
import { Document } from '@tiptap/extension-document'
import { Text } from '@tiptap/extension-text'
// Marks:
import { Bold } from '@tiptap/extension-bold'
import { Code } from '@tiptap/extension-code'
import { Italic } from '@tiptap/extension-italic'
import { Link } from '@tiptap/extension-link'
import { Strike } from '@tiptap/extension-strike'
import { Subscript } from '@tiptap/extension-subscript'
import { Superscript } from '@tiptap/extension-superscript'
import { Underline } from '@tiptap/extension-underline'
// Nodes:
import { Blockquote } from '@tiptap/extension-blockquote'
import { CodeBlock } from '@tiptap/extension-code-block'
import { HardBreak } from '@tiptap/extension-hard-break'
import { Heading } from '@tiptap/extension-heading'
import { Paragraph } from '@tiptap/extension-paragraph'
import { HorizontalRule } from '@tiptap/extension-horizontal-rule'
import { OrderedList } from '@tiptap/extension-ordered-list'
import { BulletList } from '@tiptap/extension-bullet-list'
import { ListItem } from '@tiptap/extension-list-item'
import { Footnotes, FootnoteReference, Footnote } from 'tiptap-footnotes'
// Tools:
import { History } from '@tiptap/extension-history'

import { DitoButton, DitoIcon } from '@ditojs/ui/src'
import { isArray, isObject, hyphenate, debounce, camelize } from '@ditojs/utils'

// @vue/component
export default DitoTypeComponent.register('markup', {
  components: {
    EditorContent,
    DitoButton,
    DitoIcon,
    DitoResizeHandle
  },

  data() {
    return {
      editor: null,
      height: null
    }
  },

  computed: {
    lines() {
      return this.schema.lines || 10
    },

    hardBreak() {
      return !!this.schema.hardBreak
    },

    styles() {
      return {
        height: this.height || `calc(${this.lines}em * var(--line-height))`
      }
    },

    markButtons() {
      return this.getButtons('marks', {
        bold: true,
        italic: true,
        underline: true,
        strike: true,
        small: true,
        code: true,
        subscript: true,
        superscript: true,
        link: {
          onClick: editor => this.onClickLink(editor)
        }
      })
    },

    basicNodeButtons() {
      return this.getButtons('nodes', {
        paragraph: {
          command: 'setParagraph'
        },
        heading: {
          attribute: 'level',
          values: headingLevels
        }
      })
    },

    advancedNodeButtons() {
      return this.getButtons('nodes', {
        bulletList: true,
        orderedList: true,
        blockquote: true,
        codeBlock: true
      })
    },

    toolButtons() {
      return this.getButtons('tools', {
        undo: true,
        redo: true,
        footnotes: {
          command: 'addFootnote'
        }
      })
    },

    groupedButtons() {
      return [
        this.markButtons,
        this.basicNodeButtons,
        this.advancedNodeButtons,
        this.toolButtons
      ].filter(buttons => buttons.length > 0)
    },

    parseOptions() {
      return {
        preserveWhitespace: {
          'collapse': false,
          'preserve': true,
          'preserve-all': 'full'
        }[this.whitespace]
      }
    },

    editorOptions() {
      return {
        editable: !this.readonly && !this.disabled,
        autofocus: this.autofocus,
        enableInputRules: this.enableRules.input,
        enablePasteRules: this.enableRules.paste,
        parseOptions: this.parseOptions,
        editorProps: this.hardBreak
          ? {
              handlePaste: (view, event, slice) => {
                const { schema } = view.state
                const paragraph = schema.nodes.paragraph.create(
                  null,
                  getInlineContentAsLine(slice.content, schema)
                )
                // Insert the paragraph as an open slice, so that its inline
                // content merges into the paragraph of the line.
                view.dispatch(
                  view.state.tr.replaceSelection(
                    new Slice(Fragment.from(paragraph), 1, 1)
                  )
                )
                return true
              }
            }
          : {}
      }
    },

    resizable: getSchemaAccessor('resizable', {
      type: Boolean,
      default: false
    }),

    whitespace: getSchemaAccessor('whitespace', {
      type: String,
      default: 'collapse'
      // Possible values are: 'collapse', 'preserve', 'preserve-all'
    }),

    enableRules: getSchemaAccessor('enableRules', {
      type: [Object, Boolean],
      default: false,
      get(enableRules) {
        return isObject(enableRules)
          ? enableRules
          : {
              input: !!enableRules,
              paste: !!enableRules
            }
      }
    })
  },

  watch: {
    readonly: 'updateEditorOptions',
    disabled: 'updateEditorOptions',
    autofocus: 'updateEditorOptions',
    enableRules: 'updateEditorOptions'
  },

  created() {
    let ignoreWatch = false

    // Emits the change of the value once the editor isn't focused anymore.
    const changeOnceEdited = createChangeOnceEdited({
      isEditing: () => this.focused,
      emitChange: () => this.onChange()
    })

    const onFocus = () => this.onFocus()

    const onBlur = () => {
      // Write the value first, so that validating on blur validates it, and
      // emit the change once the editor isn't focused anymore.
      updateValue()
      this.onBlur()
      changeOnceEdited.emitIfDone()
    }

    const onUpdate = () => {
      setValueDebounced()
      this.onInput()
    }

    const setValueDebounced = debounce(() => updateValue(), 100)
    // Writes the pending edits before unmounting, as the destroyed editor
    // can't be read anymore, see `beforeUnmount()`:
    this.writePendingValue = () => {
      if (setValueDebounced.cancel()) {
        updateValue()
      }
    }

    const updateValue = () => {
      const content = this.editor.getHTML()
      const value = this.hardBreak
        ? content.replace(/^<p>(.*?)<\/p>$/s, '$1')
        : content
      if (value !== this.value) {
        changeOnceEdited.markEdited()
        // The value comes from the editor, so don't set it back as content,
        // which would re-parse it and e.g. collapse trailing whitespace.
        ignoreWatch = true
        this.value = value
      }
      changeOnceEdited.emitIfDone()
    }

    this.$watch('value', value => {
      if (ignoreWatch) {
        ignoreWatch = false
      } else {
        const content = this.hardBreak
          ? `<p>${value ?? ''}</p>`
          : value ?? ''
        this.editor.commands.setContent(content, {
          emitUpdate: false,
          parseOptions: this.parseOptions
        })
      }
    })

    this.editor = new Editor({
      ...this.editorOptions,
      onFocus,
      onBlur,
      onUpdate,
      extensions: this.getExtensions(),
      content: this.value || ''
    })
  },

  beforeUnmount() {
    this.writePendingValue()
  },

  unmounted() {
    this.editor.destroy()
  },

  methods: {
    updateEditorOptions() {
      this.editor.setOptions(this.editorOptions)
    },

    async onClickLink(editor) {
      const attributes = await this.showDialog({
        components: {
          href: {
            type: 'url',
            label: 'Link',
            autofocus: true
          },
          title: {
            type: 'text',
            label: 'Title'
          }
        },
        buttons: {
          cancel: {},
          apply: { type: 'submit' },
          remove: {
            events: {
              click({ dialogComponent }) {
                dialogComponent.resolve(null)
              }
            }
          }
        },
        data: getMarkAttributes(this.editor.state, 'link')
      })
      if (attributes) {
        let { href, title } = attributes
        if (href) {
          // See if `href` can be parsed as a URL, and if not,
          // prefix it with a default protocol.
          try {
            new URL(href)
          } catch {
            href = `https://${href}`
          }
          editor.commands.setLink({ href, title })
        } else {
          // Applying without a URL removes the link, like the remove button.
          editor.commands.unsetLink()
        }
      } else if (attributes === null) {
        editor.commands.unsetLink()
      }
    },

    getExtensions() {
      const {
        marks = {},
        nodes = {},
        tools = {}
      } = this.schema
      return [
        // Essentials:
        tools.footnotes
          ? Document.extend({ content: 'block+ footnotes?' })
          : Document,

        Text,
        Paragraph, // button can be controlled, but node needs to be on.

        // Marks: `schema.marks`
        marks.bold && Bold,
        marks.italic && Italic,
        marks.underline && Underline,
        marks.strike && Strike,
        marks.small && Small,
        marks.code && Code,
        marks.subscript && Subscript,
        marks.superscript && Superscript,
        marks.link && LinkWithTitle,

        // Nodes: `schema.nodes`
        nodes.blockquote && Blockquote,
        nodes.codeBlock && CodeBlock,
        nodes.heading &&
        Heading.configure({ levels: getHeadingLevels(nodes.heading) }),
        nodes.horizontalRule && HorizontalRule,
        (nodes.orderedList || nodes.bulletList) && ListItem,
        nodes.bulletList && BulletList,
        nodes.orderedList && OrderedList,

        // Footnotes:
        ...(tools.footnotes ? [Footnotes, Footnote, FootnoteReference] : []),

        // Tools: `schema.tools`
        tools.history && History,

        HardBreak.extend({
          addKeyboardShortcuts: () => {
            const setHardBreak = () => this.editor.commands.setHardBreak()
            return {
              'Mod-Enter': setHardBreak,
              'Shift-Enter': setHardBreak,
              ...(this.hardBreak ? { Enter: setHardBreak } : null)
            }
          }
        })
      ].filter(extension => !!extension)
    },

    getButtons(settingsName, descriptions) {
      const list = []
      const { commands } = this.editor

      const addButton = ({
        name,
        id = name,
        label = this.labelize(id),
        icon,
        command,
        attributes,
        onClick
      }) => {
        list.push({
          id,
          label,
          icon,
          isActive: this.editor.isActive(name, attributes),
          onClick: () => {
            command ??=
              name in commands
                ? name
                : `toggle${camelize(name, true)}`
            if (command in commands) {
              const apply = attributes =>
                this.editor.chain()[command](attributes).focus().run()
              onClick
                ? onClick(this.editor, attributes)
                : apply(attributes)
            }
          }
        })
      }

      const settings = this.schema[settingsName]
      if (settings) {
        for (const [name, description] of Object.entries(descriptions)) {
          const settingName = ['undo', 'redo'].includes(name) ? 'history' : name
          const setting = settings[settingName]
          const icon = hyphenate(name)
          if (setting) {
            if (description === true) {
              addButton({ name, icon })
            } else {
              const { command, attribute, values, onClick } = description
              if (attribute) {
                // Support heading level attrs, with `true` enabling all:
                const enabledValues = setting === true ? values : setting
                if (isArray(values) && isArray(enabledValues)) {
                  for (const value of values) {
                    if (enabledValues.includes(value)) {
                      addButton({
                        name,
                        id: `${name}-${value}`,
                        icon: `${icon}-${value}`,
                        command,
                        attributes: { [attribute]: value },
                        onClick
                      })
                    }
                  }
                }
              } else {
                addButton({ name, icon, command, onClick })
              }
            }
          }
        }
      }
      return list
    },

    focusElement() {
      this.editor.commands.focus()
    },

    blurElement() {
      this.editor.commands.blur()
    }
  }
})

const headingLevels = [1, 2, 3, 4, 5, 6]

// Returns the heading levels for the `nodes.heading` setting, with `true`
// enabling all levels.
function getHeadingLevels(setting) {
  return setting === true ? headingLevels : setting
}

// Returns the inline content of all textblocks in the fragment as one line,
// with hard breaks between the textblocks, dropping the block nodes around
// them (e.g. lists and blockquotes), as a line can only hold inline content.
function getInlineContentAsLine(fragment, schema) {
  const nodes = []
  let hasTextblock = false
  fragment.descendants(node => {
    if (node.isTextblock) {
      if (hasTextblock) {
        nodes.push(schema.nodes.hardBreak.create())
      }
      hasTextblock = true
      node.content.forEach(child => nodes.push(child))
      return false
    } else if (node.isInline) {
      // Inline nodes at the top level of the slice, e.g. from inline HTML.
      nodes.push(node)
      return false
    }
  })
  return Fragment.from(nodes)
}

const Small = Mark.create({
  name: 'small',

  parseHTML() {
    return [{ tag: 'small' }]
  },

  renderHTML() {
    return ['small', 0]
  },

  addCommands() {
    return {
      setSmall:
        attributes =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes)
        },
      toggleSmall:
        attributes =>
        ({ commands }) => {
          return commands.toggleMark(this.name, attributes)
        },
      unsetSmall:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name)
        }
    }
  }
})

const LinkWithTitle = Link.extend({
  inclusive: false,

  addAttributes() {
    return {
      href: {
        default: null
      },
      title: {
        default: null
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'a',
        getAttrs: element => ({
          href: element.getAttribute('href'),
          title: element.getAttribute('title')
        })
      }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['a', HTMLAttributes, 0]
  }
})
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-markup {
  @extend %input;

  position: relative;

  .ProseMirror {
    height: 100%;
    outline: none;
  }

  .dito-markup-editor {
    overflow-y: scroll;
    margin-top: $input-padding-ver;
    // Move padding "inside" editor to correctly position scrollbar
    margin-right: -$input-padding-hor;
    padding-right: $input-padding-hor;
  }

  // TODO: BEM: Style an element class of this block, e.g. `&__buttons`.
  .dito-buttons--toolbar {
    margin: 0;
  }

  h1,
  h2,
  h3,
  p,
  ul,
  ol,
  pre,
  blockquote {
    margin: 1rem 0;

    &:first-child {
      margin-top: 0;
    }

    &:last-child {
      margin-bottom: 0;
    }
  }

  h1,
  h2,
  h3 {
    font-weight: bold;
  }

  h1 {
    font-size: 1.4rem;
  }

  h2 {
    font-size: 1.2rem;
  }

  ul {
    list-style: disc;
  }

  code {
    font-family: $font-family-mono;
  }

  pre {
    padding: 0.7rem 1rem;
    border-radius: $border-radius;
    background: $color-darker;
    color: $color-white;
    overflow-x: auto;

    code {
      display: block;
    }
  }

  p code {
    display: inline-block;
    padding: 0 0.3rem;
    border-radius: $border-radius;
    background: $color-lighter;
  }

  a {
    pointer-events: none;
    cursor: default;
    color: $color-active;
    text-decoration: underline;
  }

  ul,
  ol {
    padding-left: 2rem;
  }

  li {
    & > p,
    & > ol,
    & > ul {
      margin: 0;
    }
  }

  blockquote {
    border-left: 3px solid $color-lighter;
    padding-left: 1em;
    font-style: italic;

    p {
      margin: 0;
    }
  }

  ol.footnotes {
    margin-top: 1em;
    padding: 1em 0;
    list-style-type: decimal;
    padding-left: 2em;

    &:has(li) {
      border-top: 1px solid $color-light;
    }
  }
}
</style>
