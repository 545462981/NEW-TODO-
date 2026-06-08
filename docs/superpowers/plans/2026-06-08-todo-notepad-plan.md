# 待办事项记事本 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 Electron 桌面待办事项应用，三列看板（待办/进行中/已完成），iOS 简约风格，本地 JSON 存储，打包为单个 .exe

**Architecture:** Electron 主进程负责窗口创建和文件 I/O，preload 脚本暴露安全 IPC 接口，渲染进程用原生 HTML/CSS/JS 实现三列看板 UI 和拖拽交互

**Tech Stack:** Electron 33, electron-builder (portable exe), 原生 HTML/CSS/JS

---

## 文件结构

```
todo-notepad/
├── package.json          — 依赖和构建配置
├── main.js               — Electron 主进程
├── preload.js            — IPC 桥接
├── renderer/
│   ├── index.html        — 页面结构（三列 + 弹窗）
│   ├── style.css         — iOS 简约风格
│   ├── store.js          — 数据层（通过 IPC 读写 JSON）
│   └── app.js            — UI 逻辑（渲染、拖拽、CRUD）
└── assets/
    └── icon.png          — 应用图标（需用户提供或生成）
```

---

### Task 1: 项目脚手架和依赖

**Files:**
- Create: `package.json`
- Create: `renderer/` (via mkdir)
- Create: `assets/` (via mkdir)

- [ ] **Step 1: 创建目录结构**

Run: `mkdir renderer assets`

- [ ] **Step 2: 编写 package.json**

```json
{
  "name": "todo-notepad",
  "version": "1.0.0",
  "description": "待办事项记事本 - iOS 简约风格",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder --win portable"
  },
  "build": {
    "appId": "com.todo.notepad",
    "productName": "待办事项记事本",
    "win": {
      "target": "portable",
      "icon": "assets/icon.png"
    },
    "portable": {
      "artifactName": "待办事项记事本.exe"
    },
    "files": [
      "main.js",
      "preload.js",
      "renderer/**/*"
    ]
  },
  "devDependencies": {
    "electron": "^33.0.0",
    "electron-builder": "^25.0.0"
  }
}
```

- [ ] **Step 3: 安装依赖**

Run: `npm install`

- [ ] **Step 4: 提交**

```bash
git add package.json package-lock.json
git commit -m "feat: project scaffolding with Electron and electron-builder"
```

---

### Task 2: Electron 主进程

**Files:**
- Create: `main.js`

- [ ] **Step 1: 编写 main.js — 创建窗口、IPC 处理器、JSON 文件读写**

```javascript
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// 数据文件路径：%USERPROFILE%/.todo-notepad/tasks.json
const DATA_DIR = path.join(require('os').homedir(), '.todo-notepad');
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
  fs.writeFileSync(tmpFile, JSON.stringify(tasks, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DATA_FILE);
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
```

- [ ] **Step 2: 验证 Electron 能启动（先创建一个空白页面）**

Run: `echo ^<html^>^<body^>^<h1^>Hello^</h1^>^</body^>^</html^> > renderer\index.html`
Run: `npx electron .`

Expected: 弹出窗口显示 "Hello"，关闭后退出。

- [ ] **Step 3: 提交**

```bash
git add main.js renderer/index.html
git commit -m "feat: Electron main process with IPC handlers for JSON file I/O"
```

---

### Task 3: Preload 脚本

**Files:**
- Create: `preload.js`

- [ ] **Step 1: 编写 preload.js**

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('todoAPI', {
  loadTasks: () => ipcRenderer.invoke('load-tasks'),
  saveTasks: (tasks) => ipcRenderer.invoke('save-tasks', tasks)
});
```

- [ ] **Step 2: 提交**

```bash
git add preload.js
git commit -m "feat: preload script with safe IPC bridge"
```

---

### Task 4: HTML 页面结构

**Files:**
- Create: `renderer/index.html` (覆盖之前测试用的)

- [ ] **Step 1: 编写完整 HTML — 三列看板 + 新增/编辑弹窗 + 删除确认弹窗**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>待办事项记事本</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="app">
    <header class="app-header">
      <h1>待办事项</h1>
      <span class="header-date" id="headerDate"></span>
    </header>
    <main class="board">
      <!-- 待办列 -->
      <div class="column" data-status="todo" id="column-todo">
        <div class="column-header">
          <span class="column-icon">📋</span>
          <span class="column-title">待办</span>
          <span class="column-count" id="count-todo">0</span>
        </div>
        <div class="task-list" id="list-todo"></div>
        <button class="add-btn" onclick="openAddModal('todo')">+ 新增任务</button>
      </div>
      <!-- 进行中列 -->
      <div class="column" data-status="in-progress" id="column-in-progress">
        <div class="column-header">
          <span class="column-icon">🔄</span>
          <span class="column-title">进行中</span>
          <span class="column-count" id="count-in-progress">0</span>
        </div>
        <div class="task-list" id="list-in-progress"></div>
      </div>
      <!-- 已完成列 -->
      <div class="column" data-status="done" id="column-done">
        <div class="column-header">
          <span class="column-icon">✅</span>
          <span class="column-title">已完成</span>
          <span class="column-count" id="count-done">0</span>
        </div>
        <div class="task-list" id="list-done"></div>
      </div>
    </main>
  </div>

  <!-- 新增/编辑任务弹窗 -->
  <div class="modal-overlay" id="modalOverlay" onclick="closeModal(event)">
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header">
        <h2 id="modalTitle">新增任务</h2>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <div class="modal-body">
        <input type="hidden" id="taskId">
        <input type="hidden" id="taskStatus">
        <div class="form-group">
          <label>任务标题 <span class="required">*</span></label>
          <input type="text" id="taskTitle" placeholder="输入任务标题..." autofocus>
        </div>
        <div class="form-group">
          <label>优先级</label>
          <div class="priority-selector" id="prioritySelector">
            <button class="priority-option selected" data-priority="medium" type="button">
              <span class="priority-dot medium"></span> 中
            </button>
            <button class="priority-option" data-priority="high" type="button">
              <span class="priority-dot high"></span> 高
            </button>
            <button class="priority-option" data-priority="low" type="button">
              <span class="priority-dot low"></span> 低
            </button>
          </div>
        </div>
        <div class="form-group">
          <label>截止日期</label>
          <input type="date" id="taskDueDate">
        </div>
        <div class="form-group">
          <label>备注</label>
          <textarea id="taskNote" rows="3" placeholder="添加备注..."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-cancel" onclick="closeModal()">取消</button>
        <button class="btn-save" onclick="saveTask()">保存</button>
      </div>
    </div>
  </div>

  <!-- 删除确认弹窗 -->
  <div class="modal-overlay" id="confirmOverlay" onclick="closeConfirm()">
    <div class="modal modal-sm" onclick="event.stopPropagation()">
      <div class="modal-header">
        <h2>确认删除</h2>
      </div>
      <div class="modal-body">
        <p>确定要删除这个任务吗？此操作不可撤销。</p>
      </div>
      <div class="modal-footer">
        <button class="btn-cancel" onclick="closeConfirm()">取消</button>
        <button class="btn-danger" id="confirmDeleteBtn">删除</button>
      </div>
    </div>
  </div>

  <script src="store.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: 提交**

```bash
git add renderer/index.html
git commit -m "feat: HTML structure with three-column kanban board and modals"
```

---

### Task 5: iOS 简约风格 CSS

**Files:**
- Create: `renderer/style.css`

- [ ] **Step 1: 编写完整 CSS 样式表**

```css
/* === 基础重置 === */
*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --bg: #F2F2F7;
  --card-bg: #FFFFFF;
  --text-primary: #1C1C1E;
  --text-secondary: #8E8E93;
  --text-tertiary: #C7C7CC;
  --separator: #E5E5EA;
  --blue: #007AFF;
  --red: #FF3B30;
  --orange: #FF9500;
  --green: #34C759;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  --shadow-hover: 0 4px 12px rgba(0, 0, 0, 0.12);
  --radius: 12px;
  --radius-sm: 8px;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
  background: var(--bg);
  color: var(--text-primary);
  height: 100vh;
  overflow: hidden;
  user-select: none;
}

/* === 顶部栏 === */
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 12px;
}

.app-header h1 {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.5px;
}

.header-date {
  font-size: 15px;
  color: var(--text-secondary);
}

/* === 看板 === */
.board {
  display: flex;
  gap: 16px;
  padding: 0 24px 24px;
  height: calc(100vh - 76px);
}

.column {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.column-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px 12px;
}

.column-icon {
  font-size: 18px;
}

.column-title {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.3px;
}

.column-count {
  font-size: 13px;
  color: var(--text-secondary);
  background: var(--separator);
  padding: 1px 8px;
  border-radius: 10px;
  font-weight: 500;
}

/* === 任务列表 === */
.task-list {
  flex: 1;
  overflow-y: auto;
  padding: 2px 4px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-list:empty::after {
  content: '暂无任务';
  display: block;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 13px;
  padding: 32px 0;
}

/* === 任务卡片 === */
.task-card {
  background: var(--card-bg);
  border-radius: var(--radius);
  padding: 14px 16px;
  box-shadow: var(--shadow);
  cursor: grab;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  position: relative;
  border-left: 3px solid transparent;
}

.task-card:active {
  cursor: grabbing;
}

.task-card:hover {
  box-shadow: var(--shadow-hover);
  transform: translateY(-1px);
}

.task-card.priority-high { border-left-color: var(--red); }
.task-card.priority-medium { border-left-color: var(--orange); }
.task-card.priority-low { border-left-color: var(--green); }

.task-card.dragging {
  opacity: 0.5;
  transform: scale(0.95);
}

.task-card.drag-over {
  border-top: 2px solid var(--blue);
}

.task-card-title {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  margin-bottom: 6px;
  word-break: break-word;
}

.task-card-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--text-secondary);
}

.task-card-due {
  display: flex;
  align-items: center;
  gap: 4px;
}

.task-card-due.overdue {
  color: var(--red);
}

.task-card-note-indicator {
  color: var(--text-tertiary);
  font-size: 11px;
}

/* === 上下文菜单 === */
.context-menu {
  position: fixed;
  background: var(--card-bg);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  padding: 4px 0;
  min-width: 120px;
}

.context-menu-item {
  display: block;
  width: 100%;
  padding: 8px 16px;
  border: none;
  background: none;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  color: var(--text-primary);
}

.context-menu-item:hover {
  background: #F2F2F7;
}

.context-menu-item.danger {
  color: var(--red);
}

/* === 新增按钮 === */
.add-btn {
  width: 100%;
  padding: 10px;
  margin-top: 8px;
  border: 1px dashed var(--text-tertiary);
  border-radius: var(--radius);
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s ease;
}

.add-btn:hover {
  border-color: var(--blue);
  color: var(--blue);
  background: rgba(0, 122, 255, 0.04);
}

/* === 弹窗 === */
.modal-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 500;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
}

.modal-overlay.show {
  display: flex;
}

.modal {
  background: var(--card-bg);
  border-radius: var(--radius);
  width: 420px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.15);
  animation: modalIn 0.2s ease;
}

.modal-sm {
  width: 340px;
}

@keyframes modalIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 0;
}

.modal-header h2 {
  font-size: 17px;
  font-weight: 600;
}

.modal-close {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: var(--separator);
  font-size: 16px;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.modal-close:hover {
  background: #D1D1D6;
}

.modal-body {
  padding: 16px 20px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 20px 20px;
}

/* === 表单 === */
.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.required {
  color: var(--red);
}

.form-group input[type="text"],
.form-group input[type="date"],
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--separator);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-family: inherit;
  color: var(--text-primary);
  background: var(--bg);
  transition: border-color 0.2s;
  outline: none;
}

.form-group input:focus,
.form-group textarea:focus {
  border-color: var(--blue);
  background: var(--card-bg);
}

/* === 优先级选择器 === */
.priority-selector {
  display: flex;
  gap: 8px;
}

.priority-option {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  border: 2px solid var(--separator);
  border-radius: var(--radius-sm);
  background: var(--bg);
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  color: var(--text-primary);
  transition: all 0.2s;
}

.priority-option.selected {
  border-color: var(--blue);
  background: rgba(0, 122, 255, 0.06);
}

.priority-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.priority-dot.high { background: var(--red); }
.priority-dot.medium { background: var(--orange); }
.priority-dot.low { background: var(--green); }

/* === 按钮 === */
.btn-save {
  padding: 8px 20px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--blue);
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: opacity 0.2s;
}

.btn-save:hover {
  opacity: 0.85;
}

.btn-cancel {
  padding: 8px 20px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--separator);
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  font-family: inherit;
}

.btn-cancel:hover {
  background: #D1D1D6;
}

.btn-danger {
  padding: 8px 20px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--red);
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: opacity 0.2s;
}

.btn-danger:hover {
  opacity: 0.85;
}

/* === 滚动条 === */
.task-list::-webkit-scrollbar {
  width: 4px;
}

.task-list::-webkit-scrollbar-track {
  background: transparent;
}

.task-list::-webkit-scrollbar-thumb {
  background: var(--text-tertiary);
  border-radius: 2px;
}
```

- [ ] **Step 2: 提交**

```bash
git add renderer/style.css
git commit -m "feat: iOS minimalist CSS styles for kanban board and modals"
```

---

### Task 6: 数据存储层

**Files:**
- Create: `renderer/store.js`

- [ ] **Step 1: 编写 store.js — 数据加载、保存和 CRUD 辅助函数**

```javascript
const Store = {
  tasks: [],

  // 从主进程加载数据
  async load() {
    this.tasks = await window.todoAPI.loadTasks();
    return this.tasks;
  },

  // 保存数据到主进程
  async save() {
    await window.todoAPI.saveTasks(this.tasks);
  },

  // 生成唯一 ID
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  },

  // 获取任务
  getById(id) {
    return this.tasks.find(t => t.id === id);
  },

  // 新增任务
  add(taskData) {
    const task = {
      id: this.generateId(),
      title: taskData.title.trim(),
      status: taskData.status || 'todo',
      priority: taskData.priority || 'medium',
      dueDate: taskData.dueDate || '',
      note: taskData.note || '',
      createdAt: new Date().toISOString()
    };
    this.tasks.push(task);
    this.save();
    return task;
  },

  // 更新任务
  update(id, updates) {
    const task = this.getById(id);
    if (!task) return null;

    if (updates.title !== undefined) task.title = updates.title.trim();
    if (updates.status !== undefined) task.status = updates.status;
    if (updates.priority !== undefined) task.priority = updates.priority;
    if (updates.dueDate !== undefined) task.dueDate = updates.dueDate;
    if (updates.note !== undefined) task.note = updates.note;

    this.save();
    return task;
  },

  // 删除任务
  remove(id) {
    const index = this.tasks.findIndex(t => t.id === id);
    if (index === -1) return false;
    this.tasks.splice(index, 1);
    this.save();
    return true;
  },

  // 按状态筛选
  getByStatus(status) {
    return this.tasks.filter(t => t.status === status);
  }
};
```

- [ ] **Step 2: 提交**

```bash
git add renderer/store.js
git commit -m "feat: data store layer with CRUD and JSON persistence"
```

---

### Task 7: 应用主逻辑 — 渲染和 CRUD

**Files:**
- Create: `renderer/app.js`

- [ ] **Step 1: 编写 app.js — 初始化、渲染看板、弹窗交互、CRUD 操作**

```javascript
// === 状态 ===
let editingTaskId = null;
let deleteTargetId = null;
let currentPriority = 'medium';

// === 初始化 ===
async function init() {
  // 显示日期
  const now = new Date();
  const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
  document.getElementById('headerDate').textContent = now.toLocaleDateString('zh-CN', options);

  // 加载数据
  await Store.load();

  // 渲染看板
  renderBoard();

  // 优先级选择器事件
  document.querySelectorAll('.priority-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.priority-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      currentPriority = btn.dataset.priority;
    });
  });

  // 删除确认按钮事件
  document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDelete);
}

// === 渲染看板 ===
function renderBoard() {
  const statuses = ['todo', 'in-progress', 'done'];

  statuses.forEach(status => {
    const tasks = Store.getByStatus(status);
    const list = document.getElementById(`list-${status}`);
    const count = document.getElementById(`count-${status}`);

    count.textContent = tasks.length;
    list.innerHTML = '';

    tasks.forEach(task => {
      list.appendChild(createTaskCard(task));
    });
  });
}

// === 创建任务卡片 ===
function createTaskCard(task) {
  const card = document.createElement('div');
  card.className = `task-card priority-${task.priority}`;
  card.draggable = true;
  card.dataset.id = task.id;

  // 优先级标签
  const priorityLabels = { high: '高', medium: '中', low: '低' };

  // 截止日期
  let dueHTML = '';
  if (task.dueDate) {
    const dueDate = new Date(task.dueDate + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isOverdue = dueDate < today && task.status !== 'done';
    const dateStr = task.dueDate;
    dueHTML = `<span class="task-card-due ${isOverdue ? 'overdue' : ''}">📅 ${dateStr}</span>`;
  }

  // 备注图标
  const noteHTML = task.note ? '<span class="task-card-note-indicator">📝</span>' : '';

  card.innerHTML = `
    <div class="task-card-title">${escapeHTML(task.title)}</div>
    <div class="task-card-meta">
      <span>${priorityLabels[task.priority]}优先级</span>
      ${dueHTML}
      ${noteHTML}
    </div>
  `;

  // 拖拽事件
  card.addEventListener('dragstart', handleDragStart);
  card.addEventListener('dragend', handleDragEnd);

  // 点击编辑
  card.addEventListener('click', (e) => {
    openEditModal(task.id);
  });

  // 右键删除
  card.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, task.id);
  });

  return card;
}

// === HTML 转义 ===
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// === 右键菜单 ===
function showContextMenu(x, y, taskId) {
  // 移除已有菜单
  const existing = document.querySelector('.context-menu');
  if (existing) existing.remove();

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';

  menu.innerHTML = `
    <button class="context-menu-item" id="ctxEdit">✏️ 编辑</button>
    <button class="context-menu-item danger" id="ctxDelete">🗑️ 删除</button>
  `;

  document.body.appendChild(menu);

  menu.querySelector('#ctxEdit').addEventListener('click', () => {
    menu.remove();
    openEditModal(taskId);
  });

  menu.querySelector('#ctxDelete').addEventListener('click', () => {
    menu.remove();
    openDeleteConfirm(taskId);
  });

  // 点击其他地方关闭
  const closeMenu = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

// === 打开新增弹窗 ===
function openAddModal(status) {
  editingTaskId = null;
  document.getElementById('modalTitle').textContent = '新增任务';
  document.getElementById('taskId').value = '';
  document.getElementById('taskStatus').value = status;
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskDueDate').value = '';
  document.getElementById('taskNote').value = '';

  // 重置优先级为"中"
  currentPriority = 'medium';
  document.querySelectorAll('.priority-option').forEach(b => {
    b.classList.toggle('selected', b.dataset.priority === 'medium');
  });

  document.getElementById('modalOverlay').classList.add('show');
  setTimeout(() => document.getElementById('taskTitle').focus(), 100);
}

// === 打开编辑弹窗 ===
function openEditModal(taskId) {
  const task = Store.getById(taskId);
  if (!task) return;

  editingTaskId = taskId;
  document.getElementById('modalTitle').textContent = '编辑任务';
  document.getElementById('taskId').value = task.id;
  document.getElementById('taskStatus').value = task.status;
  document.getElementById('taskTitle').value = task.title;
  document.getElementById('taskDueDate').value = task.dueDate;
  document.getElementById('taskNote').value = task.note;

  currentPriority = task.priority;
  document.querySelectorAll('.priority-option').forEach(b => {
    b.classList.toggle('selected', b.dataset.priority === task.priority);
  });

  document.getElementById('modalOverlay').classList.add('show');
  setTimeout(() => document.getElementById('taskTitle').focus(), 100);
}

// === 关闭弹窗 ===
function closeModal(event) {
  // event 可能是背景点击事件
  if (event && event.target !== document.getElementById('modalOverlay')) return;
  document.getElementById('modalOverlay').classList.remove('show');
  editingTaskId = null;
}

// === 保存任务 ===
function saveTask() {
  const title = document.getElementById('taskTitle').value.trim();

  if (!title) {
    document.getElementById('taskTitle').focus();
    document.getElementById('taskTitle').style.borderColor = '#FF3B30';
    setTimeout(() => {
      document.getElementById('taskTitle').style.borderColor = '';
    }, 1500);
    return;
  }

  const data = {
    title: title,
    status: document.getElementById('taskStatus').value,
    priority: currentPriority,
    dueDate: document.getElementById('taskDueDate').value,
    note: document.getElementById('taskNote').value.trim()
  };

  if (editingTaskId) {
    Store.update(editingTaskId, data);
  } else {
    Store.add(data);
  }

  document.getElementById('modalOverlay').classList.remove('show');
  editingTaskId = null;
  renderBoard();
}

// === 打开删除确认 ===
function openDeleteConfirm(taskId) {
  deleteTargetId = taskId;
  document.getElementById('confirmOverlay').classList.add('show');
}

// === 确认删除 ===
function confirmDelete() {
  if (deleteTargetId) {
    Store.remove(deleteTargetId);
    deleteTargetId = null;
  }
  document.getElementById('confirmOverlay').classList.remove('show');
  renderBoard();
}

// === 关闭确认弹窗 ===
function closeConfirm() {
  document.getElementById('confirmOverlay').classList.remove('show');
  deleteTargetId = null;
}

// === 键盘快捷键 ===
document.addEventListener('keydown', (e) => {
  // ESC 关闭弹窗
  if (e.key === 'Escape') {
    if (document.getElementById('confirmOverlay').classList.contains('show')) {
      closeConfirm();
    } else if (document.getElementById('modalOverlay').classList.contains('show')) {
      closeModal();
    }
  }

  // Enter 保存（在弹窗内时）
  if (e.key === 'Enter' && document.getElementById('modalOverlay').classList.contains('show')) {
    const focused = document.activeElement;
    // 不在 textarea 中按 Enter 时保存
    if (focused && focused.tagName !== 'TEXTAREA') {
      e.preventDefault();
      saveTask();
    }
  }
});

// === 启动 ===
init();
```

- [ ] **Step 2: 验证应用能启动并显示空看板**

Run: `npx electron .`

Expected: 窗口显示三列空看板（"暂无任务"），可以点击"+ 新增任务"打开弹窗。

- [ ] **Step 3: 提交**

```bash
git add renderer/app.js
git commit -m "feat: main app logic - render board, modals, CRUD operations"
```

---

### Task 8: 拖拽功能

**Files:**
- Modify: `renderer/app.js` (追加拖拽处理函数)

- [ ] **Step 1: 在 app.js 末尾（init() 调用之前）追加拖拽函数**

在 `renderer/app.js` 中，将以下代码添加到 `// === 启动 ===` 之前的 `// === 键盘快捷键 ===` 部分后面：

```javascript
// === 拖拽处理 ===
function handleDragStart(e) {
  const card = e.target.closest('.task-card');
  if (!card) return;

  card.classList.add('dragging');
  e.dataTransfer.setData('text/plain', card.dataset.id);
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
  const card = e.target.closest('.task-card');
  if (card) {
    card.classList.remove('dragging');
  }
}

// 为列表和列设置拖放事件
document.querySelectorAll('.task-list').forEach(list => {
  list.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // 高亮显示目标
    const draggingCard = document.querySelector('.task-card.dragging');
    if (draggingCard) {
      // 移除所有 drag-over
      document.querySelectorAll('.task-card.drag-over').forEach(c => c.classList.remove('drag-over'));

      // 找到鼠标下方最近的卡片
      const afterElement = getDragAfterElement(list, e.clientY);
      if (afterElement) {
        afterElement.classList.add('drag-over');
      }
    }
  });

  list.addEventListener('dragleave', (e) => {
    // 只在离开列表时清理
    if (!list.contains(e.relatedTarget)) {
      list.querySelectorAll('.task-card.drag-over').forEach(c => c.classList.remove('drag-over'));
    }
  });

  list.addEventListener('drop', (e) => {
    e.preventDefault();

    // 清理高亮
    list.querySelectorAll('.task-card.drag-over').forEach(c => c.classList.remove('drag-over'));

    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const task = Store.getById(taskId);
    if (!task) return;

    // 获取目标列的状态
    const column = list.closest('.column');
    const newStatus = column.dataset.status;

    // 如果状态没变，不处理
    if (task.status === newStatus) return;

    // 更新任务状态
    task.status = newStatus;
    Store.update(taskId, { status: newStatus });
    renderBoard();
  });
});

// 允许拖放到列头区域（没有卡片时也能 drop）
document.querySelectorAll('.column').forEach(column => {
  column.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });

  column.addEventListener('drop', (e) => {
    // 防止重复处理（列表上的 drop 会冒泡上来）
    if (e.target.closest('.task-list')) return;

    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const task = Store.getById(taskId);
    if (!task) return;

    const newStatus = column.dataset.status;
    if (task.status === newStatus) return;

    task.status = newStatus;
    Store.update(taskId, { status: newStatus });
    renderBoard();
  });
});

// 获取拖拽位置下方的最近元素
function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.task-card:not(.dragging)')];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;

    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}
```

- [ ] **Step 2: 验证拖拽功能**

Run: `npx electron .`

Expected:
- 创建几个任务后，可以从"待办"拖到"进行中"和"已完成"
- 拖拽时卡片变为半透明，目标位置显示蓝色插入线
- 放下后状态更新，列计数正确变化

- [ ] **Step 3: 提交**

```bash
git add renderer/app.js
git commit -m "feat: drag and drop to switch task status between columns"
```

---

### Task 9: 应用图标和构建配置

**Files:**
- Create: `assets/icon.svg` (临时 SVG 图标)
- Modify: `package.json` (确认构建配置)

- [ ] **Step 1: 生成临时应用图标**

由于没有原始图标文件，先用脚本生成一个简单的 PNG 图标（electron-builder 需要 PNG 或 ICO 格式的图标）。这里创建一个最小 256x256 的占位图标，用户可以后续替换。

Run the following Node.js script to create a simple icon:
```bash
node -e "
const fs = require('fs');
// 最小化 BMP 格式 → 然后用简单方法
// 直接用 Canvas 需要额外依赖，这里使用 electron-builder 的默认图标
// 暂时跳过，electron-builder 在没有图标时会使用默认图标
console.log('Skipping icon generation - will use default Electron icon');
"
```

实际上，更好的做法是修改 `package.json` 的构建配置，让它在没有图标文件时不报错：

修改 `package.json` 中的 `build.win.icon` 为可选：

```json
"win": {
  "target": "portable"
},
```

即移除 `"icon": "assets/icon.png"` 这一行，使用 Electron 默认图标。

- [ ] **Step 2: 更新 package.json 构建配置（移除图标依赖）**

Read `package.json` 并修改：

将：
```json
"win": {
  "target": "portable",
  "icon": "assets/icon.png"
}
```

改为：
```json
"win": {
  "target": "portable"
}
```

- [ ] **Step 3: 构建 .exe 文件**

Run: `npx electron-builder --win portable`

Expected: 在 `dist/` 目录下生成 `待办事项记事本.exe`

- [ ] **Step 4: 验证生成的 .exe 能正常运行**

Run: `dist/待办事项记事本.exe`

Expected: 应用正常启动，可以添加、编辑、拖拽、删除任务。关闭后重新打开，数据保留。

- [ ] **Step 5: 提交**

```bash
git add package.json
git commit -m "build: electron-builder config for portable Windows exe"
```

---

### Task 10: 最终验证和收尾

- [ ] **Step 1: 完整功能验收**

Run: `dist/待办事项记事本.exe`

验证清单:
1. ✅ 三列看板正确显示
2. ✅ 点击"+ 新增任务"弹出表单
3. ✅ 填写标题、选择优先级、设置截止日期、添加备注，保存成功
4. ✅ 卡片显示优先级色条、截止日期、备注图标
5. ✅ 点击卡片可以编辑
6. ✅ 拖拽卡片到另一列，状态更新
7. ✅ 右键卡片可以删除（弹出确认框）
8. ✅ 关闭应用再打开，数据完整保留
9. ✅ 过期任务截止日期显示红色
10. ✅ ESC 关闭弹窗

- [ ] **Step 2: 清理测试用的空白页面**

确认 `renderer/index.html` 是完整版本，没有残留测试代码。

- [ ] **Step 3: 最终提交**

```bash
git add -A
git commit -m "chore: final cleanup and verification ready"
```

---

## 注意事项

1. **图标替换**：用户可以准备一张 256x256 或更大的 PNG 图片放到 `assets/icon.png`，然后在 `package.json` 的 `build.win` 中加回 `"icon": "assets/icon.png"`，重新构建即可。

2. **数据位置**：所有任务数据保存在 `%USERPROFILE%/.todo-notepad/tasks.json`，备份该文件即可保留数据。

3. **如需卸载**：删除 `%USERPROFILE%/.todo-notepad/` 目录和 `.exe` 文件即可。
