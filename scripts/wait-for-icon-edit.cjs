const { setTimeout } = require('node:timers/promises');

exports.default = async ({ electronPlatformName }) => {
  // Windows can briefly hold the copied exe, causing rcedit to fail before NSIS runs.
  if (electronPlatformName === 'win32') await setTimeout(5000);
};
