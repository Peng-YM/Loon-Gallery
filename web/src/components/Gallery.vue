<template>
  <v-container fluid>
    <v-text-field label="搜索" v-model="search"></v-text-field>
    <v-expansion-panels>
      <v-expansion-panel v-for="repoId in Object.keys(repos)
        .sort((a, b) => repos[a].user.localeCompare(repos[b].user))
        .filter(repoId => filteredPlugins[repoId].length > 0)" :key="repoId">
        <v-expansion-panel-header>
          <v-row align="center" justify="start" no-gutters>
            <v-col>
              <v-avatar
                  size="35px"
                  class="elevation-3"
              >
                <img
                    alt="Avatar"
                    :src="repos[repoId].avatar_url"
                >
              </v-avatar>
            </v-col>
            <v-col>
              <v-btn
                  :href="repos[repoId].repo_url"
                  target="_blank"
                  small
                  text
              >
                <span>{{limitString(repos[repoId].user + "/" + repos[repoId].repo, 20)}}</span>
              </v-btn>
            </v-col>
            <v-spacer/>
          </v-row>
        </v-expansion-panel-header>
        <v-expansion-panel-content>
          <v-list dense nav class="ma-n4">
            <v-list-item v-for="(plugin, idx) in filteredPlugins[repoId]" :key="idx" @click="open(plugin.url)">
              <v-list-item-avatar size="35px" rounded>
                <v-icon v-if="plugin.icon === undefined">fa-question</v-icon>
                <v-img :src="plugin.icon" v-else/>
              </v-list-item-avatar>
              <v-list-item-content>
                <v-list-item-title v-text="plugin.name"/>
                <v-list-item-subtitle v-text="plugin.description"/>
                <v-list-item-subtitle>
                  <a :href="plugin.homepage">{{plugin.homepage}}</a>
                </v-list-item-subtitle>
              </v-list-item-content>
              <v-list-item-action>
                <v-row dense no-gutters>
                  <v-col>
                    <v-btn icon @click="install(plugin.url)">
                      <v-icon>mdi-download</v-icon>
                    </v-btn>
                  </v-col>

                  <v-col v-if="false">
                    <v-menu bottom left>
                      <template #activator="{ on }">
                        <v-btn icon v-on="on">
                          <v-icon>mdi-dots-vertical</v-icon>
                        </v-btn>
                      </template>
                    </v-menu>
                  </v-col>
                </v-row>
              </v-list-item-action>
            </v-list-item>
          </v-list>
        </v-expansion-panel-content>
      </v-expansion-panel>
    </v-expansion-panels>
  </v-container>
</template>

<script>
import axios from "axios";

export default {
  name: "GalleryComponent",
  created() {
    const PLUGINS_DATA_URL = "https://raw.githubusercontent.com/Peng-YM/Loon-Gallery/master/data/plugins.json";
    const SOURCES_DATA_URL = "https://raw.githubusercontent.com/Peng-YM/Loon-Gallery/master/data/repos.json";

    axios.get(PLUGINS_DATA_URL).then(resp => {
      const {data} = resp;
      // sort according to plugin names
      for (const id of Object.keys(data)) {
        data[id] = data[id].sort((a, b) => a.name.localeCompare(b.name));
      }
      this.plugins = data;
    }).catch(console.error);

    axios.get(SOURCES_DATA_URL).then(resp => {
      const {data} = resp;
      this.repos = data;
    }).catch(console.error);
  },

  data: function () {
    return {
      search: '',
      repos: {},
      plugins: {}
    }
  },

  computed: {
    filteredPlugins() {
      let result = {};
      for (let repoId in this.plugins) {
        result[repoId] = this.plugins[repoId].filter(plugin =>
          plugin.name.toLowerCase().includes(this.search.toLowerCase())
        );
      }
      return result;
    },
  },
  methods: {
    install(url) {
      window.location.href = `loon://import?plugin=${encodeURIComponent(url)}`;
    },

    open(url) {
      window.location.href = url;
    },

    limitString(str, sz) {
      return str.slice(0, sz) + (str.length > sz ? "..." : "");
    }
  }
}
</script>
