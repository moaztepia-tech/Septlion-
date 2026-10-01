import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const base = 'https://www.septlion.com';

  return [
    { url: base, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/demand-intelligence/`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/intent/wheat-flour/`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/maritime-rfq/`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/rfq/`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
  ];
}
