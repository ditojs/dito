import type { Data, Schema } from '../types.ts'

// The fields of a value that `walkData()` visits, with the data they edit:
export interface DataEntry {
  schema: Schema
  data: Data
  name: string
  dataPath: string | null
  // The data path of `data`, which wrapped values keep:
  itemDataPath: string | null
  // The copy of `data` that the walk builds, if any:
  serializedData: Data | null
}

// Tabs and panels are walked without a name:
export type WalkedDataEntry = Omit<DataEntry, 'name'> & { name: string | null }

export function walkData(
  schema: Schema,
  data: Data,
  options: {
    dataPath?: string | null
    services?: object | null
    rootData?: Data | null
    serializedData?: Data | null
    shouldWalk?: (entry: WalkedDataEntry) => boolean
    shouldSkipSourcesWithResource?: boolean
    visit: (entries: DataEntry[]) => void
    after?: ((entries: DataEntry[]) => void) | null
  }
): Data
