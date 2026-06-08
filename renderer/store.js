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
      images: [],
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
    if (updates.images !== undefined) task.images = updates.images;

    this.save();
    return task;
  },

  // 删除任务
  async remove(id) {
    const index = this.tasks.findIndex(t => t.id === id);
    if (index === -1) return false;
    this.tasks.splice(index, 1);
    this.save();
    // 清理图片文件
    await window.todoAPI.deleteImageDir(id);
    return true;
  },

  // 按状态筛选
  getByStatus(status) {
    return this.tasks.filter(t => t.status === status);
  }
};
