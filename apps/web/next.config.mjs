/** @type {import('next').NextConfig} */
const nextConfig={reactStrictMode:true,distDir:process.env.SEPTLION_TEST_RUNTIME==='1'?'.next-test':'.next'}; export default nextConfig;
