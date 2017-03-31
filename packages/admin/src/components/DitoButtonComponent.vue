<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.register('button', {
})
</script>

<template lang="pug">
button(:id="name", :type="desc.type") {{ desc.text }}
</template>
