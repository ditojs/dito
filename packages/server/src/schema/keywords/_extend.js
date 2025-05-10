import { resolve } from 'url'
import { MissingRefError } from 'ajv'
import { clone, mergeDeeply } from '@ditojs/utils'

export const $extend = {
  macro(schemas, parentSchema, ctx) {
    const [source, ...patch] = schemas.map(schema => {
      const { $ref } = schema
      if ($ref) {
        const { baseId, self } = ctx
        const id =
          baseId && baseId !== '#'
            ? resolve(baseId, $ref)
            : $ref
        const validate = self.getSchema(id)
        if (!validate) {
          throw new MissingRefError(baseId, $ref)
        }
        schema = validate.schema
      }
      return schema
    })
    return mergeDeeply(clone(source), ...patch)
  },

  metaSchema: {
    type: 'array',
    items: { type: 'object' },
    minItems: 2
  }
}
