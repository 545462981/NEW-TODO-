const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('todoAPI', {
  loadTasks: () => ipcRenderer.invoke('load-tasks'),
  saveTasks: (tasks) => ipcRenderer.invoke('save-tasks', tasks),
  saveImage: (taskId, base64Data) => ipcRenderer.invoke('save-image', taskId, base64Data),
  deleteImage: (taskId, filename) => ipcRenderer.invoke('delete-image', taskId, filename),
  deleteImageDir: (taskId) => ipcRenderer.invoke('delete-image-dir', taskId),
  readImage: (taskId, filename) => ipcRenderer.invoke('read-image', taskId, filename)
});
