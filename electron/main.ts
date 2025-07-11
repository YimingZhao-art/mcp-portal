const { app, BrowserWindow, shell, Menu, Tray, nativeImage, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const WindowStateManager = require('./windowStateManager.cjs');
const DependencyManager = require('./dependencyManager.cjs');

let mainWindow = null;
let serverProcess = null;
let tray = null;

const { PORTS } = require('../shared/config.cjs');
const SERVER_PORT = PORTS.PROXY_SERVER;
const CLIENT_PORT = PORTS.CLIENT_DEV;
const isDev = process.env.NODE_ENV === 'development';

const windowStateManager = new WindowStateManager();
const dependencyManager = new DependencyManager();

function createWindow() {
  const windowState = windowStateManager.load();
  
  mainWindow = new BrowserWindow({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    icon: path.join(__dirname, '../../assets/icon.png'),
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform !== 'darwin'
  });

  mainWindow.once('ready-to-show', () => {
    if (windowState.isMaximized) {
      mainWindow.maximize();
    }
    mainWindow?.show();
  });

  // 保存窗口状态
  const saveWindowState = () => {
    if (!mainWindow) return;
    
    const isMaximized = mainWindow.isMaximized();
    const bounds = isMaximized ? windowStateManager.load() : mainWindow.getBounds();
    
    windowStateManager.save({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized
    });
  };

  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);
  mainWindow.on('maximize', saveWindowState);
  mainWindow.on('unmaximize', saveWindowState);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL(`http://localhost:${CLIENT_PORT}`);
    mainWindow.webContents.openDevTools();
  } else {
    const clientPath = path.join(__dirname, '../../client/dist/index.html');
    mainWindow.loadFile(clientPath);
  }
}

function startServer() {
  const configPath = path.join(os.homedir(), '.mcp-inspector', 'config.json');
  
  const env = {
    ...process.env,
    PORT: SERVER_PORT.toString(),
    NODE_ENV: process.env.NODE_ENV || 'production',
    CONFIG_PATH: configPath
  };

  if (isDev) {
    // In dev mode, run from the project root
    const rootPath = path.join(__dirname, '../..');
    serverProcess = spawn('npm', ['run', 'dev', '--workspace=server'], {
      cwd: rootPath,
      env,
      shell: true,
      stdio: 'inherit'
    });
  } else {
    const serverPath = path.join(__dirname, '../../server/dist/index.js');
    serverProcess = spawn('node', [serverPath], {
      env,
      stdio: 'inherit'
    });
  }

  serverProcess.on('error', (err) => {
    console.error('Failed to start server:', err);
  });

  serverProcess.on('exit', (code) => {
    console.log(`Server process exited with code ${code}`);
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '../../assets/tray-icon.png');
  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show MCP Portal',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setToolTip('MCP Portal');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Connection',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow?.webContents.send('menu-new-connection');
          }
        },
        {
          type: 'separator'
        },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Learn More',
          click: () => {
            shell.openExternal('https://github.com/modelcontextprotocol/mcp-inspector');
          }
        }
      ]
    }
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC handlers for dependency management
ipcMain.handle('check-dependencies', async () => {
  try {
    return await dependencyManager.checkDependencies();
  } catch (error) {
    console.error('Error checking dependencies:', error);
    throw error;
  }
});

ipcMain.handle('install-dependencies', async (event) => {
  try {
    await dependencyManager.installDependencies((progress) => {
      event.sender.send('install-progress', progress);
    });
    return { success: true };
  } catch (error) {
    console.error('Error installing dependencies:', error);
    throw error;
  }
});

ipcMain.handle('configure-ngrok', async (event, authtoken) => {
  try {
    await dependencyManager.configureNgrok(authtoken);
    return { success: true };
  } catch (error) {
    console.error('Error configuring ngrok:', error);
    throw error;
  }
});

ipcMain.handle('get-ngrok-config', async () => {
  try {
    return await dependencyManager.getNgrokConfig();
  } catch (error) {
    console.error('Error getting ngrok config:', error);
    throw error;
  }
});

app.whenReady().then(async () => {
  startServer();
  createWindow();
  createMenu();
  createTray();

  // Check dependencies on startup
  try {
    const status = await dependencyManager.checkDependencies();
    console.log('Dependency status:', status);
    
    // Send status to renderer when window is ready
    if (mainWindow) {
      mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.webContents.send('dependency-status', status);
      });
    }
  } catch (error) {
    console.error('Error checking dependencies on startup:', error);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});

process.on('SIGINT', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  app.quit();
});