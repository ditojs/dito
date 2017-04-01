<template lang="pug">
  component(:is="toComponentName(desc.type)", :name="name", :props="desc")
</template>

<script>
import DitoComponent from './DitoComponent'

export default DitoComponent.extend({
  data() {
    let route = this.getRoute()
    return {
      name: route.name,
      desc: route.meta
    }
  }
})
</script>
