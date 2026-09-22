// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The Cloudflare Worker in server/ai-proxy has its own node_modules (wrangler,
// workerd). It is not part of the app bundle — keep Metro from crawling it.
const nested = /[\\/]server[\\/].*[\\/]node_modules[\\/].*/;
const prev = config.resolver.blockList;
config.resolver.blockList = Array.isArray(prev) ? [...prev, nested] : prev ? [prev, nested] : [nested];

// Disable watchman to prevent watch-project hanging during builds
config.resolver.useWatchman = false;

module.exports = config;
