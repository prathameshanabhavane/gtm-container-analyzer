import { Helmet } from 'react-helmet-async';

/**
 * SEO Component for dynamic meta tags per route
 * Uses react-helmet-async for SSR compatibility
 */
const SEO = ({ 
  title,
  description,
  keywords,
  canonical,
  ogImage = 'https://gtmcontaineranalyzer.com/og-image.png',
  ogType = 'website',
  noindex = false
}) => {
  const siteUrl = 'https://gtmcontaineranalyzer.com';
  const fullTitle = title.includes('GTM') ? title : `${title} | GTM Container Analyzer`;
  const canonicalUrl = canonical ? `${siteUrl}${canonical}` : siteUrl;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      
      {/* Canonical */}
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Robots */}
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonicalUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  );
};

export default SEO;

