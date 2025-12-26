import { BrowserOAuthClient } from '@atproto/oauth-client-browser'

// Determine environment
const isLocalhost = 
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1'

// Configuration for local development
// client_id: MUST be http://localhost (not IP) to bypass HTTPS check in some versions, or strictly matched.
// redirect_uris: MUST be http://127.0.0.1 (Loopback IP) for RFC compliance in browser.
// Note: You must access the app via http://127.0.0.1:5173/ in your browser.

let clientId: string
let redirectUri: string
let clientUri: string

if (isLocalhost) {
  // Hardcoded for default Vite port
  const port = window.location.port || '5173'
  clientId = `http://localhost:${port}/client-metadata.json`
  clientUri = `http://localhost:${port}`
  redirectUri = `http://127.0.0.1:${port}/`
} else {
  // Production (Vercel)
  const origin = window.location.origin
  clientId = `${origin}/api/client-metadata`
  clientUri = origin
  redirectUri = `${origin}/`
}

export const client = new BrowserOAuthClient({
  handleResolver: 'https://bsky.social',
  clientMetadata: {
    client_id: clientId,
    client_name: 'Save Your Follows',
    client_uri: clientUri,
    redirect_uris: [redirectUri],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    scope: 'atproto transition:generic',
    token_endpoint_auth_method: 'none',
    dpop_bound_access_tokens: true,
  },
})

export async function initOAuth() {
  try {
    const result = await client.init()
    if (result) {
      const { session } = result
      return session
    }
  } catch (err) {
    console.error('OAuth initialization failed:', err)
  }
  return null
}
