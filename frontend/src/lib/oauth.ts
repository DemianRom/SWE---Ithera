// Proveedores de inicio de sesión social habilitados en Supabase Auth.
// Se definen con VITE_OAUTH_PROVIDERS (p. ej. "google" o "google,facebook");
// si está vacía, la app solo ofrece correo y contraseña.
export type OAuthProvider = 'google' | 'facebook'

const enabledProviders = String(import.meta.env.VITE_OAUTH_PROVIDERS ?? '')
  .split(',')
  .map((provider) => provider.trim().toLowerCase())
  .filter((provider): provider is OAuthProvider => provider === 'google' || provider === 'facebook')

export const isOAuthProviderEnabled = (provider: OAuthProvider): boolean =>
  enabledProviders.includes(provider)

export const oauthProviderCount = new Set(enabledProviders).size
