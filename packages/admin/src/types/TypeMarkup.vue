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
      :editor="editor"
      :style="style"
    )
</template>

<style lang="sass">
  .dito-markup
    @extend %input

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
import TypeComponent from '@/TypeComponent'
import { getSchemaAccessor } from '@/utils/accessor'
import { Editor, EditorContent, EditorMenuBar } from 'tiptap'
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

  data() {
    return {
      editor: null
    }
  },

  computed: {
    lines() {
      return this.schema.lines || 10
    },

    style() {
      return `height: calc(${this.lines}em * var(--line-height))`
    },

    markButtons() {
      return this.getButtons('marks', {
        bold: true,
        italic: true,
        strike: true,
        underline: true,
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
          collapse: false,
          preserve: true,
          'preserve-all': 'full'
        }[this.whitespace]
      }
    },

    whitespace: getSchemaAccessor('whitespace', {
      type: Boolean,
      default: 'collapse'
    })
  },

  watch: {
    readyonly: 'updateOptions',
    autofocus: 'updateOptions'
  },

  created() {
    let changed = false
    let ignoreWatch = false

    const onFocus = () => this.onFocus()

    const onBlur = () => {
      this.onBlur()
      if (changed) {
        changed = false
        this.onChange()
      }
    }

    const setValueDebounced = debounce(getValue => {
      ignoreWatch = true
      this.value = getValue()
    }, 100)

    const onUpdate = ({ getHTML }) => {
      changed = true
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
      editable: !this.readyonly,
      autoFocus: this.autofocus,
      onFocus,
      onBlur,
      onUpdate,
      extensions: this.createExtensions(),
      parseOptions: this.parseOptions,
      content: this.value || ''
    })
  },

  beforeDestroy() {
    this.editor.destroy()
  },

  methods: {
    updateOptions() {
      this.editor.setOptions({
        editable: !this.readyonly,
        autoFocus: this.autofocus
      })
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
        marks.code && new Code(),
        marks.italic && new Italic(),
        marks.link && new LinkWithTitle(),
        marks.strike && new Strike(),
        marks.underline && new Underline(),

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

    focus() {
      this.$el.scrollIntoView?.()
      this.editor.focus()
    }
  }
})

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
