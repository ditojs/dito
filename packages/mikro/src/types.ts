import type { EntityManager } from '@mikro-orm/sql'

// Types `c.var.em` and `em` of the handlers as MikroORM's entity manager, for
// apps that import this module once:
//
//   import '@ditojs/mikro/types'

declare module '@ditojs/server' {
  interface DitoVariables {
    em: EntityManager
  }
}
