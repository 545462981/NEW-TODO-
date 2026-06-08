const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 数据文件路径：%USERPROFILE%/.todo-notepad/tasks.json
const DATA_DIR = path.join(os.homedir(), '.todo-notepad');
const DATA_FILE = path.join(DATA_DIR, 'tasks.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadTasks() {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('加载任务失败:', e.message);
    return [];
  }
}

function saveTasks(tasks) {
  ensureDataDir();
  // 原子写入：先写临时文件，再重命名
  const tmpFile = DATA_FILE + '.tmp';
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(tasks, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DATA_FILE);
    return true;
  } catch (e) {
    console.error('保存任务失败:', e.message);
    // 清理临时文件
    try { fs.unlinkSync(tmpFile); } catch (_) { /* ignore */ }
    return false;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 800,
    minHeight: 500,
    title: '待办事项记事本',
    backgroundColor: '#F2F2F7',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  // 注册 IPC 处理器
  ipcMain.handle('load-tasks', () => loadTasks());
  ipcMain.handle('save-tasks', (_event, tasks) => {
    saveTasks(tasks);
    return true;
  });

  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
