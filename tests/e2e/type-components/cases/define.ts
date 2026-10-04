// Case tables for the per-type matrix. These files are pure data: they are
// imported by the admin app (to generate one view per case), by the `Case`
// model (to generate one column per case) and by the specs (to run them),
// so they must not import Playwright or server code.

export interface TypeCase {
  /** Describes the case in the test title. */
  title: string
  /** The component schema, merged over `{ type, label }`. */
  schema?: Record<string, unknown>
  /** The column's property definition, merged over the type's default. */
  property?: Record<string, unknown>
  /** Value to enter into the type component, through its driver. */
  value?: unknown
  /** Expected value in the database after saving `value`. */
  stored?: unknown
  /** Expected displayed value, after a reload or after seeding. */
  shown?: unknown
  /** Value written to the database before the test, to test display. */
  seed?: unknown
  /** Saving `value` must be blocked by validation. */
  invalid?: boolean
}

export interface TypeCases {
  type: string
  property: Record<string, unknown>
  cases: TypeCase[]
}

/** A case with everything needed to render and run it. */
export interface CaseEntry extends TypeCase {
  type: string
  /** Column name and view key, e.g. `color3`. */
  name: string
  /** Route of the case's view, e.g. `color-3`. */
  path: string
  /** Label of the case's component, e.g. `Color 3`. */
  label: string
  schema: Record<string, unknown>
  property: Record<string, unknown>
}

export function defineCases(
  type: string,
  property: Record<string, unknown>,
  cases: TypeCase[]
): TypeCases {
  return { type, property, cases }
}

export function getCaseEntries(types: TypeCases[]): CaseEntry[] {
  return types.flatMap(({ type, property, cases }) => {
    const id = type.replace(/-(\w)/g, (_, char) => char.toUpperCase())
    const title = type[0].toUpperCase() + type.slice(1).replace(/-/g, ' ')
    return cases.map((entry, index) => {
      const label = `${title} ${index + 1}`
      return {
        ...entry,
        type,
        name: `${id}${index + 1}`,
        path: `${type}-${index + 1}`,
        label,
        schema: { type, label, ...entry.schema },
        property: { ...property, ...entry.property }
      }
    })
  })
}
