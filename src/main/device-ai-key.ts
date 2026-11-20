import { safeStorage } from 'electron';
import Store from 'electron-store';

interface KeyData {
  version: number;
  encrypted: string | null;
}

/** 将设备 AI Key 与普通设置、备份和同步数据隔离。 */
export class DeviceAIKey {
  private store = new Store<KeyData>({
    name: 'pinote-device-ai',
    defaults: { version: 1, encrypted: null },
  });

  getKey(): string | null {
    const encrypted = this.store.get('encrypted');
    if (!encrypted) return null;
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('系统安全存储不可用，无法读取设备 AI Key');
    }
    try {
      return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
    } catch {
      throw new Error('设备 AI Key 无法解密，请移除后重新填写');
    }
  }

  saveKey(value: string): void {
    const key = value.trim();
    if (!key || key.length > 512) throw new Error('请输入有效的 API Key');
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('系统安全存储不可用，无法保存设备 AI Key');
    }
    this.store.set('encrypted', safeStorage.encryptString(key).toString('base64'));
  }

  deleteKey(): void {
    this.store.set('encrypted', null);
  }
}
