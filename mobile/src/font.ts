import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';

/** 与字体内部 family 名称保持一致，供原生文字和 WebView 共用。 */
export const APP_FONT_FAMILY = 'Liansheng Lingguangti';

const FONT_ASSET = require('../../resources/fonts/LianshengLingguangti-2.2.11-Variable.ttf');
let editorFontCss: Promise<string> | null = null;
let fontLicenseText: Promise<string> | null = null;

/** 编辑器运行在独立 WebView 中，使用内嵌字体避免依赖外部地址和文件访问权限。 */
export function loadEditorFontCss(): Promise<string> {
  if (!editorFontCss) {
    editorFontCss = (async () => {
      const asset = await Asset.fromModule(FONT_ASSET).downloadAsync();
      if (!asset.localUri) throw new Error('字体资源不可用');
      const encoded = await FileSystem.readAsStringAsync(asset.localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return `@font-face{font-family:'${APP_FONT_FAMILY}';src:url(data:font/ttf;base64,${encoded}) format('truetype');font-style:normal;font-weight:400 650;}`;
    })();
  }
  return editorFontCss.catch((error) => {
    editorFontCss = null;
    throw error;
  });
}

/** 授权原文作为本地资源随手机应用打包，设置页可离线查看。 */
export function loadFontLicenseText(): Promise<string> {
  if (!fontLicenseText) {
    fontLicenseText = (async () => {
      const files = [
        ['字体说明', require('../../resources/fonts/README.txt')],
        ['Arphic Public License', require('../../resources/fonts/ARPHICPL.TXT')],
        ['上游声明', require('../../resources/fonts/UPSTREAM-COPYING.txt')],
        ['上游 LGPL 条款', require('../../resources/fonts/MAKEMEHANZI-LGPL.txt')],
      ] as const;
      const sections = await Promise.all(files.map(async ([title, moduleId]) => {
        const asset = await Asset.fromModule(moduleId).downloadAsync();
        if (!asset.localUri) throw new Error('字体授权文件不可用');
        const content = await FileSystem.readAsStringAsync(asset.localUri);
        return `${title}\n\n${content}`;
      }));
      return sections.join('\n\n────────────────────\n\n');
    })();
  }
  return fontLicenseText.catch((error) => {
    fontLicenseText = null;
    throw error;
  });
}
