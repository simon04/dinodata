import { createGlobalState } from "@vueuse/core";
import { UserManager, type User } from "oidc-client-ts";
import { computed, shallowRef } from "vue";
import { OSM_URL } from "./osm/config";

/**
 * Login with OAuth 2.0 (authorization code with PKCE, public client), via a
 * popup so that pending edits are kept: Wikimedia for Wikidata edits,
 * OpenStreetMap for tag edits. Both use the same callback page.
 * https://www.mediawiki.org/wiki/OAuth/For_Developers
 * https://wiki.openstreetmap.org/wiki/OAuth
 */

const {
  VITE_OAUTH_CLIENT_ID: clientId,
  VITE_OAUTH_REDIRECT_URI: redirectUri,
  VITE_OSM_OAUTH_CLIENT_ID: osmClientId,
} = import.meta.env;

/** Profile from the OAuth "profile" resource (no OpenID Connect ID token). */
export interface Profile {
  sub: string;
  username?: string;
  /** OpenStreetMap (OpenID Connect) */
  preferred_username?: string;
}

/** Only where the registered callback is served, e.g. not on GitHub Pages. */
const callbackServed =
  !!redirectUri && new URL(redirectUri).origin === location.origin;
export const loginAvailable = !!clientId && callbackServed;
export const osmLoginAvailable = !!osmClientId && callbackServed;

const WIKIMEDIA = "https://www.wikidata.org/w/rest.php/oauth2";

interface Provider {
  authority: string;
  available: boolean;
  create(): UserManager;
  /** access tokens expire and are renewed with the refresh token */
  renew: boolean;
}

const providers: Record<"wikimedia" | "osm", Provider> = {
  wikimedia: {
    authority: WIKIMEDIA,
    available: loginAvailable,
    renew: true,
    create: () =>
      new UserManager({
        authority: WIKIMEDIA,
        // no OIDC discovery: endpoints of the MediaWiki OAuth extension
        metadata: {
          issuer: WIKIMEDIA,
          authorization_endpoint: `${WIKIMEDIA}/authorize`,
          token_endpoint: `${WIKIMEDIA}/access_token`,
          userinfo_endpoint: `${WIKIMEDIA}/resource/profile`,
        },
        client_id: clientId,
        redirect_uri: redirectUri,
        popup_redirect_uri: redirectUri,
        // grants of the consumer; without "openid", no ID token is expected
        scope: "basic editpage createeditmovepage",
        // username from the profile resource
        loadUserInfo: true,
        // access tokens expire after an hour, renewed with the refresh token
        automaticSilentRenew: true,
      }),
  },
  osm: {
    authority: OSM_URL,
    available: osmLoginAvailable,
    // OSM access tokens do not expire
    renew: false,
    create: () =>
      new UserManager({
        authority: OSM_URL,
        metadata: {
          issuer: OSM_URL,
          authorization_endpoint: `${OSM_URL}/oauth2/authorize`,
          token_endpoint: `${OSM_URL}/oauth2/token`,
          userinfo_endpoint: `${OSM_URL}/oauth2/userinfo`,
          jwks_uri: `${OSM_URL}/oauth2/discovery/keys`,
        },
        client_id: osmClientId ?? "",
        redirect_uri: redirectUri,
        popup_redirect_uri: redirectUri,
        scope: "openid read_prefs write_api",
        loadUserInfo: true,
        automaticSilentRenew: false,
      }),
  },
};

const managers: Partial<Record<keyof typeof providers, UserManager>> = {};
function userManager(provider: keyof typeof providers): UserManager {
  return (managers[provider] ??= providers[provider].create());
}

/** Provider of a pending login, from the state stored by oidc-client-ts. */
function callbackProvider(url: URL): keyof typeof providers {
  try {
    const state = url.searchParams.get("state");
    const stored = state && localStorage.getItem(`oidc.${state}`);
    const authority = stored && JSON.parse(stored).authority;
    if (authority === providers.osm.authority) return "osm";
  } catch {
    // unreadable state: the default provider reports the error
  }
  return "wikimedia";
}

/** Handle the OAuth callback (popup or redirect); true if this is the callback page. */
export async function handleCallback(): Promise<boolean> {
  if (
    !callbackServed ||
    (!loginAvailable && !osmLoginAvailable) ||
    location.href.split("?")[0] !== redirectUri
  )
    return false;
  const provider = callbackProvider(new URL(location.href));
  const user = await userManager(provider).signinCallback();
  // redirect flow (popup blocked): back to the page shown before
  if (!window.opener)
    location.replace(
      new URL(`./${(user?.state as string) ?? ""}`, location.href),
    );
  return true;
}

function createAuth(provider: keyof typeof providers) {
  const { available, renew } = providers[provider];
  const user = shallowRef<User | null>(null);
  if (available) {
    const m = userManager(provider);
    m.getUser()
      .then(async (u) => {
        // expired since the last visit: renew with the refresh token
        if (renew && u?.expired && u.refresh_token)
          u = await m.signinSilent().catch(() => null);
        user.value = u && !u.expired ? u : null;
      })
      .catch(console.warn);
    m.events.addUserLoaded((u) => {
      user.value = u;
    });
    m.events.addUserUnloaded(() => {
      user.value = null;
    });
    m.events.addSilentRenewError(() => {
      user.value = null;
    });
  }
  const profile = computed(() => user.value?.profile as Profile | undefined);

  async function login() {
    try {
      await userManager(provider).signinPopup();
    } catch (e) {
      // popup blocked: full-page redirect, pending edits are kept in
      // sessionStorage (OSM) or lost (Wikidata)
      if (String(e).includes("Popup"))
        await userManager(provider).signinRedirect({ state: location.hash });
      else throw e;
    }
  }

  async function logout() {
    await userManager(provider).removeUser();
  }

  return {
    available,
    user,
    /** username of the logged-in user */
    username: computed(
      () => profile.value?.username ?? profile.value?.preferred_username,
    ),
    /** current access token, for `Authorization: Bearer` */
    accessToken: computed(() => user.value?.access_token),
    login,
    logout,
  };
}

/** Wikimedia account, for Wikidata edits. */
export const useAuth = createGlobalState(() => createAuth("wikimedia"));

/** OpenStreetMap account, for tag edits. */
export const useOsmAuth = createGlobalState(() => createAuth("osm"));
