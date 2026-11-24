### Fixes

- **server:** Sessions that end while a parallel request still runs, e.g.
  through a logout, stay ended, instead of being written back by the other
  request. Session cookies with ids that have no stored session start a new
  session with a new id.
