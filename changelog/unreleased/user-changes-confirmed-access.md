### Behaviour changes

- **server:** Model and relation controllers and graph writes that set the
  password or change the username of an existing user answer 403 with
  `confirmationRequired` without confirmed access, like users controllers. The
  access is that of the logged-in user, of whichever user model, e.g. an admin
  changing a customer, so users controllers no longer answer 401 to users of
  other models for these writes, and `authorize` decides who may make them.
