module.exports = {
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      crypto: require.resolve('crypto-browserify'),
      util: require.resolve('util/'),
      stream: require.resolve('stream-browserify'),
    };
    return config;
  },
};
