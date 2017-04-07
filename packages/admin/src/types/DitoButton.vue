<template lang="pug">
  button(:id="name", :type="desc.type") {{ desc.text }}
</template>

<script>
import BaseComponent from '@/BaseComponent'

export default BaseComponent.type('button')
</script>
