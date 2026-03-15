import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

export interface TextareaWidget {
  id: number
  textareaBasic: string | null
  textareaLines: string | null
  textareaResizable: string | null
  textareaTrim: string | null
  codeBasic: string | null
  codeLanguage: string | null
  codeIndentSize: string | null
  codeLines: string | null
  codeResizable: string | null
  markupBasic: string | null
  markupLines: string | null
  markupResizable: string | null
  markupMarksSubset: string | null
  markupMarksAll: string | null
  markupMarksLink: string | null
  markupNodesSubset: string | null
  markupNodesHeading: string | null
  markupNodesAll: string | null
  markupToolsHistory: string | null
  markupToolsFootnotes: string | null
  markupEnableRules: string | null
  markupEnableRulesPartial: string | null
  markupHardBreak: string | null
  markupWhitespacePreserve: string | null
  markupWhitespacePreserveAll: string | null
}

export class TextareaWidget extends Model {
  static override properties: ModelProperties = {
    textareaBasic: { type: 'text', nullable: true },
    textareaLines: { type: 'text', nullable: true },
    textareaResizable: {
      type: 'text', nullable: true
    },
    textareaTrim: { type: 'text', nullable: true },
    codeBasic: { type: 'text', nullable: true },
    codeLanguage: { type: 'text', nullable: true },
    codeIndentSize: { type: 'text', nullable: true },
    codeLines: { type: 'text', nullable: true },
    codeResizable: { type: 'text', nullable: true },
    markupBasic: { type: 'text', nullable: true },
    markupLines: { type: 'text', nullable: true },
    markupResizable: { type: 'text', nullable: true },
    markupMarksSubset: {
      type: 'text', nullable: true
    },
    markupMarksAll: { type: 'text', nullable: true },
    markupMarksLink: {
      type: 'text', nullable: true
    },
    markupNodesSubset: {
      type: 'text', nullable: true
    },
    markupNodesHeading: {
      type: 'text', nullable: true
    },
    markupNodesAll: { type: 'text', nullable: true },
    markupToolsHistory: {
      type: 'text', nullable: true
    },
    markupToolsFootnotes: {
      type: 'text', nullable: true
    },
    markupEnableRules: {
      type: 'text', nullable: true
    },
    markupEnableRulesPartial: {
      type: 'text', nullable: true
    },
    markupHardBreak: { type: 'text', nullable: true },
    markupWhitespacePreserve: {
      type: 'text', nullable: true
    },
    markupWhitespacePreserveAll: {
      type: 'text', nullable: true
    }
  }
}
