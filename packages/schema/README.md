# Dito.js Schema

Dito.js is a declarative and modern web framework with a focus on API driven
development, based on Koa.js, Objection.js and Vue.js

Released in 2018 under the MIT license, with support by https://lineto.com/

Dito.js Schema defines the validation that the server and the admin share: the
formats and keywords of Dito.js schemas as plain definitions,
`{ validate(value, setting), message }`, and the messages of the standard JSON
Schema keywords, without depending on a validator. The server registers them
with Ajv, see the
[validator API docs](https://github.com/ditojs/dito/blob/main/docs/api/server/validator.md#shared-definitions).
The admin doesn't apply formats and keywords to empty values, except those that
check emptiness themselves and set `validatesEmptyValues: true`, i.e. the
formats `required` and `empty` and the keyword `minLength`.
