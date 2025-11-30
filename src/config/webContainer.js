import { WebContainer } from '@webcontainer/api';

let webContainerInstance = null;

export const getWebContainer = async () => {
  if (import.meta.env.PROD) {
    console.warn("WebContainer is disabled in production");
    return null;
  }

  if (webContainerInstance === null) {
    webContainerInstance = await WebContainer.boot();
  }
  return webContainerInstance;
};
