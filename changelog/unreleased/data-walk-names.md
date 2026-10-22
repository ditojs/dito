### Behaviour changes

- **admin:** Hidden values aren't sent: fields whose `if` is false, or that are in hidden sections, tabs or panels, leave out their values when the data is saved or copied, as written properties already did.
- **admin:** Of several fields of the same value, only the shown ones count: hidden ones set no defaults, run no `serializeValue()` and don't display the value in item labels and table cells. Fields with `visible: false` count as shown. New data gets no defaults for hidden values until they're shown.
- **admin:** Item labels and table cells only display the values of the item itself, not values of the same name in its nested sections.

### Fixes

- **admin:** Options fields with `nullable: false`, e.g. selects, no longer fail when they get their empty value.
