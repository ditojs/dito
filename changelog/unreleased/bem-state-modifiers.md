### Behaviour changes

- **ui:** The states of calendar items are modifiers of `dito-calendar__item`, so styles and tests that select them need to follow: `dito-calendar-item-today`, `-active`, `-current` and `-gray` become `dito-calendar__item--today`, `--active`, `--current` and `--gray`.
- **ui:** Fields show errors and their disabled state by `--has-errors` and `--disabled` modifiers of their own block, which extend the new `%field-has-errors`, `%input-has-errors` and `%field-disabled` placeholders, instead of by `.dito-container--has-errors` and `.dito-container--disabled` around them. Custom blocks that extend `%field` or `%input` need to set these modifiers, and errors of a container no longer mark the fields inside it.
