const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 数据文件路径：%USERPROFILE%/.todo-notepad/
const DATA_DIR = path.join(os.homedir(), '.todo-notepad');
const DATA_FILE = path.join(DATA_DIR, 'tasks.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const IMAGES_DIR = path.join(DATA_DIR, 'images');

let mainWindow = null;
let tray = null;
let closeToTray = true;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// === 配置文件 ===
function loadConfig() {
  ensureDataDir();
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch (_) {}
  return { closeToTray: true };
}

function saveConfig(config) {
  ensureDataDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

// === 创建托盘图标 ===
function createTrayIcon() {
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  try {
    if (fs.existsSync(iconPath)) {
      const buf = fs.readFileSync(iconPath);
      return nativeImage.createFromBuffer(buf, { width: 16, height: 16 });
    }
  } catch (_) {}
  // 降级：没有图标文件时生成一个简单的蓝色方块
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const inCircle = (x - 8) * (x - 8) + (y - 8) * (y - 8) < 56;
      buf[i] = 0x00;
      buf[i + 1] = inCircle ? 0x7A : 0x00;
      buf[i + 2] = inCircle ? 0xFF : 0x00;
      buf[i + 3] = inCircle ? 0xFF : 0x00;
    }
  }
  return nativeImage.createFromBuffer(buf, { width: size, height: size });
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip('待办事项记事本');
  updateTrayMenu();
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function updateTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: '关闭时最小化到托盘',
      type: 'checkbox',
      checked: closeToTray,
      click: (menuItem) => {
        closeToTray = menuItem.checked;
        saveConfig({ closeToTray });
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        closeToTray = false;
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
}

// === 任务数据 ===
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
  const tmpFile = DATA_FILE + '.tmp';
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(tasks, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DATA_FILE);
    return true;
  } catch (e) {
    console.error('保存任务失败:', e.message);
    try { fs.unlinkSync(tmpFile); } catch (_) {}
    return false;
  }
}

function saveImage(taskId, base64Data) {
  ensureDataDir();
  const taskImgDir = path.join(IMAGES_DIR, taskId);
  if (!fs.existsSync(taskImgDir)) {
    fs.mkdirSync(taskImgDir, { recursive: true });
  }
  const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
  const ext = matches ? matches[1] : 'png';
  const raw = matches ? matches[2] : base64Data;
  const filename = Date.now().toString(36) + '.' + ext;
  const filepath = path.join(taskImgDir, filename);
  fs.writeFileSync(filepath, Buffer.from(raw, 'base64'));
  return filename;
}

function deleteImage(taskId, filename) {
  const filepath = path.join(IMAGES_DIR, taskId, filename);
  try { fs.unlinkSync(filepath); } catch (_) {}
}

function deleteImageDir(taskId) {
  const taskImgDir = path.join(IMAGES_DIR, taskId);
  try { fs.rmSync(taskImgDir, { recursive: true, force: true }); } catch (_) {}
}

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

// === 窗口 ===
function createWindow() {
  mainWindow = new BrowserWindow({
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

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 点击关闭按钮时：根据设置决定隐藏还是退出
  mainWindow.on('close', (event) => {
    if (closeToTray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

// === 启动 ===
app.whenReady().then(() => {
  // 加载配置
  const config = loadConfig();
  closeToTray = config.closeToTray !== false;

  // 注册 IPC
  ipcMain.handle('load-tasks', () => loadTasks());
  ipcMain.handle('save-tasks', (_event, tasks) => { saveTasks(tasks); return true; });
  ipcMain.handle('save-image', (_event, taskId, base64Data) => saveImage(taskId, base64Data));
  ipcMain.handle('delete-image', (_event, taskId, filename) => { deleteImage(taskId, filename); });
  ipcMain.handle('delete-image-dir', (_event, taskId) => { deleteImageDir(taskId); });
  ipcMain.handle('read-image', (_event, taskId, filename) => readImageAsBase64(taskId, filename));
  ipcMain.handle('get-config', () => ({ closeToTray }));
  ipcMain.handle('set-config', (_event, config) => {
    if (config.closeToTray !== undefined) {
      closeToTray = config.closeToTray;
      saveConfig({ closeToTray });
      updateTrayMenu();
    }
  });

  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  // 不退出，托盘保持运行
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});
