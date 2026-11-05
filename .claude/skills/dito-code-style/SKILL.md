---
name: dito-code-style
description: Use when writing, editing or reviewing JavaScript, TypeScript or Vue code in Dito.js. Covers its principles, structure, naming, comments, expressions and API taste, plus a checklist of where generated code drifts away from them.
---

# Dito.js code style

Taken from Dito.js's hand-written code before 2025. ESLint and Prettier with
[Penere](https://github.com/ditojs/prettier-plugin-penere) (80 columns) still
apply; this covers what they leave open.

## Principles

1. **Everything has its owner.** Code and state live where they belong by
   what they are, not where they were first needed.
2. **Derive instead of repeating.** What the system knows isn't configured or
   stored twice. A derived value is computed once and kept as a plain field.
3. **New replaces old.** Remove what a new mechanism makes unnecessary, in
   the same change.
4. **Code reads like its meaning.** `if`/`else` for alternatives. Returning
   means success, throwing means failure.
5. **Names say what something is.** Domain words, pairs that match
   (`createSecret()` / `confirmSecret()`), no ambiguous abbreviations.
6. **The same thing has the same shape.** Siblings take the same arguments
   and options sit at the same depth.
7. **Validate at the boundary, trust inside.** No checks for states the
   code's own flow rules out.
8. **Less machinery.** Fewer parts, places and names. No manager or tracker
   classes for a few lines of state.
9. **Declarative.** Apps declare what they need, with sensible defaults and
   escape hatches. Libraries underneath stay behind Dito: their quirks are
   handled in Dito, not handed to apps, and only their public API is used.
10. **Fix inside the design,** with the smallest diff, keeping names and
    behaviour.

## Structure

- Methods do the whole job, 40–60 lines with short section comments are
  fine. No one-line wrapper methods.
- Helpers that one method needs are local closures; helpers that a module
  shares are plain functions at its bottom.
- `#private` for internals, `_name` for those that subclasses reach.
- TypeScript describes the code. Fix types instead of casting
  (`as never`, `as unknown as`).

## Naming

- Short domain words: `value`, `data`, `schema`, `options`, `path`, `key`.
  No `Info`, `Meta`, `Manager`, `Handler` suffixes.
- Full words, not abbreviations: `context`, `error`, `database`, not `ctx`,
  `err`, `db`, above all in public names that apps write or destructure.
  Names that a library gives keep its spelling: Hono's `c`, MikroORM's `em`.
- Functions start with a verb: `get*`, `create*`, `setup*`, `handle*`,
  `normalize*`. Factories are `create*` or `define*` (`createApi()`,
  `defineController()`), not named after what they return.
- Predicates are `is*`, `has*`, `should*`. Options and props are plain
  adjectives (`transacted`, `editable`).
- Acronyms are words: `getResourceUrl`, `formatJson`, `ApiConfig`.
- Collections after their content, indexes after their key: `filesByKey`.
- Constants in camelCase; UPPER_CASE only for symbols.

## Comments

- About 1 line in 12, mostly one line. Say why, never restate the code.
- Imperative or "we": "Remove the query …", "we only need …". Not "Returns
  …".
- A comment that introduces the next line ends with a colon.
- `// NOTE:` for gotchas, `// TODO:` for open questions.
- No module header essays, no history ("now", "no longer"), no JSDoc in
  implementation code.

## Expressions

- Wrap the work in a positive condition instead of a guard return, and put
  the positive case first.
- Ternaries for values, nested ones indented vertically.
- `&&` / `||` by precedence, `||=` / `??=`, destructuring at the top.
- `for … of` for effects, `map` / `filter` for transforms.
- Normalize polymorphic arguments in one line:
  `const { delay } = isNumber(options) ? { delay: options } : options`
- `?.` only where a value can really be missing.
- Errors start with "Invalid", "Unknown", "Unsupported" or "Unable to", with
  values in single quotes.
- Line breaks are deliberate: Penere keeps them. Short constructs stay on one
  line; multi-line conditions go in parentheses, operators at line ends.

## API

- Declarative definitions with a shorthand and a full form (`true` or an
  options object, a number or `{ delay, immediate }`).
- Schema options are plain words (`paginate`, `stayOpen`), since apps write
  them as data.
- Extend by overriding and `super`, not by callback registries. Hooks use
  plain verbs and before/after pairs.

## Checklist

Check every diff against this before showing or committing it, also diffs by
other agents:

- [ ] Comments: too many, too long, doc-style openers, "see …", "e.g.".
- [ ] Compressed prose that packs several facts into one sentence.
- [ ] Guard returns, tiny wrappers, new classes, speculative `?.`.
- [ ] Nouns as function names, padded names, renamed vocabulary.
- [ ] Casts, or a library's internals.
- [ ] Machinery more general than the problem.
- [ ] Unread diffs, also delegated ones.
