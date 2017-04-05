<template lang="pug">
  div
    p API path: {{ path }}
    p.loading(v-if="loading") Loading...
    component(:is="typeToComponent($meta.view.type)", :name="$meta.name", :desc="$meta.view", :data="data")
</template>

<script>
import DitoRouterComponent from '@/DitoRouterComponent'

export default DitoRouterComponent.component('dito-view', {
})
</script>
