const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('todoAPI', {
  loadTasks: () => ipcRenderer.invoke('load-tasks'),
  saveTasks: (tasks) => ipcRenderer.invoke('save-tasks', tasks)
});
