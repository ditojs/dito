import { expectTypeOf, assertType, describe, it } from 'vitest';
import type {
  DitoContext,
  OrItemAccessor
} from '../index.d.ts';
import type { Entry, ParentWithMarkers } from './fixtures.ts';

describe('DitoContext', () => {
  it('item strips never keys', () => {
    type Ctx = DitoContext<ParentWithMarkers>;
    expectTypeOf<Ctx['item']>().toHaveProperty('id');
    expectTypeOf<Ctx['item']>().toHaveProperty('title');
    expectTypeOf<Ctx['item']>().toHaveProperty('entries');
    expectTypeOf<Ctx['item']>().not.toHaveProperty('viewButton');
    expectTypeOf<Ctx['item']>().not.toHaveProperty('spacer');
  });

  it('item preserves data keys', () => {
    type Ctx = DitoContext<Entry>;
    expectTypeOf<Ctx['item']>().toEqualTypeOf<{
      id: number;
      title: string;
    }>();
  });

  it('OrItemAccessor accepts value or callback', () => {
    assertType<OrItemAccessor<Entry, {}, string>>('hello');
    assertType<OrItemAccessor<Entry, {}, string>>(
      (ctx: DitoContext<Entry>) => ctx.item.title
    );
  });
});
