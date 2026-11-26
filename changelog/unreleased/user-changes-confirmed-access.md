### Behaviour changes

- **server:** Model and relation controllers and graph writes that set the
  password or change the username of an existing user answer 403 with
  `confirmationRequired` without confirmed access, like users controllers, for
  users of the logged-in user's own model, e.g. admins changing admins, not
  admins changing customers. Users controllers no longer answer 401 to users of
  other models for these writes, and `authorize` decides who may make them.
