// Convert configured durations to seconds before passing them to jsonwebtoken.
// This keeps environment strings out of the signing API's duration union.
export function accessTokenTtl(value = '15m'): number {
 const match = value.trim().match(/^(\d+)(s|m|h|d)?$/);
 if (!match) throw new Error('Invalid ACCESS_TOKEN_TTL');
 const seconds = Number(match[1]) * ({s:1,m:60,h:3600,d:86400}[match[2] || 's'] || 1);
 if (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > 86400) throw new Error('ACCESS_TOKEN_TTL must be between 1 second and 1 day');
 return seconds;
}
