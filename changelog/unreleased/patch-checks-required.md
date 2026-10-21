### Behaviour changes

- **server:** Patches check the values of `required` properties that they send, rejecting empty strings with 'is required'. Properties that patches leave out remain unchecked.
