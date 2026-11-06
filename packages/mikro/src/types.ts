import type { EntityManager } from '@mikro-orm/sql'

// Type `c.var.em` and `em` of the handlers as MikroORM's entity manager, for
// apps that import '@ditojs/mikro/types' once.

declare module '@ditojs/server' {
  interface DitoVariables {
    em: EntityManager
  }
}
