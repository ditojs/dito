### Behaviour changes

- **ui:** `DitoSwitch` is built on `reka-ui`'s `Switch`, a button with `role="switch"` instead of a checkbox:
  - It no longer emits `change`; listen to `update:modelValue` instead.
  - Its state is `[data-state='checked']` and `[data-disabled]` on `.dito-switch__control`, instead of `.dito-switch--checked` and `.dito-switch--disabled`.
