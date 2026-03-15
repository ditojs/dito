import { createWidgetView } from './createWidgetView.js'

export const textarea = createWidgetView('textareaBasic', 'textarea-widgets', {
  // Textarea variants
  textareaBasic: { type: 'textarea', label: 'Basic Textarea' },
  textareaLines: { type: 'textarea', label: 'Lines', lines: 8 },
  textareaResizable: {
    type: 'textarea',
    label: 'Resizable',
    resizable: true
  },
  textareaTrim: {
    type: 'textarea',
    label: 'Trim',
    trim: true
  },
  // Code variants
  codeBasic: { type: 'code', label: 'Basic Code' },
  codeLanguage: {
    type: 'code',
    label: 'Code Language',
    language: 'json'
  },
  codeIndentSize: {
    type: 'code',
    label: 'Code Indent Size',
    indentSize: 4
  },
  codeLines: { type: 'code', label: 'Code Lines', lines: 10 },
  codeResizable: {
    type: 'code',
    label: 'Code Resizable',
    resizable: true
  },
  // Markup variants
  markupBasic: { type: 'markup', label: 'Basic Markup' },
  markupLines: { type: 'markup', label: 'Markup Lines', lines: 5 },
  markupResizable: {
    type: 'markup',
    label: 'Markup Resizable',
    resizable: true
  },
  markupMarksSubset: {
    type: 'markup',
    label: 'Marks Subset',
    marks: { bold: true, italic: true }
  },
  markupMarksAll: {
    type: 'markup',
    label: 'Marks All',
    marks: {
      bold: true,
      italic: true,
      underline: true,
      strike: true,
      small: true,
      code: true,
      subscript: true,
      superscript: true,
      link: true
    }
  },
  markupMarksLink: {
    type: 'markup',
    label: 'Marks Link',
    marks: { link: true }
  },
  markupNodesSubset: {
    type: 'markup',
    label: 'Nodes Subset',
    nodes: { heading: [1, 2], bulletList: true }
  },
  markupNodesHeading: {
    type: 'markup',
    label: 'Nodes Heading',
    nodes: { heading: [1, 2, 3] }
  },
  markupNodesAll: {
    type: 'markup',
    label: 'Nodes All',
    nodes: {
      heading: [1, 2, 3, 4, 5, 6],
      bulletList: true,
      orderedList: true,
      blockquote: true,
      codeBlock: true,
      horizontalRule: true
    }
  },
  markupToolsHistory: {
    type: 'markup',
    label: 'Tools History',
    tools: { history: true }
  },
  markupToolsFootnotes: {
    type: 'markup',
    label: 'Tools Footnotes',
    tools: { footnotes: true }
  },
  markupEnableRules: {
    type: 'markup',
    label: 'Enable Rules',
    enableRules: true
  },
  markupEnableRulesPartial: {
    type: 'markup',
    label: 'Enable Rules Partial',
    enableRules: { input: true, paste: false }
  },
  markupHardBreak: {
    type: 'markup',
    label: 'Hard Break',
    hardBreak: true
  },
  markupWhitespacePreserve: {
    type: 'markup',
    label: 'Whitespace Preserve',
    whitespace: 'preserve'
  },
  markupWhitespacePreserveAll: {
    type: 'markup',
    label: 'Whitespace Preserve All',
    whitespace: 'preserve-all'
  }
})
