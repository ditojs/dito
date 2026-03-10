import { expectTypeOf, assertType, describe, it } from 'vitest';
import type {
  DitoContext,
  DitoFormInstance,
  OrItemAccessor,
  ItemAccessor
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

  it('has expected properties', () => {
    type Ctx = DitoContext<Entry>;
    expectTypeOf<Ctx['name']>().toBeString();
    expectTypeOf<Ctx['dataPath']>().toBeString();
    expectTypeOf<Ctx['value']>().toBeAny();
    expectTypeOf<Ctx['nested']>().toBeBoolean();
  });

  it('OrItemAccessor accepts value or callback', () => {
    assertType<OrItemAccessor<Entry, {}, string>>('hello');
    assertType<OrItemAccessor<Entry, {}, string>>(
      (ctx: DitoContext<Entry>) => ctx.item.title
    );
  });

  it('user.hasRole() returns boolean', () => {
    type Ctx = DitoContext<Entry>;
    expectTypeOf<Ctx['user']['hasRole']>()
      .returns.toBeBoolean();
  });

  it('formComponent is DitoFormInstance', () => {
    type Ctx = DitoContext<Entry>;
    expectTypeOf<Ctx['formComponent']>()
      .toMatchTypeOf<DitoFormInstance>();
  });

  it('ItemAccessor callback receives typed item without never keys', () => {
    type Cb = ItemAccessor<ParentWithMarkers, {}, string>;
    type CbParam = Parameters<Cb>[0];
    expectTypeOf<CbParam['item']>().toHaveProperty('id');
    expectTypeOf<CbParam['item']>().toHaveProperty('title');
    expectTypeOf<CbParam['item']>().toHaveProperty('entries');
    expectTypeOf<CbParam['item']>().not.toHaveProperty('viewButton');
    expectTypeOf<CbParam['item']>().not.toHaveProperty('spacer');
  });
});
