### Behaviour changes

- **server:** With `app.proxy`, `ctx.ip` is the last `X-Forwarded-For`
  entry, which the closest proxy adds, instead of the first one, which clients
  can forge, and `ctx.ips` only holds that entry. Behind several proxies in a
  row, it is the address of the proxy before the last one.
