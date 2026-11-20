// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
// 桌面端共享类型定义所在目录，挂载为 watchFolder 以便 Metro 能解析到仓库根目录之外的文件
const sharedRoot = path.resolve(projectRoot, '../src/shared');
const fontRoot = path.resolve(projectRoot, '../resources/fonts');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [sharedRoot, fontRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.assetExts = [...config.resolver.assetExts, 'txt', 'TXT'];

module.exports = config;
