### Behaviour changes

- **admin:** Arrays of written `asset` properties send files that aren't uploaded as `null` instead of leaving them out, like single assets, as saving waits for running uploads.
- **admin:** Objects with `nullable: false` start as `{}`, like written properties of objects.
