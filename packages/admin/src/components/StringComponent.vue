<script>
import Component from '@/Component'

export default Component.register('string', {
  hideLabel: false
})
</script>

<template lang="pug">
input(:id="name", type="string")
</template>
