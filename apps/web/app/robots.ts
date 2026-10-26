import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  if(process.env.SEPTLION_DEPLOYMENT==='staging')return{rules:{userAgent:'*',disallow:'/'}};
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/dashboard/', '/quotes/'] },
    sitemap: 'https://www.septlion.com/sitemap.xml',
    host: 'https://www.septlion.com',
  };
}
