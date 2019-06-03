<template lang="pug">
  .dito-markup(
    :id="dataPath"
  )
    editor-menu-bar.dito-markup-toolbar(:editor="editor")
      .dito-buttons.dito-buttons-toolbar
        .dito-button-group(
          v-for="(commands, group) in groupedCommands"
          :key="group"
        )
          button.dito-button(
            v-for="{ name, icon, isActive, onClick } in commands"
            :class="{ 'dito-active': isActive }",
            @click="onClick"
          )
            i(:class="`dito-icon-${icon}`")
    editor-content.dito-markup-editor(:editor="editor")
</template>

<style lang="sass">
.dito
  .dito-markup
    @extend %input

    .ProseMirror:focus
      outline: none

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
  Blockquote, CodeBlock, HardBreak, Heading, HorizontalRule,
  OrderedList, BulletList, ListItem, TodoItem, TodoList,
  Bold, Code, Italic, Link, Strike, Underline, History
} from 'tiptap-extensions'
import { isArray, underscore, hyphenate, debounce } from '@ditojs/utils'

// @vue/component
export default TypeComponent.register('markup', {
  components: {
    EditorContent,
    EditorMenuBar
  },

  data() {
    return {
      editor: null
    }
  },

  computed: {
    commands() {
      return this.editor.commands
    },

    isActive() {
      return this.editor.isActive
    },

    groupedCommands() {
      const grouped = {
        inline: this.getCommands({
          bold: true,
          italic: true,
          strike: true,
          underline: true,
          code: true
        }),
        layout: this.getCommands({
          paragraph: true,
          heading: [1, 2, 3]
        }),
        blocks: this.getCommands({
          bulletList: true,
          orderedList: true,
          blockquote: true,
          codeBlock: true
        }),
        history: this.getCommands({
          undo: true,
          redo: true
        })
      }
      // Do not show the paragraph command as active if any of the block
      // commands are also active:
      const [first] = grouped.layout
      const paragraph = first?.name === 'paragraph' && first
      if (
        paragraph?.isActive &&
        grouped.blocks.some(command => command.isActive)
      ) {
        paragraph.isActive = false
      }
      return grouped
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

    this.editor = new Editor({
      editable: !this.readyonly,
      autoFocus: this.autofocus,
      onFocus,
      onBlur,
      onUpdate,
      extensions: this.getExtensions(),
      content: this.value || ''
    })

    this.$watch('value', value => {
      if (ignoreWatch) {
        ignoreWatch = false
      } else {
        this.editor.setContent(value)
      }
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
      const { commands } = this.schema
      return [
        commands.blockquote && new Blockquote(),
        commands.codeBlock && new CodeBlock(),
        new HardBreak(), // TODO: Should this always on?
        commands.heading && new Heading({ levels: commands.heading }),
        commands.horizontalRule && new HorizontalRule(),
        (commands.orderedList || commands.bulletList) && new ListItem(),
        commands.bulletList && new BulletList(),
        commands.orderedList && new OrderedList(),
        commands.todoList && new TodoItem(), // TODO
        commands.todoList && new TodoList(), // TODO
        commands.link && new Link(), // TODO
        commands.bold && new Bold(),
        commands.code && new Code(),
        commands.italic && new Italic(),
        commands.strike && new Strike(),
        commands.underline && new Underline(),
        commands.history && new History()
      ].filter(extension => !!extension)
    },

    getCommands(descriptions) {
      const list = []

      const addCommand = (name, icon, attrs) => {
        list.push({
          name,
          icon,
          isActive: name in this.isActive && this.isActive[name](attrs),
          onClick: () => this.commands[name](attrs)
        })
      }

      const { commands } = this.schema
      if (commands) {
        for (const [key, value] of Object.entries(descriptions)) {
          const command = ['undo', 'redo'].includes(key) ? 'history' : key
          const setting = commands[command]
          const name = underscore(key)
          const icon = hyphenate(key)
          if (setting) {
            if (value === true) {
              addCommand(name, icon)
            } else if (isArray(value) && isArray(setting)) {
              // Support heading level attrs:
              for (const level of value) {
                if (setting.includes(level)) {
                  addCommand(name, `${icon}-${level}`, { level })
                }
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
