import React from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: string | number;
  height?: string | number;
  className?: string;
  loading?: 'lazy' | 'eager';
  onClick?: () => void;
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  className,
  loading = 'lazy',
  onClick
}) => {
  // Function to generate WebP version of an image URL
  const getWebPUrl = (url: string): string => {
    // For S3 URLs, we could use a CloudFront function or Lambda@Edge to serve WebP
    // For this example, we'll assume we have WebP versions available with same name but .webp extension
    if (url.includes('wellcall-app-cdk.s3.amazonaws.com')) {
      // This is a simple example - in a real app, you might use a more robust URL transformation
      const urlWithoutExtension = url.substring(0, url.lastIndexOf('.'));
      return `${urlWithoutExtension}.webp`;
    }
    return url;
  };

  const webpSrc = getWebPUrl(src);
  const style = {
    width: width,
    height: height
  };

  return (
    <picture>
      <source srcSet={webpSrc} type="image/webp" />
      <img 
        src={src} 
        alt={alt} 
        className={className} 
        style={style} 
        loading={loading}
        onClick={onClick}
      />
    </picture>
  );
};

export default OptimizedImage;
