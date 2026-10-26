// Server-only usage: never decode a JWT or trust browser-supplied roles.
export const COMMAND_COOKIE = 'septlion_command_access';
export async function commandIdentity(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !token) return null;
  try {
    const response = await fetch(`${url}/functions/v1/trade-api`, {
      method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(10000),
      headers: {'Content-Type':'application/json', apikey:key, Authorization:`Bearer ${token}`},
      body: JSON.stringify({action:'me'}),
    });
    if (!response.ok) return null;
    const identity = await response.json();
    return identity.isOperator === true && ['ADMIN','SALES'].includes(identity.operatorRole)
      ? {role: identity.operatorRole as 'ADMIN'|'SALES'} : null;
  } catch { return null; }
}
