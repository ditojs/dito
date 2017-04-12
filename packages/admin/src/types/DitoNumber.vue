<template lang="pug">
  input(:id="name", type="number", v-model="data[name]", :disabled="disabled", :step="step", :min="min", :max="max", :readonly="readonly", :placeholder="placeholder")
</template>

<script>
import TypeComponent from '@/TypeComponent'

export default TypeComponent.register('number')
</script>
