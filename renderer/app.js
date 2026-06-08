// === 状态 ===
let editingTaskId = null;
let deleteTargetId = null;
let currentPriority = 'medium';
let pendingImages = [];      // 待上传的 base64 图片
let existingImages = [];     // 编辑时已有的图片文件名列表
let viewerImages = [];       // 查看器中的图片列表
let viewerIndex = 0;         // 当前查看的图片索引
let viewerTaskId = null;     // 查看器所属任务 ID

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

  // 设置图片上传
  setupImageUpload();
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
  // 查看器打开时不处理这些快捷键
  if (document.getElementById('imageViewerOverlay').classList.contains('show')) return;

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

// ============== 图片功能 ==============

// 设置图片上传区域事件
function setupImageUpload() {
  const zone = document.getElementById('imageUploadZone');
  const input = document.getElementById('imageFileInput');

  // 点击上传区选择文件
  zone.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    handleFiles(input.files);
    input.value = '';
  });

  // 拖拽上传
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => {
    zone.classList.remove('drag-over');
  });
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  });

  // Ctrl+V 粘贴图片（在弹窗内）
  document.addEventListener('paste', (e) => {
    if (!document.getElementById('modalOverlay').classList.contains('show')) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        handleFiles([file]);
        break;
      }
    }
  });

  // 图片查看器事件
  document.getElementById('viewerPrev').addEventListener('click', () => navigateViewer(-1));
  document.getElementById('viewerNext').addEventListener('click', () => navigateViewer(1));
  document.getElementById('viewerDelete').addEventListener('click', deleteViewerImage);

  // 键盘 ← → 切换图片
  document.addEventListener('keydown', (e) => {
    if (!document.getElementById('imageViewerOverlay').classList.contains('show')) return;
    if (e.key === 'ArrowLeft') navigateViewer(-1);
    if (e.key === 'ArrowRight') navigateViewer(1);
    if (e.key === 'Escape') closeImageViewer();
  });
}

// 处理文件：转 base64 并显示缩略图
function handleFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const reader = new FileReader();
    reader.onload = (e) => {
      pendingImages.push(e.target.result);
      renderImageThumbs();
    };
    reader.readAsDataURL(file);
  }
}

// 渲染弹窗中的缩略图
function renderImageThumbs() {
  const container = document.getElementById('imageThumbs');
  container.innerHTML = '';

  // 已有图片（编辑时）
  existingImages.forEach((filename, idx) => {
    loadExistingThumb(filename, idx, container);
  });

  // 待上传的图片
  pendingImages.forEach((base64, idx) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'image-thumb-wrapper';

    const img = document.createElement('img');
    img.className = 'image-thumb';
    img.src = base64;
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      showSimplePreview(base64);
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'image-thumb-remove';
    removeBtn.innerHTML = '&times;';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      pendingImages.splice(idx, 1);
      renderImageThumbs();
    });

    wrapper.appendChild(img);
    wrapper.appendChild(removeBtn);
    container.appendChild(wrapper);
  });
}

// 加载已有图片的缩略图
async function loadExistingThumb(filename, idx, container) {
  const base64 = await window.todoAPI.readImage(editingTaskId, filename);
  if (!base64) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'image-thumb-wrapper';

  const img = document.createElement('img');
  img.className = 'image-thumb';
  img.src = base64;
  img.addEventListener('click', (e) => {
    e.stopPropagation();
    showSimplePreview(base64);
  });

  const removeBtn = document.createElement('button');
  removeBtn.className = 'image-thumb-remove';
  removeBtn.innerHTML = '&times;';
  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    existingImages.splice(idx, 1);
    renderImageThumbs();
  });

  wrapper.appendChild(img);
  wrapper.appendChild(removeBtn);
  container.appendChild(wrapper);
}

// 简单图片预览（弹窗中的图片点击放大）
function showSimplePreview(base64) {
  document.getElementById('viewerImage').src = base64;
  document.getElementById('viewerCounter').textContent = '';
  document.getElementById('viewerPrev').style.display = 'none';
  document.getElementById('viewerNext').style.display = 'none';
  document.getElementById('viewerDelete').style.display = 'none';
  document.getElementById('imageViewerOverlay').classList.add('show');
  viewerTaskId = null;
  viewerImages = [];
}

// 修改 openAddModal，重置图片
const _origOpenAddModal = openAddModal;
openAddModal = function(status) {
  pendingImages = [];
  existingImages = [];
  _origOpenAddModal(status);
  renderImageThumbs();
};

// 修改 openEditModal，加载已有图片
const _origOpenEditModal = openEditModal;
openEditModal = function(taskId) {
  _origOpenEditModal(taskId);
  const task = Store.getById(taskId);
  pendingImages = [];
  existingImages = task && task.images ? [...task.images] : [];
  renderImageThumbs();
};

// 修改 saveTask，保存图片
const _origSaveTask = saveTask;
saveTask = async function() {
  const taskId = editingTaskId || Store.generateId();

  // 先保存待上传的新图片
  const savedFilenames = [];
  for (const base64 of pendingImages) {
    const filename = await window.todoAPI.saveImage(taskId, base64);
    if (filename) savedFilenames.push(filename);
  }

  // 删除在编辑中被移除的已有图片
  if (editingTaskId) {
    const task = Store.getById(editingTaskId);
    if (task && task.images) {
      for (const oldFile of task.images) {
        if (!existingImages.includes(oldFile)) {
          await window.todoAPI.deleteImage(editingTaskId, oldFile);
        }
      }
    }
  }

  // 合并最终图片列表
  const allImages = [...existingImages, ...savedFilenames];

  // 保存到任务数据中（如果新增，需要等 saveTask 创建了任务再更新 images）
  if (editingTaskId) {
    Store.update(editingTaskId, { images: allImages });
  }

  _origSaveTask();

  // 新增任务的情况，saveTask 里 Store.add 会创建任务，我们需要更新 images
  if (!editingTaskId) {
    // 找到刚创建的任务（最后一条）
    const newTask = Store.tasks[Store.tasks.length - 1];
    if (newTask && savedFilenames.length > 0) {
      Store.update(newTask.id, { images: savedFilenames });
    }
  }

  pendingImages = [];
  existingImages = [];
};

// 修改 createTaskCard，添加缩略图
const _origCreateTaskCard = createTaskCard;
createTaskCard = function(task) {
  const card = _origCreateTaskCard(task);

  // 添加图片缩略图
  if (task.images && task.images.length > 0) {
    const imagesDiv = document.createElement('div');
    imagesDiv.className = 'task-card-images';

    const maxShow = 3;
    task.images.slice(0, maxShow).forEach((filename, idx) => {
      loadCardThumb(imagesDiv, task.id, filename, idx);
    });

    if (task.images.length > maxShow) {
      const more = document.createElement('div');
      more.className = 'task-card-thumb-more';
      more.textContent = `+${task.images.length - maxShow}`;
      more.addEventListener('click', (e) => {
        e.stopPropagation();
        openImageViewer(task.id, 0);
      });
      imagesDiv.appendChild(more);
    }

    card.appendChild(imagesDiv);
  }

  return card;
};

// 加载卡片缩略图
async function loadCardThumb(container, taskId, filename, idx) {
  const base64 = await window.todoAPI.readImage(taskId, filename);
  if (!base64) return;
  const img = document.createElement('img');
  img.className = 'task-card-thumb';
  img.src = base64;
  img.addEventListener('click', (e) => {
    e.stopPropagation();
    openImageViewer(taskId, idx);
  });
  container.appendChild(img);
}

// 打开图片查看器
async function openImageViewer(taskId, startIdx) {
  const task = Store.getById(taskId);
  if (!task || !task.images || task.images.length === 0) return;

  viewerTaskId = taskId;
  viewerImages = [];
  viewerIndex = startIdx;

  // 加载所有图片的 base64
  for (const filename of task.images) {
    const base64 = await window.todoAPI.readImage(taskId, filename);
    if (base64) viewerImages.push({ filename, base64 });
  }

  if (viewerImages.length === 0) return;

  document.getElementById('imageViewerOverlay').classList.add('show');
  updateViewerImage();
}

// 更新查看器中的图片
function updateViewerImage() {
  if (viewerImages.length === 0) return;
  const item = viewerImages[viewerIndex];
  document.getElementById('viewerImage').src = item.base64;
  document.getElementById('viewerCounter').textContent = `${viewerIndex + 1} / ${viewerImages.length}`;
}

// 切换图片
function navigateViewer(delta) {
  viewerIndex = (viewerIndex + delta + viewerImages.length) % viewerImages.length;
  updateViewerImage();
}

// 删除查看器中的图片
async function deleteViewerImage() {
  if (!viewerTaskId || viewerImages.length === 0) return;

  const item = viewerImages[viewerIndex];
  await window.todoAPI.deleteImage(viewerTaskId, item.filename);

  const task = Store.getById(viewerTaskId);
  if (task && task.images) {
    const newImages = task.images.filter(f => f !== item.filename);
    Store.update(viewerTaskId, { images: newImages });
  }

  viewerImages.splice(viewerIndex, 1);

  if (viewerImages.length === 0) {
    closeImageViewer();
    renderBoard();
    return;
  }

  if (viewerIndex >= viewerImages.length) viewerIndex = viewerImages.length - 1;
  updateViewerImage();
  renderBoard();
}

// 关闭查看器
function closeImageViewer() {
  document.getElementById('imageViewerOverlay').classList.remove('show');
  // 恢复查看器控件
  document.getElementById('viewerPrev').style.display = '';
  document.getElementById('viewerNext').style.display = '';
  document.getElementById('viewerDelete').style.display = '';
  viewerTaskId = null;
  viewerImages = [];
  viewerIndex = 0;
}
