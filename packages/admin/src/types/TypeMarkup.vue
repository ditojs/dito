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
.dito
  .dito-markup
    @extend %input

    .ProseMirror:focus
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
import { Editor, EditorContent, EditorMenuBar } from 'tiptap'
import {
  // Marks:
  Bold, Code, Italic, Strike, Underline,
  // TODO:
  // - Link
  // Nodes:
  Blockquote, CodeBlock, HardBreak, Heading, HorizontalRule,
  OrderedList, BulletList, ListItem,
  // TODO:
  // - Image, Mention, CodeBlockHighlight
  // - Table, TableCell, TableHeader, TableNodes, TableRow,
  // - TodoItem, TodoList
  // Extensions:
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
        code: true
      })
    },

    basicNodeButtons() {
      return this.getButtons('nodes', {
        paragraph: {
        // Do not show the paragraph command as active if any of the block
        // commands are also active:
          isActive: () => !this.otherNodeButtons.some(button => button.isActive)
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
    }
  },

  watch: {
    readyonly: 'updateOptions',
    autoFocus: 'updateOptions'
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
        this.editor.setContent(value)
      }
    })

    this.editor = new Editor({
      editable: !this.readyonly,
      autoFocus: this.autofocus,
      onFocus,
      onBlur,
      onUpdate,
      extensions: this.getExtensions(),
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

    getExtensions() {
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
        marks.strike && new Strike(),
        marks.underline && new Underline(),
        // TODO:
        // commands.link && new Link(),

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

    getButtons(schemaName, descriptions) {
      const list = []

      const addButton = ({ name, icon, attrs, isActive }) => {
        list.push({
          name,
          icon,
          isActive: (
            (isActive == null || isActive()) &&
            this.editor.isActive[name]?.(attrs)
          ),
          onClick: () => this.editor.commands[name](attrs)
        })
      }

      const commands = this.schema[schemaName]
      if (commands) {
        for (const [key, description] of Object.entries(descriptions)) {
          const command = ['undo', 'redo'].includes(key) ? 'history' : key
          const setting = commands[command]
          const name = underscore(key)
          const icon = hyphenate(key)
          if (setting) {
            if (description === true) {
              addButton({ name, icon })
            } else if (isObject(description)) {
              const { attr, values, isActive } = description
              if (attr) {
                if (isArray(values) && isArray(setting)) {
                  // Support heading level attrs:
                  for (const value of values) {
                    if (setting.includes(value)) {
                      addButton({
                        name,
                        icon: `${icon}-${value}`,
                        attrs: { [attr]: value },
                        isActive
                      })
                    }
                  }
                }
              } else {
                addButton({ name, icon, isActive })
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
</script>
