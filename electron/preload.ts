const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onMenuAction: (callback: (action: string) => void) => {
    ipcRenderer.on('menu-new-connection', () => callback('new-connection'));
  },
  
  platform: process.platform,
  
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  },
  
  // Dependency management
  checkDependencies: () => ipcRenderer.invoke('check-dependencies'),
  
  installDependencies: (onProgress: (progress: any) => void) => {
    // Set up progress listener
    ipcRenderer.on('install-progress', (event, progress) => {
      onProgress(progress);
    });
    
    return ipcRenderer.invoke('install-dependencies');
  },
  
  configureNgrok: (authtoken: string) => ipcRenderer.invoke('configure-ngrok', authtoken),
  
  getNgrokConfig: () => ipcRenderer.invoke('get-ngrok-config')
});