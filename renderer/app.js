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

  // 设置拖放事件
  setupDragAndDrop();
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

function setupDragAndDrop() {
  // 为列表设置拖放事件
  document.querySelectorAll('.task-list').forEach(list => {
    list.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      const draggingCard = document.querySelector('.task-card.dragging');
      if (draggingCard) {
        document.querySelectorAll('.task-card.drag-over').forEach(c => c.classList.remove('drag-over'));

        const afterElement = getDragAfterElement(list, e.clientY);
        if (afterElement) {
          afterElement.classList.add('drag-over');
        }
      }
    });

    list.addEventListener('dragleave', (e) => {
      if (!list.contains(e.relatedTarget)) {
        list.querySelectorAll('.task-card.drag-over').forEach(c => c.classList.remove('drag-over'));
      }
    });

    list.addEventListener('drop', (e) => {
      e.preventDefault();

      list.querySelectorAll('.task-card.drag-over').forEach(c => c.classList.remove('drag-over'));

      const taskId = e.dataTransfer.getData('text/plain');
      if (!taskId) return;

      const task = Store.getById(taskId);
      if (!task) return;

      const column = list.closest('.column');
      const newStatus = column.dataset.status;

      if (task.status === newStatus) return;

      Store.update(taskId, { status: newStatus });
      renderBoard();
    });
  });

  // 允许拖放到列（没有卡片时也能 drop）
  document.querySelectorAll('.column').forEach(column => {
    column.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    column.addEventListener('drop', (e) => {
      if (e.target.closest('.task-list')) return;

      e.preventDefault();
      const taskId = e.dataTransfer.getData('text/plain');
      if (!taskId) return;

      const task = Store.getById(taskId);
      if (!task) return;

      const newStatus = column.dataset.status;
      if (task.status === newStatus) return;

      Store.update(taskId, { status: newStatus });
      renderBoard();
    });
  });
}

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

// === 启动 ===
init();
