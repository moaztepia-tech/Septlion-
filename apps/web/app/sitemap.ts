import {MetadataRoute} from 'next';

export default function sitemap():MetadataRoute.Sitemap{
 const now=new Date();
 return [
  {url:'https://septlion.com',lastModified:now,changeFrequency:'weekly',priority:1},
  {url:'https://septlion.com/demand-intelligence/',lastModified:now,changeFrequency:'daily',priority:.9},
  {url:'https://septlion.com/demand/',lastModified:now,changeFrequency:'daily',priority:.9},
  {url:'https://septlion.com/intent/wheat-flour/',lastModified:now,changeFrequency:'weekly',priority:.8},
 ];
}
