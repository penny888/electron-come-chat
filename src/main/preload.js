// 预加载脚本（安全暴露 API）
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // 如果需要与主进程通信，可添加方法
});