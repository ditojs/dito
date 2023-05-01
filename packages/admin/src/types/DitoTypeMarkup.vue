<template lang="pug">
.dito-markup(:id="dataPath")
  .dito-markup-toolbar
    .dito-buttons.dito-buttons-toolbar(
      v-if="groupedButtons.length > 0"
    )
      .dito-button-group(
        v-for="buttons in groupedButtons"
      )
        button.dito-button(
          v-for="{ name, icon, isActive, onClick } in buttons"
          :key="name"
          :class="{ 'dito-active': isActive }"
          @click="onClick"
        )
          Icon(:name="icon")
  EditorContent.dito-markup-editor(
    ref="editor"
    :editor="editor"
    :style="styles"
  )
  .dito-resize(
    v-if="resizable"
    @mousedown.stop.prevent="onDragResize"
  )
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import DomMixin from '../mixins/DomMixin.js'
import { getSchemaAccessor } from '../utils/accessor.js'
import { Editor, EditorContent, Mark, getMarkAttributes } from '@tiptap/vue-3'
// import { toggleMark } from 'tiptap-commands'
// Essentials:
import { Document } from '@tiptap/extension-document'
import { Text } from '@tiptap/extension-text'
// Marks:
import { Bold } from '@tiptap/extension-bold'
import { Code } from '@tiptap/extension-code'
import { Italic } from '@tiptap/extension-italic'
import { Link } from '@tiptap/extension-link'
import { Strike } from '@tiptap/extension-strike'
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
// TODO:
// import { Image } from '@tiptap/extension-image'
// import { Mention } from '@tiptap/extension-mention'
// import { CodeBlockHighlight } from '@tiptap/extension-code-block-highlight'
// import { Table } from '@tiptap/extension-table'
// import { TableCell } from '@tiptap/extension-table-cell'
// import { TableHeader } from '@tiptap/extension-table-header'
// import { TableNodes } from '@tiptap/extension-table-nodes'
// import { TableRow } from '@tiptap/extension-table-row'
// import { TaskList } from '@tiptap/extension-task-list'
// import { TaskItem } from '@tiptap/extension-task-item'
// Tools:
import { History } from '@tiptap/extension-history'

import { Icon } from '@ditojs/ui/src'
import { isArray, isObject, hyphenate, debounce, camelize } from '@ditojs/utils'

// @vue/component
export default DitoTypeComponent.register('markup', {
  mixins: [DomMixin],
  components: {
    EditorContent,
    Icon
  },

  keepAligned: false,

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
          values: [1, 2, 3, 4, 5, 6]
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
        redo: true
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
        editable: !this.readyonly,
        autoFocus: this.autofocus,
        disableInputRules: !this.enableRules.input,
        disablePasteRules: !this.enableRules.paste,
        parseOptions: this.parseOptions
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
    readyonly: 'updateEditorOptions',
    autofocus: 'updateEditorOptions',
    enableRules: 'updateEditorOptions'
  },

  created() {
    let changed = false
    let ignoreWatch = false

    const onChange = () => {
      if (!this.focused && changed) {
        changed = false
        this.onChange()
      }
    }

    const onFocus = () => this.onFocus()

    const onBlur = () => {
      this.onBlur()
      onChange()
    }

    const setValueDebounced = debounce(editor => {
      ignoreWatch = true
      this.value = editor.getHTML()
      changed = true
      onChange()
    }, 100)

    const onUpdate = ({ editor }) => {
      setValueDebounced(editor)
      this.onInput()
    }

    this.$watch('value', value => {
      if (ignoreWatch) {
        ignoreWatch = false
      } else {
        this.editor.setContent(value, false, this.parseOptions)
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

  unmounted() {
    this.editor.destroy()
  },

  methods: {
    onDragResize(event) {
      const getPoint = ({ clientX: x, clientY: y }) => ({ x, y })

      let prevY = getPoint(event).y
      let height = parseFloat(getComputedStyle(this.$refs.editor.$el).height)

      const mousemove = event => {
        const { y } = getPoint(event)
        height += y - prevY
        prevY = y
        this.height = `${Math.max(height, 0)}px`
      }

      const handlers = this.domOn(document, {
        mousemove,

        mouseup(event) {
          mousemove(event)
          handlers.remove()
        }
      })
    },

    updateEditorOptions() {
      this.editor.setOptions(this.editorOptions)
    },

    async onClickLink(editor) {
      const attributes = await this.rootComponent.showDialog({
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
            // eslint-disable-next-line no-new
            new URL(href)
          } catch {
            href = `https://${href}`
          }
        }
        editor.commands.setLink({ href, title })
      } else {
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
        Document,
        Text,
        Paragraph, // button can be controlled, but node needs to be on.

        // Marks: `schema.marks`
        marks.bold && Bold,
        marks.italic && Italic,
        marks.underline && Underline,
        marks.strike && Strike,
        marks.small && Small,
        marks.code && Code,
        marks.link && LinkWithTitle,

        // Nodes: `schema.nodes`
        nodes.blockquote && Blockquote,
        nodes.codeBlock && CodeBlock,
        HardBreak, // TODO: Should this always on?
        nodes.heading && Heading.configure({ levels: nodes.heading }),
        nodes.horizontalRule && HorizontalRule,
        (nodes.orderedList || nodes.bulletList) && ListItem,
        nodes.bulletList && BulletList,
        nodes.orderedList && OrderedList,
        // TODO:
        // nodes.todoList && TodoItem,
        // nodes.todoList && TodoList,

        // Tools: `schema.tools`
        tools.history && History
      ].filter(extension => !!extension)
    },

    getButtons(settingsName, descriptions) {
      const list = []
      const { commands } = this.editor

      const addButton = ({ name, icon, command, attributes, onClick }) => {
        list.push({
          name,
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
            } else if (isObject(description)) {
              const { command, attribute, values, onClick } = description
              if (attribute) {
                if (isArray(values) && isArray(setting)) {
                  // Support heading level attrs:
                  for (const value of values) {
                    if (setting.includes(value)) {
                      addButton({
                        name,
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
  schema: {
    attrs: {
      href: {
        default: null
      },
      title: {
        default: null
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

    renderHTML(node) {
      return ['a', node.attrs, 0]
    }
  }
})
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-markup {
  @extend %input;

  position: relative;

  .dito-resize {
    @extend %icon-resize;

    position: absolute;
    top: unset;
    left: unset;
    right: 0;
    bottom: 0;
    width: 1em;
    height: 1em;
  }

  .ProseMirror {
    height: 100%;
    outline: none;
  }

  .dito-markup-editor {
    overflow-y: scroll;
    // Move padding "inside" editor to correctly position scrollbar
    margin-right: -$input-padding-hor;
    padding-right: $input-padding-hor;
  }

  .dito-buttons-toolbar {
    margin: $input-padding-ver 0;
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
    color: blue;
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
    padding-left: 1rem;
    font-style: italic;

    p {
      margin: 0;
    }
  }
}
</style>
