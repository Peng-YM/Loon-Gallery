<template>
  <v-app>
    <v-main>
      <PluginGallery/>
    </v-main>
  </v-app>
</template>

<script>
import PluginGallery from './components/PluginGallery.vue';

export default {
  name: 'App',

  components: {
    PluginGallery,
  },

  data: () => ({
    //
  }),
}
</script>
