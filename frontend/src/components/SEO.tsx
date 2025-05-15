import React from 'react';
import { Helmet } from 'react-helmet';

interface SEOProps {
  title: string;
  description: string;
  imageUrl?: string;
  schema?: object;
  pathname?: string;
}

const SEO: React.FC<SEOProps> = ({
  title,
  description,
  imageUrl = 'https://wellcall-app-cdk.s3.amazonaws.com/sugar-society/photos/sugar-society-sugar-cookies.png',
  schema,
  pathname = '',
}) => {
  const url = `https://sugarsocietysc.com${pathname}`;
  
  // Default local business schema
  const defaultSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "Sugar Society Sugar Cookies",
    "image": imageUrl,
    "description": description,
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Rosharon",
      "addressRegion": "TX",
      "addressCountry": "US"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": "29.3505",
      "longitude": "-95.4591"
    },
    "url": url,
    "telephone": "+12543133972",
    "priceRange": "$$",
    "servesCuisine": "Cookies, Baked Goods"
  };

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={imageUrl} />
      
      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={url} />
      <meta property="twitter:title" content={title} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={imageUrl} />
      
      {/* Schema.org markup */}
      <script type="application/ld+json">
        {JSON.stringify(schema || defaultSchema)}
      </script>
    </Helmet>
  );
};

export default SEO;
