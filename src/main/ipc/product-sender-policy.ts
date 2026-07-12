import { isTrustedSenderUrl } from '../security';
import type { IpcSenderIdentity } from './typed-router';

export type ProductSenderPolicy = {
  readonly bindWebContents: (webContentsId: number) => void;
  readonly unbindWebContents: (webContentsId: number) => void;
  readonly isTrustedSender: (sender: IpcSenderIdentity) => boolean;
};

export function createProductSenderPolicy(devServerUrl?: string): ProductSenderPolicy {
  const trustedDevOrigins = devServerUrl
    ? new Set([new URL(devServerUrl).origin])
    : new Set<string>();
  let boundWebContentsId: number | null = null;

  return {
    bindWebContents(webContentsId) {
      boundWebContentsId = webContentsId;
    },
    unbindWebContents(webContentsId) {
      if (boundWebContentsId === webContentsId) {
        boundWebContentsId = null;
      }
    },
    isTrustedSender(sender) {
      return (
        boundWebContentsId !== null &&
        sender.webContentsId === boundWebContentsId &&
        sender.isMainFrame &&
        isTrustedSenderUrl(sender.url, trustedDevOrigins)
      );
    },
  };
}
