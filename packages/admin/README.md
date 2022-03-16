# Dito.js Admin

Dito.js is a declarative and modern web framework with a focus on API driven
development, based on Koa.js, Objection.js and Vue.js

Released in 2018 under the MIT license, with support by https://lineto.com/

Dito.js Admin is a schema based admin interface for Dito.js, featuring auto-
generated views and forms and built with Vue.js

## Build Setup

``` bash
# install dependencies
yarn install

# serve your admin folder sym-linked into `dev` with hot reload at localhost:8080
yarn serer

# build library for production, with and without minification
yarn build

# build for production and view the bundle analyzer report
yarn build --report
```

For detailed explanation on how things work, checkout the [guide](http://vuejs-templates.github.io/webpack/) and [docs for vue-loader](http://vuejs.github.io/vue-loader).

## Introduction

An admin of a model consists of two parts, the view and the form. The view represents the model class and has access to the collection routes. The view typically shows a list of model instances with different functionalities like sorting and scopes. The form represents model instances and has access to members of the model. On the form model instances can be edited. The view and the form have in common that they both consist of components.

## Creating A View

In order to add a new model to the admin create a new folder in dito-admin/src/schemas. The name of the folder is irrelevant however the convention is to use the hyphenated model name. Also export the new folder in the index.js file in the schemas folder like this:

```js
export * from './folder-name/index.js'
```

Within the folder create a new index.js file. Within this file the View is exported. An empty view looks like this:

```js
export const viewName = {}
```

Notice, that the name given to the view is important. Firstly, it is a default value for the label used in the view. In the example the label would be 'View Name'. Secondly it is the default route the view retrieves data from. In the example the route would be '/api/view-name'.

From there we define the view with a number of properties:

| Property | Description |
| --- | --- |
| `type` | The type of the view. For now the value is 'list'. |
| `label` | The label of the view. If no label is given, the labelized export name is used. |
| `form/forms` | The form or a dictionary of forms of the view. |
| `path` | The route of the view. If no path is given, the hyphentaed export name is used. |
| `itemLabel` | The label given to the items. Can be string giving a property name of the item or a function of the item returning a string (e.g. `(person) => person.firstName + person.lastName`). If no itemLabel is given, the default is the 'name' property of the item, followed by label of the form of the view (plus item id) and other defaults. |
| `columns` | The columns displayed in the table. The columns can be given as a list where each entry is the name of a property of the item (e.g. `['property1', 'property2'])`). However it is usually beneficial to assign an object with further options to the columns property. The options are the following:<br><ul><li>**label** The name of the column as a string. The default value is the labelized key.</li><li>**component** Use a Vue component to render the cell. The component is specified like this: `import(...)`.</li><li>**sortable** Boolean value determining if the column should be sortable.</li><li>**render** A function of the value and the item returning the displayed name. If the column is sortable, the column is sorted by value and not by rendered name.</li><li>**class** A string giving a class to the column cells.</li><li>**style** A string giving a style to the column cells.</li></ul>|
| `editable` | Boolean value determining if the items can be edited with the admin. |
| `creatable` | Boolean value determining if the items can be created with the admin. |
| `deletable` | Boolean value determining if the items can be deleted with the admin. |
| `paginate` | The number of items displayed per page. |
| `scopes` | Scope names as defined on the model. Can be given as an array (`['scope1', 'scope2']`) or as a dictionary with optional labels (`{scope1 : {label : 'Scope A'}, scope2 : {label : 'Scope B'}}`). |
| `scope` | Optional default scope name. |


## Creating A Form

The form is created in the same folder as the view. The convention for the form name is to take the model name. Again, the labelized form name is used as the default label. A form can have the following properties:

| Property | Description |
| --- | --- |
| `label` | The label of the form. |
| `tabs` | With tabs several forms can be displayed in different tabs within the form (`{tab1 : form1, tab2 : form2}`). |
| `components` | Keys within the components dictionary are the are the property name of the item which they are displaying/editing. The value is another object with options. I both tabs and components are given, the components are always visible whereas the tabs can be toggled. |


### Components

There are a large variety of components for different data types and purposes. The most important properties are these:

| Property | Description |
| --- | --- |
| `label` | The label of the component, if none is given the labelized key of the compoenent is used. |
| `type` | The type of the component, there are many different options like 'text', 'textarea', 'email', 'radio', 'select' etc. For more types see the examples below or consult the code. |
| `options` | An array of options. Only required if the type is 'select', 'radio' or a similar type. The array can also contain label-value pairs (`[{label : 'Option 1', value : 1}, {label : 'Option 2', value : 6}]`). |
| `width` | The width of the component. The value can be given in percent (e.g. '20%') or as 'auto'. There will be several components on one line until their percentage exeeds 100%. |
| `required` | Boolean value if the field is required or not. Dito uses both backend and frontend validation both required validation as well as the validation of some types (like email) are only frontend. |

Also, a component can be a nested list. For example, if you are modelling people with children, then a list of children can be shown for every person with a component like this:

``` js
children: {
  type: 'list',
  form: import('./ChildrenForm')
  inlined: true,
  creatable: true,
  editable: true,
  deletable: true
}
```

### Component Examples

A text component, as simple as it gets.

```js
firstName: {
  type: 'text',
  label: 'First Name',
  width: '40%'
}

```

Here is an example of a select component. One might just as well use type radio here. The layout can be vertical or horizontal.

```js
prefix: {
  type: 'select',
  label: 'Prefix',
  width: '10%',
  layout: 'vertical',
  options: [
    { label: 'Dr.', value: 'dr' },
    { label: 'Mr.', value: 'mr' },
    { label: 'Ms.', value: 'ms' }
  ]
}
```

This component allows selection of multiple items. It also searchable, meaning there will be suggestions as one enters a string into the input. Taggable allows adding additional options.

```js
tags: {
  type: 'multiselect',
  label: 'Tags',
  width: '50%',
  multiple: true,
  searchable: true,
  taggable: true,
  options: ['Developer', 'Designer', 'Writer', 'Composer']
}
```

This component uses an API to fetch its data. It also has a placeholder which is displayed in the input field until data is entered. The API provides JSON with an array of dictionaries. `label` retrieves the label that is diplayed to the user. `value` the value of the options. Options with the same `groupBy` value can be merged into groups.

```js
country: {
  type: 'multiselect',
  label: 'Country',
  multiple: false,
  searchable: true,
  placeholder: 'Select or search country',
  options: {
    data({ request }) {
      return request({
        cache: 'global',
        url: 'https://cdn.rawgit.com/lukes/ISO-3166-Countries-with-Regional-Codes/d4031492/all/all.json'
      })
    },
    label: 'name',
    value: 'alpha-2',
    groupBy: 'sub-region'
  }
}
```

This example validates the input with the step and the range options. There are further such options like min and max. step also gives buttons to increase/decrease the number.

```js
factor: {
  label: 'Factor',
  type: 'number',
  width: 'auto',
  step: 0.01,
  range: [0, 100],
  required: true
}
```
