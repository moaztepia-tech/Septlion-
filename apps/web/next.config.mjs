import {assertStagingConfiguration} from '../../scripts/assert-staging-config.mjs';
assertStagingConfiguration();
/** @type {import('next').NextConfig} */
// A fixed build id keeps unchanged pages byte-identical between builds, so a release
// uploads only the files that really changed (see scripts/hostinger-release.py).
const nextConfig={reactStrictMode:true,generateBuildId:async()=>'septlion',async headers(){return process.env.SEPTLION_DEPLOYMENT==='staging'?[{source:'/:path*',headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'}]}]:[]},distDir:process.env.SEPTLION_TEST_RUNTIME==='1'?'.next-test':'.next'}; export default nextConfig;
