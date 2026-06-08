const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 数据文件路径：%USERPROFILE%/.todo-notepad/tasks.json
const DATA_DIR = path.join(os.homedir(), '.todo-notepad');
const DATA_FILE = path.join(DATA_DIR, 'tasks.json');
const IMAGES_DIR = path.join(DATA_DIR, 'images');

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

// 保存图片：接收 base64 数据，写入文件，返回文件名
function saveImage(taskId, base64Data) {
  ensureDataDir();
  const taskImgDir = path.join(IMAGES_DIR, taskId);
  if (!fs.existsSync(taskImgDir)) {
    fs.mkdirSync(taskImgDir, { recursive: true });
  }
  // 去掉 data:image/...;base64, 前缀
  const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
  const ext = matches ? matches[1] : 'png';
  const raw = matches ? matches[2] : base64Data;
  const filename = Date.now().toString(36) + '.' + ext;
  const filepath = path.join(taskImgDir, filename);
  fs.writeFileSync(filepath, Buffer.from(raw, 'base64'));
  return filename;
}

// 删除单张图片
function deleteImage(taskId, filename) {
  const filepath = path.join(IMAGES_DIR, taskId, filename);
  try { fs.unlinkSync(filepath); } catch (_) { /* ignore */ }
}

// 删除任务的所有图片目录
function deleteImageDir(taskId) {
  const taskImgDir = path.join(IMAGES_DIR, taskId);
  try { fs.rmSync(taskImgDir, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

// 读取图片并返回 base64
function readImageAsBase64(taskId, filename) {
  const filepath = path.join(IMAGES_DIR, taskId, filename);
  try {
    const ext = path.extname(filename).slice(1) || 'png';
    const data = fs.readFileSync(filepath);
    return `data:image/${ext};base64,${data.toString('base64')}`;
  } catch (e) {
    return null;
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
  ipcMain.handle('save-image', (_event, taskId, base64Data) => saveImage(taskId, base64Data));
  ipcMain.handle('delete-image', (_event, taskId, filename) => { deleteImage(taskId, filename); });
  ipcMain.handle('delete-image-dir', (_event, taskId) => { deleteImageDir(taskId); });
  ipcMain.handle('read-image', (_event, taskId, filename) => readImageAsBase64(taskId, filename));

  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
