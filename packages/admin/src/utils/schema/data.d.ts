import type { Context } from './types.ts'
import type { Data, Schema } from '../types.ts'
import type { DataEntry, DataSource } from './walk.js'

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
export function getDefaultValue(schema: Schema, context: Context): any
export function getEmptyValue(schema: Schema, context: Context): any
export function hasComputedValueSource(schema: Schema): boolean
export function hasValueFromDataSchema(schema: Schema): boolean
export function getMultipleValue(schema: Schema, context: Context): boolean
export function initializeData(
  schema: Schema,
  data?: Data,
  services?: object | null,
  options?: Options
): Data
export function getComputedValue(
  schema: Schema,
  data: Data,
  name: string,
  dataPath: string | (() => string),
  options?: Options
): any
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
export function serializeData(
  schema: Schema | null,
  sourceSchema: Schema | null,
  data: Data,
  dataPath: string,
  options?: Options
): Data
export function callOrLog<T>(callback: () => T, fallback: T): T
export function isDataPathExcluded(
  schema: Schema,
  data: Data,
  dataPath: string,
  options?: Options
): boolean
export function deserializeData(
  schema: Schema,
  data: Data,
  options?: {
    services?: object | null
    dataPath?: string | null
    rootData?: Data | null
    shouldVisit?: (entry: DataEntry) => boolean
  }
): Data
export function getItemDisplayValue(
  sourceSchema: Schema,
  item: Data,
  name: string,
  options: { services: object; dataPath: string; context: Context }
): any
export function getItemId(sourceSchema: Schema, item: Data): string | undefined
export function hasItemsNumberedByOrderKey(source: DataSource): boolean
export function updateOrder<T extends any[]>(
  sourceSchema: Schema,
  list: T,
  offset?: number
): T
export function getItemUid(sourceSchema: Schema, item: Data): string
