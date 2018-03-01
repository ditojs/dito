# Dito.js Seeds

Seeds allow you to quickly seed the database for example for the purpose of
testing. Seeds are put in the *seeds* folder within the project folder.
There are three ways to create a seed:

1. Create a JSON file with the same name as the model file. The contained JSON
   is added to the database with the upsertGraph method.
```js
[
  {
    "username": "me",
    "email": "me@example.com",
    "password": "secret"
  },
  {
    "username": "jill",
    "email": "jill@example.net",
    "password": "secret"
  }
]
```
2. Create a js file with the same name as the model file. The function exported
   by this file is executed with the models as argument.

```js
export function(models) {
  const { Model1 } = models

  // Do something

  return jsonResult
}
```

3. Create an arbitrarily named js file in the seeds folder and seed the model
   manually.

```js
export function({ Model1, Model2 }) {
  // Do something

  await Model1.insertGraph(model1Data)
  return Model2.insertGraph(model2Data)
}
```


To execute all the seeds use the commandline.

```sh
yarn db:seed
```
