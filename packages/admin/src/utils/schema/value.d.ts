import type { Context } from './types.ts'
import type { Schema } from '../types.ts'

type Options = Record<string, any>

export function getSchemaValue(
  keyOrDataPath: string | string[],
  options?: Options
): any
export type Label =
  | string
  | { text?: string; html?: string; prefix?: any; suffix?: any }
export function getLabel(
  schema: Schema | null,
  context: Context,
  name?: string
): Label
export function shouldRenderSchema(
  schema: Schema | null,
  context: Context
): boolean
export function resolveValue(
  value: any,
  context: Context | (() => Context)
): any
export function hasComputedValueSource(schema: Schema): boolean
export function hasValueFromDataSchema(schema: Schema): boolean
export function getMultipleValue(schema: Schema, context: Context): boolean
export function getEditedValue(
  schema: Schema,
  value: any,
  context: Context | (() => Context)
): any
export function parseEditedValue(
  schema: Schema,
  value: any,
  createContext: (value: any) => Context
): any
export function callOrLog<T>(callback: () => T, fallback: T): T
