### Behaviour changes

- **admin:** Uncached `get` requests through a component's context end when the component unmounts, without settling, so the code that awaits them doesn't run on.
