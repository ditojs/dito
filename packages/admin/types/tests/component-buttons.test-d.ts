import { expectTypeOf, assertType, describe, it } from 'vitest';
import type { Buttons } from '../index.d.ts';
import type { Entry, ParentWithMarkers } from './fixtures.ts';

describe('Buttons', () => {
  it('accepts button without type', () => {
    assertType<Buttons<Entry>>({
      save: { text: 'Save' }
    });
  });

  it('accepts button with type', () => {
    assertType<Buttons<Entry>>({
      save: { type: 'button', text: 'Save' }
    });
  });

  it('click callback receives typed item', () => {
    assertType<Buttons<Entry>>({
      save: {
        text: 'Save',
        events: {
          click({ item }) {
            expectTypeOf(item).toHaveProperty('id');
            expectTypeOf(item).toHaveProperty('title');
            expectTypeOf(item.id).toBeNumber();
            expectTypeOf(item.title).toBeString();
          }
        }
      }
    });
  });

  it('rejects invalid button type', () => {
    assertType<Buttons<Entry>>({
      save: {
        // @ts-expect-error 'text' is not a valid button type
        type: 'text',
        text: 'Save'
      }
    });
  });

  it('click callback item omits never-typed marker keys', () => {
    assertType<Buttons<ParentWithMarkers>>({
      save: {
        text: 'Save',
        events: {
          click({ item }) {
            expectTypeOf(item).toHaveProperty('id');
            expectTypeOf(item).toHaveProperty('title');
            expectTypeOf(item).toHaveProperty('entries');
            expectTypeOf(item).not.toHaveProperty('viewButton');
            expectTypeOf(item).not.toHaveProperty('spacer');
          }
        }
      }
    });
  });
});
