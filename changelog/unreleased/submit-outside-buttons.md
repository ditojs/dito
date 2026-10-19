### New

- **admin:** `context.submit()` outside of buttons, e.g. in form events, layout components, `useDitoContext()` and field callbacks, submits the form like a click on its submit button, with its `resource`, `onSuccess()` and `onError()`, instead of throwing. The form stays open unless `submit({ closeForm: true })` closes it. Forms without a submit button throw `Unable to submit: The form has no submit button.`
