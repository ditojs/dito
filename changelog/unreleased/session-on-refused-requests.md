### Behaviour changes

- **admin:** Requests to the API no longer fetch the session before they are sent, so endpoints that need no login work without one. When a request answers 401 and the session expired, the admin asks to log in and sends the request again, see [`api.users`](../../docs/api/admin/admin.md#users).
