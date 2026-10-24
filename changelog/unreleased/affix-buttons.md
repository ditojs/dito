### New

- **admin:** Affixes of inputs can be buttons, `{ type: 'button', text | icon, title?, disabled?, onClick? }`, whose `onClick()` receives the context of the field.
- **admin:** Affixes with `hover: true` only show while the input is hovered, in place of the other affixes of their side, like the clear button, which is now built this way.
- **ui:** A `lock` icon.

### Behaviour changes

- **admin:** The login dialog shows an at-sign icon in the username and a lock icon in the password field, and with `authentication.hasPasswordReset`, a Forgot? button in the password field instead of the Forgot password? button below the fields.
- **ui:** `DitoInput` spaces its prefix and suffix from the text by the input's horizontal padding.
