import type { Context } from './types.ts'
import type { Data, Schema } from '../types.ts'
import type { DataEntry, DataSource } from './walk.js'
import type { ValueError } from '../DataErrors.ts'

type Options = Record<string, any>

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
export function serializeData(
  schema: Schema | null,
  sourceSchema: Schema | null,
  data: Data,
  dataPath: string,
  options?: Options
): Data
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
export function getDataValidationErrors(
  schema: Schema,
  data: Data,
  options?: Options
): Record<string, ValueError[]> | null
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
