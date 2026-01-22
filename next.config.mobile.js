const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  // Disable API routes for static export
  // The mobile app will call the production API directly
};

module.exports = nextConfig;
