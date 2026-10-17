<template>
  <span v-if="available" class="dd-user">
    <template v-if="username">
      <a :href="profileUrl" target="_blank" rel="external noopener">
        <cdx-icon :icon="cdxIconUserAvatar" size="small" />
        {{ username }}
      </a>
      <cdx-button
        weight="quiet"
        :aria-label="t('logout')"
        v-tooltip="t('logout')"
        @click="logout"
      >
        <cdx-icon :icon="cdxIconLogOut" />
      </cdx-button>
    </template>
    <cdx-button v-else weight="quiet" @click="onLogin">
      <cdx-icon :icon="cdxIconLogIn" />
      {{ t("login") }}
    </cdx-button>
  </span>
</template>

<script setup lang="ts">
import { t } from "../i18n";
import { computed } from "vue";
import { CdxButton, CdxIcon, useToast } from "@wikimedia/codex";
import {
  cdxIconLogIn,
  cdxIconLogOut,
  cdxIconUserAvatar,
} from "@wikimedia/codex-icons";
import { useAuth, useOsmAuth } from "../auth";
import { OSM_URL } from "../osm/config";

/** Login of the current mode: Wikimedia account, or OpenStreetMap account. */
const props = withDefaults(defineProps<{ mode?: "wikidata" | "osm" }>(), {
  mode: "wikidata",
});

const wikimedia = useAuth();
const osm = useOsmAuth();
const auth = computed(() => (props.mode === "osm" ? osm : wikimedia));
const available = computed(() => auth.value.available);
const username = computed(() => auth.value.username.value);
const profileUrl = computed(() =>
  props.mode === "osm"
    ? `${OSM_URL}/user/${encodeURIComponent(username.value ?? "")}`
    : `https://www.wikidata.org/wiki/User:${encodeURIComponent(username.value ?? "")}`,
);
const toast = useToast();

function logout() {
  return auth.value.logout();
}

async function onLogin() {
  try {
    await auth.value.login();
  } catch (e) {
    // closing the popup is not an error worth reporting
    if (!String(e).includes("closed"))
      toast.error(t("login-failed", String(e)));
  }
}
</script>

<style scoped>
.dd-user {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  white-space: nowrap;
}
.dd-user a {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}
</style>
