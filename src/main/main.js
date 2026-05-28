// Electron 主进程入口
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { startServer } = require('../backend/src/app');

let mainWindow = null;
let backendServer = null;

// 设置数据库路径为用户数据目录（开发和生产都适用）
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'app.db');
process.env.SQLITE_DB_PATH = dbPath;


// 可选：设置资源路径标记，让后端知道现在是生产环境
process.env.RESOURCES_PATH = process.resourcesPath || '';

async function createWindow() {
    // 启动后端服务器（仅一次）
    if (!backendServer) {
        // 切换工作目录到包含 node_modules 的目录
        const appRoot = path.dirname(process.execPath);
        process.chdir(appRoot);
        backendServer = await startServer();
    }

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        icon: path.join(__dirname, '../resources/icon.png'),
    });

    // 加载前端页面（开发环境使用 Vite 开发服务器，生产环境加载打包后的文件）
    const isDev = process.env.NODE_ENV === 'development' || !process.env.RESOURCES_PATH;
  
    if (isDev) {
        await mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        await mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
    }
}

app.whenReady().then(() => {
    createWindow();
});

app.on('window-all-closed', () => {
    if (backendServer) {
        backendServer.close();
    }
    if (process.platform !== 'darwin') app.quit();
});