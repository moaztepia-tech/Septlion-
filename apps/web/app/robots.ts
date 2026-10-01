import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/dashboard/', '/quotes/'] },
    sitemap: 'https://www.septlion.com/sitemap.xml',
    host: 'https://www.septlion.com',
  };
}
