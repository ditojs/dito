import type { EntityManager } from '@mikro-orm/sql'

// Type `c.var.em` and `em` of the handlers as MikroORM's entity manager, for
// apps that import '@ditojs/mikro/types' once. `@ditojs/kit` imports it for its
// apps. It isn't part of the main entry, so that `em` can stay a stub in tests.

declare module '@ditojs/server' {
  interface DitoVariables {
    em: EntityManager
  }
}
