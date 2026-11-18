### Behaviour changes

- **ui:** `DitoSwitch` is built on `reka-ui`'s `Switch`, a button with `role="switch"` instead of a checkbox:
  - It no longer emits `change`; listen to `update:modelValue` instead.
  - Enter toggles it as well as Space, so dialogs don't submit on Enter from a switch.
  - Without `modelValue`, or with `undefined`, it keeps its own state.
  - Its state is `[data-state='checked']` and `[data-disabled]` on `.dito-switch__control`, instead of `.dito-switch--checked` and `.dito-switch--disabled`.
  - `.dito-switch__pane` and its `input` are replaced by the `button.dito-switch__control`, and `.dito-switch__button` is now `.dito-switch__thumb`.
