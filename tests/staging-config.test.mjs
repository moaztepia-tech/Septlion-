import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertStagingConfiguration} from '../scripts/assert-staging-config.mjs';
test('staging rejects production backend, missing keys and frontend server secrets',()=>{
 const env={SEPTLION_DEPLOYMENT:'staging',NEXT_PUBLIC_SUPABASE_URL:'https://staging.fixture.invalid',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'};
 assert.doesNotThrow(()=>assertStagingConfiguration(env));
 for(const changes of [{NEXT_PUBLIC_SUPABASE_URL:'https://jfbmxowdmfdzyoauqgwn.supabase.co'},{NEXT_PUBLIC_SUPABASE_URL:'http://staging.fixture.invalid'},{NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:''},{NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_secret_fixture'},{NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'header.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.signature'}])assert.throws(()=>assertStagingConfiguration({...env,...changes}));
});
