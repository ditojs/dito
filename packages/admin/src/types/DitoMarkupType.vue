<template lang="pug">
.dito-markup(
  :id="componentPath"
  ref="element"
  :class=`{
    'dito-markup--has-errors': !!errorsElementId,
    'dito-markup--disabled': disabled
  }`
)
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
    ref="editorContent"
    :editor="editor"
    :style="styles"
  )
  DitoResizeHandle(
    v-if="resizable"
    :getElement="() => $refs.editorContent.$el"
    @resize="height = `${$event}px`"
  )
</template>

<script>
import { computed, onUnmounted, ref, watch } from 'vue'
import { defineType } from '../utils/schema/types.ts'
import { textTraits } from './traits.ts'
import { fieldProps, useField } from '../composables/useField.ts'
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
import {
  isArray,
  isObject,
  hyphenate,
  camelize,
  labelize,
  isUrl
} from '@ditojs/utils'

// @vue/component
const DitoMarkupType = {
  components: {
    EditorContent,
    DitoButton,
    DitoIcon,
    DitoResizeHandle
  },

  props: fieldProps,

  setup(props) {
    const field = useField(props, {
      focusElement: () => editor.commands.focus(),
      blurElement: () => editor.commands.blur()
    })
    const {
      value,
      focused,
      readonly,
      disabled,
      autofocus,
      services,
      getSchemaValue
    } = field
    const height = ref(null)
    const hardBreak = computed(() => !!props.schema.hardBreak)

    const whitespace = computed(() =>
      // Possible values are: 'collapse', 'preserve', 'preserve-all'
      getSchemaValue('whitespace', { type: String, default: 'collapse' })
    )

    const enableRules = computed(() => {
      const enableRules = getSchemaValue('enableRules', {
        type: [Object, Boolean],
        default: false
      })
      return isObject(enableRules)
        ? enableRules
        : {
            input: !!enableRules,
            paste: !!enableRules
          }
    })

    const parseOptions = computed(() => ({
      preserveWhitespace: {
        'collapse': false,
        'preserve': true,
        'preserve-all': 'full'
      }[whitespace.value]
    }))

    const editorOptions = computed(() => ({
      editable: !readonly.value && !disabled.value,
      autofocus: autofocus.value,
      enableInputRules: enableRules.value.input,
      enablePasteRules: enableRules.value.paste,
      parseOptions: parseOptions.value,
      editorProps: hardBreak.value
        ? {
            handlePaste: (view, event, slice) => {
              const { schema } = view.state
              const paragraph = schema.nodes.paragraph.create(
                null,
                getInlineContentAsLine(slice.content, schema)
              )
              // Insert as an open slice, to merge into the line's paragraph:
              view.dispatch(
                view.state.tr.replaceSelection(
                  new Slice(Fragment.from(paragraph), 1, 1)
                )
              )
              return true
            }
          }
        : {}
    }))

    let ignoreWatch = false

    const changeOnceEdited = createChangeOnceEdited({
      isEditing: () => focused.value,
      emitChange: () => field.onChange()
    })

    const updateValue = () => {
      const content = editor.getHTML()
      // Empty documents hold the empty value, whatever empty nodes are left:
      const html = editor.isEmpty
        ? props.field.getEmptyValue()
        : hardBreak.value
          ? content.replace(/^<p>(.*?)<\/p>$/s, '$1')
          : content
      if (html !== value.value) {
        changeOnceEdited.markEdited()
        // Don't set it back as content, re-parsing collapses whitespace:
        ignoreWatch = true
        value.value = html
      }
      changeOnceEdited.emitIfDone()
    }

    const onClickLink = async editor => {
      // The dialog returns the focus to what was focused before it: the editor,
      // not the button. `editor.commands.focus()` would wait for a frame:
      editor.view.focus()
      const attributes = await services.adminContext.showDialog({
        fields: {
          href: {
            // Accept links without scheme, they get `https://` when applied:
            type: 'text',
            label: 'Link',
            autofocus: true,
            validate: ({ value }) => isUrl(value) || 'is not a valid URL'
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
            onClick({ closeDialog }) {
              closeDialog(null)
            }
          }
        },
        data: getMarkAttributes(editor.state, 'link')
      })
      if (attributes) {
        let { href, title } = attributes
        if (href) {
          // Prefix unparsable URLs with a default protocol:
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
    }

    const getExtensions = () => {
      const { marks = {}, nodes = {}, tools = {} } = props.schema
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
            const setHardBreak = () => editor.commands.setHardBreak()
            return {
              'Mod-Enter': setHardBreak,
              'Shift-Enter': setHardBreak,
              ...(hardBreak.value ? { Enter: setHardBreak } : null)
            }
          }
        })
      ].filter(extension => !!extension)
    }

    const getButtons = (settingsName, descriptions) => {
      const list = []
      const { commands } = editor

      const addButton = ({
        name,
        id = name,
        label = labelize(id),
        icon,
        command,
        attributes,
        onClick
      }) => {
        list.push({
          id,
          label,
          icon,
          isActive: editor.isActive(name, attributes),
          onClick: () => {
            command ??=
              name in commands
                ? name
                : `toggle${camelize(name, true)}`
            if (command in commands) {
              const apply = attributes =>
                editor.chain()[command](attributes).focus().run()
              onClick
                ? onClick(editor, attributes)
                : apply(attributes)
            }
          }
        })
      }

      const settings = props.schema[settingsName]
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
    }

    const editor = new Editor({
      ...editorOptions.value,
      onFocus: () => field.onFocus(),
      onBlur: () => {
        field.onBlur()
        changeOnceEdited.emitIfDone()
      },
      onUpdate: updateValue,
      extensions: getExtensions(),
      content: value.value || ''
    })

    watch(value, value => {
      if (ignoreWatch) {
        ignoreWatch = false
      } else {
        const content = hardBreak.value ? `<p>${value ?? ''}</p>` : value ?? ''
        editor.commands.setContent(content, {
          emitUpdate: false,
          parseOptions: parseOptions.value
        })
      }
    })

    watch(
      [readonly, disabled, autofocus, enableRules],
      () => editor.setOptions(editorOptions.value)
    )

    onUnmounted(() => editor.destroy())

    return {
      ...field,
      editor,
      height,
      resizable: computed(() =>
        getSchemaValue('resizable', { type: Boolean, default: false })
      ),

      styles: computed(() => ({
        height: (
          height.value ||
          `calc(${
            getSchemaValue('lines', { type: Number, default: 10 })
          }em * var(--line-height))`
        )
      })),

      groupedButtons: computed(() =>
        [
          getButtons('marks', {
            bold: true,
            italic: true,
            underline: true,
            strike: true,
            small: true,
            code: true,
            subscript: true,
            superscript: true,
            link: {
              onClick: editor => onClickLink(editor)
            }
          }),
          getButtons('nodes', {
            paragraph: {
              command: 'setParagraph'
            },
            heading: {
              attribute: 'level',
              values: headingLevels
            }
          }),
          getButtons('nodes', {
            bulletList: true,
            orderedList: true,
            blockquote: true,
            codeBlock: true
          }),
          getButtons('tools', {
            undo: true,
            redo: true,
            footnotes: {
              command: 'addFootnote'
            }
          })
        ].filter(buttons => buttons.length > 0)
      )
    }
  }
}

defineType({
  type: 'markup',
  component: DitoMarkupType,
  ...textTraits
})

export default DitoMarkupType

const headingLevels = [1, 2, 3, 4, 5, 6]

function getHeadingLevels(setting) {
  return setting === true ? headingLevels : setting
}

// A line can only hold inline content: join the textblocks with hard breaks,
// dropping the block nodes around them.
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
      // Top-level inline nodes, like from inline HTML:
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

  &--has-errors {
    @extend %input--has-errors;
  }

  &--disabled {
    @extend %field--disabled;
  }

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
