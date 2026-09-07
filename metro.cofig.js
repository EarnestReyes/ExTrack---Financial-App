const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.unshift("rn.js");

// Required for expo-sqlite on web to load the wa-sqlite WebAssembly binary
config.resolver.assetExts.push("wasm");

module.exports = config;
