<template lang="pug">
  component(:is="toComponentName(desc.type)", :name="name", :props="desc", :data="data")
</template>

<script>
import DitoComponent from './DitoComponent'

export default DitoComponent.extend({
  data() {
    let route = this.getRoute()
    return {
      name: route.name,
      desc: route.meta,
      data: [
        { id: 1, html: '<b>Hallo</b>' },
        { id: 2, text: '<b>Spacko</b>' }
      ]
    }
  }
})
</script>
