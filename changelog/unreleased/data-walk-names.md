### Behaviour changes

- **admin:** Hidden values aren't sent: fields whose `if` is false, or that are in hidden sections, tabs or panels, leave out their values when the data is saved or copied.
- **admin:** Of several fields of the same value, only the shown ones count: hidden ones run no `serializeValue()` and don't display the value in item labels and table cells. Fields with `visible: false` count as shown. Hidden fields still set their defaults, so that `if` callbacks can read them.
- **admin:** Item labels and table cells only display the values of the item itself, not values of the same name in its nested sections.

### Fixes

- **admin:** Options fields with `nullable: false`, e.g. selects, no longer fail when they get their empty value.
