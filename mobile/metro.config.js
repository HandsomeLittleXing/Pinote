// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
// 桌面端共享类型定义所在目录，挂载为 watchFolder 以便 Metro 能解析到仓库根目录之外的文件
const sharedRoot = path.resolve(projectRoot, '../src/shared');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [sharedRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];

module.exports = config;
