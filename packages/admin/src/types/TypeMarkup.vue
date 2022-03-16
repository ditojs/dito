<template lang="pug">
  .dito-markup(
    :id="dataPath"
  )
    editor-menu-bar.dito-markup-toolbar(:editor="editor")
      .dito-buttons.dito-buttons-toolbar(
        v-if="groupedButtons.length > 0"
      )
        .dito-button-group(
          v-for="buttons in groupedButtons"
        )
          button.dito-button(
            v-for="{ name, icon, isActive, onClick } in buttons"
            :class="{ 'dito-active': isActive }",
            @click="onClick"
          )
            icon(:name="icon")
    editor-content.dito-markup-editor(
      ref="editor"
      :editor="editor"
      :style="styles"
    )
    .dito-resize(
      v-if="resizable"
      @mousedown.stop.prevent="onDragResize"
    )
</template>

<style lang="sass">
  .dito-markup
    @extend %input
    position: relative

    .dito-resize
      @extend %icon-resize
      position: absolute
      top: unset
      left: unset
      right: 0
      bottom: 0
      width: 1em
      height: 1em

    .ProseMirror
      height: 100%
      outline: none

    .dito-markup-editor
      overflow-y: scroll
      // Move padding "inside" editor to correctly position scrollbar
      margin-right: -$input-padding-hor
      padding-right: $input-padding-hor

    .dito-buttons-toolbar
      margin: $input-padding-ver 0

    h1,
    h2,
    h3,
    p,
    ul,
    ol,
    pre,
    blockquote
      margin: 1rem 0
      &:first-child
        margin-top: 0
      &:last-child
        margin-bottom: 0
    h1,
    h2,
    h3
      font-weight: bold
    h1
      font-size: 1.4rem
    h2
      font-size: 1.2rem
    ul
      list-style: disc
    code
      font-family: $font-family-mono
    pre
      padding: 0.7rem 1rem
      border-radius: $border-radius
      background: $color-darker
      color: $color-white
      overflow-x: auto
      code
        display: block
    p code
      display: inline-block
      padding: 0 0.3rem
      border-radius: $border-radius
      background: $color-lighter
    a
      pointer-events: none
      cursor: default
      color: blue
      text-decoration: underline
    ul,
    ol
      padding-left: 2rem
    li
      & > p,
      & > ol,
      & > ul
        margin: 0
    blockquote
      border-left: 3px solid $color-lighter
      padding-left: 1rem
      font-style: italic
      p
        margin: 0

</style>

<script>
import TypeComponent from '../TypeComponent.js'
import DomMixin from '../mixins/DomMixin.js'
import { getSchemaAccessor } from '../utils/accessor.js'
import { Editor, EditorContent, EditorMenuBar, Mark } from 'tiptap'
import { toggleMark } from 'tiptap-commands'
import {
  // Marks:
  Bold, Code, Italic, Link, Strike, Underline,
  // Nodes:
  Blockquote, CodeBlock, HardBreak, Heading, HorizontalRule,
  OrderedList, BulletList, ListItem,
  // TODO:
  // - Image, Mention, CodeBlockHighlight
  // - Table, TableCell, TableHeader, TableNodes, TableRow,
  // - TodoItem, TodoList
  // Tools:
  History
} from 'tiptap-extensions'
import { Icon } from '@ditojs/ui'
import {
  isArray, isObject, underscore, hyphenate, debounce
} from '@ditojs/utils'

// @vue/component
export default TypeComponent.register('markup', {
  components: {
    EditorContent,
    EditorMenuBar,
    Icon
  },

  mixins: [DomMixin],

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
          onClick: command => this.onClickLink(command)
        }
      })
    },

    basicNodeButtons() {
      return this.getButtons('nodes', {
        paragraph: {
        // Do not show the paragraph command as active if any of the block
        // commands are also active:
          ignoreActive: () =>
            this.otherNodeButtons.some(button => button.isActive)
        },
        heading: {
          attr: 'level',
          values: [1, 2, 3, 4, 5, 6]
        }
      })
    },

    otherNodeButtons() {
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
      const {
        markButtons,
        basicNodeButtons,
        otherNodeButtons,
        toolButtons
      } = this
      return [
        markButtons,
        basicNodeButtons,
        otherNodeButtons,
        toolButtons
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

    const setValueDebounced = debounce(getValue => {
      ignoreWatch = true
      this.value = getValue()
      changed = true
      onChange()
    }, 100)

    const onUpdate = ({ getHTML }) => {
      setValueDebounced(getHTML)
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
      extensions: this.createExtensions(),
      content: this.value || ''
    })
  },

  beforeDestroy() {
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

    async onClickLink(command) {
      const attrs = await this.showDialog({
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
                dialogComponent.resolve({
                  href: null,
                  title: null
                })
              }
            }
          }
        },
        data: this.editor.getMarkAttrs('link')
      })
      if (attrs) {
        let { href, title } = attrs
        if (href) {
          // See if `href` can be parsed as a URL, and if not, prefix it with
          // a default protocol.
          try {
            new URL(href)
          } catch {
            href = `http://${href}`
          }
        }
        command({ href, title })
      }
    },

    createExtensions() {
      const {
        marks = {},
        nodes = {},
        tools = {}
      } = this.schema
      return [
        // schema.marks:
        marks.bold && new Bold(),
        marks.italic && new Italic(),
        marks.underline && new Underline(),
        marks.strike && new Strike(),
        marks.small && new Small(),
        marks.code && new Code(),
        marks.link && new LinkWithTitle(),

        // schema.nodes:
        nodes.blockquote && new Blockquote(),
        nodes.codeBlock && new CodeBlock(),
        new HardBreak(), // TODO: Should this always on?
        nodes.heading && new Heading({ levels: nodes.heading }),
        nodes.horizontalRule && new HorizontalRule(),
        (nodes.orderedList || nodes.bulletList) && new ListItem(),
        nodes.bulletList && new BulletList(),
        nodes.orderedList && new OrderedList(),
        // TODO:
        // nodes.todoList && new TodoItem(),
        // nodes.todoList && new TodoList(),

        // schema.tools:
        tools.history && new History()
      ].filter(extension => !!extension)
    },

    getButtons(settingsName, descriptions) {
      const list = []

      const addButton = ({ name, icon, attrs, ignoreActive, onClick }) => {
        const isActive = this.editor.isActive[name]
        const command = this.editor.commands[name]
        list.push({
          name,
          icon,
          isActive: (
            isActive?.(attrs) &&
            (ignoreActive == null || !ignoreActive())
          ),
          onClick: () => onClick
            ? onClick(command, attrs)
            : command(attrs)
        })
      }

      const settings = this.schema[settingsName]
      if (settings) {
        for (const [key, description] of Object.entries(descriptions)) {
          const settingName = ['undo', 'redo'].includes(key) ? 'history' : key
          const setting = settings[settingName]
          const name = underscore(key)
          const icon = hyphenate(key)
          if (setting) {
            if (description === true) {
              addButton({ name, icon })
            } else if (isObject(description)) {
              const { attr, values, ignoreActive, onClick } = description
              if (attr) {
                if (isArray(values) && isArray(setting)) {
                  // Support heading level attrs:
                  for (const value of values) {
                    if (setting.includes(value)) {
                      addButton({
                        name,
                        icon: `${icon}-${value}`,
                        attrs: { [attr]: value },
                        ignoreActive,
                        onClick
                      })
                    }
                  }
                }
              } else {
                addButton({ name, icon, ignoreActive, onClick })
              }
            }
          }
        }
      }
      return list
    },

    focusElement() {
      this.$el.scrollIntoView?.()
      this.editor.focus()
    }
  }
})

class Small extends Mark {
  get name() {
    return 'small'
  }

  get schema() {
    return {
      parseDOM: [
        { tag: 'small' }
      ],
      toDOM: () => ['small', 0]
    }
  }

  commands({ type }) {
    return () => toggleMark(type)
  }
}
class LinkWithTitle extends Link {
  get schema() {
    return {
      attrs: {
        href: {
          default: null
        },
        title: {
          default: null
        }
      },
      inclusive: false,
      parseDOM: [{
        tag: 'a',
        getAttrs: dom => ({
          href: dom.getAttribute('href'),
          title: dom.getAttribute('title')
        })
      }],
      toDOM: node => ['a', node.attrs, 0]
    }
  }
}
</script>
