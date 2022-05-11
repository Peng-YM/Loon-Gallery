<template>
  <v-app>
    <v-app-bar
      app
      color="primary"
      dark
    >
      <div class="d-flex align-center">
        <v-img
          alt="Loon Gallery"
          class="shrink mr-2"
          contain
          src="https://avatars.githubusercontent.com/u/38467044?v=4"
          transition="scale-transition"
          width="40"
        />
      </div>

      <span>Loon 插件仓库</span>

      <v-spacer></v-spacer>

      <v-btn
        href="https://github.com/Peng-YM/Loon-Gallery"
        target="_blank"
        text
      >
        <span class="mr-2">🌟 STAR</span>
        <v-icon>fa-github</v-icon>
      </v-btn>
    </v-app-bar>

    <v-main>
      <Gallery/>
    </v-main>
  </v-app>
</template>

<script>
import Gallery from './components/Gallery';

export default {
  name: 'App',

  components: {
    Gallery,
  },

  data: () => ({
    //
  }),
};
</script>
