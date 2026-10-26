import {assertStagingConfiguration} from '../../scripts/assert-staging-config.mjs';
assertStagingConfiguration();
/** @type {import('next').NextConfig} */
const nextConfig={reactStrictMode:true,async headers(){return process.env.SEPTLION_DEPLOYMENT==='staging'?[{source:'/:path*',headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'}]}]:[]},distDir:process.env.SEPTLION_TEST_RUNTIME==='1'?'.next-test':'.next'}; export default nextConfig;
