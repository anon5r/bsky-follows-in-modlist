import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const origin = `${protocol}://${host}`;

  // client_id must be the URL of this metadata file
  const metadataUrl = `${origin}/api/client-metadata`;

  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    client_id: metadataUrl,
    client_name: 'Follows in List',
    client_uri: origin,
    redirect_uris: [`${origin}/`],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    scope: 'atproto transition:generic',
    token_endpoint_auth_method: 'none',
    dpop_bound_access_tokens: true,
  });
}
