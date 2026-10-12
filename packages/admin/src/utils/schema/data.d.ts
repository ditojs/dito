import type { Context } from './types.ts'
import type { Data, Schema, SchemaDataWalk } from '../types.ts'

type Options = Record<string, any>

export function getSchemaValue(
  keyOrDataPath: string | string[],
  options?: Options
): any
export function shouldRenderSchema(
  schema: Schema | null,
  context: Context
): boolean
export function getDefaultValue(schema: Schema, context: Context): any
export function shouldSetDefaultValue(
  schema: Schema,
  data: Data,
  name: string,
  context: Context | (() => Context),
  options?: Options
): boolean
export function setDefaultValue(
  schema: Schema,
  data: Data,
  name: string,
  context: Context | (() => Context)
): void
export function hasValueFromDataSchema(schema: Schema): boolean
export function getMultipleValue(schema: Schema, context?: Context): boolean
export function initializeData(
  schema: Schema,
  data?: Data,
  services?: object | null,
  options?: Options
): Data
export function computeValue(
  schema: Schema,
  data: Data,
  name: string,
  dataPath: string | (() => string),
  options?: Options
): any
export function getValueOrDefault(
  schema: Schema,
  data: Data,
  name: string,
  context: Context | (() => Context)
): any
export function processData(
  schema: Schema | null,
  sourceSchema: Schema | null,
  data: Data,
  dataPath: string,
  options?: Options
): Data
export function processSchemaData(
  schema: Schema,
  data: Data,
  walk: SchemaDataWalk
): void
export function getComponentPathByDataPath(
  schema: Schema,
  data: Data | null,
  dataPath: string,
  options?: Options
): string
export function getItemId(sourceSchema: Schema, item: Data): string | undefined
export function hasItemsNumberedByOrderKey(schema: Schema): boolean
export function updateOrder<T extends any[]>(
  sourceSchema: Schema,
  list: T,
  offset?: number
): T
export function getItemUid(sourceSchema: Schema, item: Data): string
