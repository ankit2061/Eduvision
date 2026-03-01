/**
 * Auth0 configuration.
 *
 * For SPAs: we do NOT pass `audience` in the initial login authorize request.
 * Instead, getAccessTokenSilently() requests the audience on-demand per API call.
 * This avoids the "Client not authorized to access resource server" error
 * that appears when the M2M authorization hasn't been set on the API.
 */

const domain = import.meta.env.VITE_AUTH0_DOMAIN as string;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID as string;
const redirectTo = import.meta.env.VITE_AUTH0_REDIRECT_URI || window.location.origin;

export const auth0Config = {
  domain,
  clientId,
  authorizationParams: {
    redirect_uri: redirectTo,
    audience: import.meta.env.VITE_AUTH0_AUDIENCE as string,
    scope: "openid profile email offline_access",
  },
  logoutParams: {
    returnTo: window.location.origin,
  },
};

/** The audience sent only when fetching API access tokens */
export const API_AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE as string;

/** Custom claim namespace for user role (set in Auth0 post-login Action) */
export const ROLE_CLAIM = "https://eduvision/role";

if (import.meta.env.DEV) {
  console.info("[Auth0 Config]", { domain, clientId, redirect_uri: redirectTo, API_AUDIENCE });
}
