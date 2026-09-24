# ✅ Simple To-Do List

A modern, minimalist, and user-friendly to-do list application. Manage your tasks efficiently with a beautiful dark-themed interface, drag-and-drop functionality, and local storage persistence.

[![Created by Serkanby](https://img.shields.io/badge/Created%20by-Serkanby-blue?style=flat-square)](https://serkanbayraktar.com/)
[![GitHub](https://img.shields.io/badge/GitHub-Serkanbyx-181717?style=flat-square&logo=github)](https://github.com/Serkanbyx)

## Features

- **Full CRUD Operations**: Create, read, update, and delete tasks with smooth animations
- **Local Storage Persistence**: Your tasks are automatically saved and persist across browser sessions
- **Smart Filtering**: Filter tasks by All, Active, or Completed status
- **Drag & Drop Reordering**: Intuitively reorder your tasks with drag and drop functionality
- **Inline Editing**: Edit task text directly without any modal dialogs
- **Bulk Actions**: Clear all completed tasks with a single click
- **Real-Time Statistics**: Track your task count based on current filter
- **Dark Theme UI**: Modern, eye-friendly dark interface with accent colors
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Accessibility Support**: Full keyboard navigation and ARIA labels for screen readers
- **XSS Protection**: Built-in HTML escaping for secure task input

## Live Demo

[🎮 View Live Demo](https://simple-to-do-listt.netlify.app/)

## Technologies

- **HTML5**: Semantic and accessible markup structure
- **CSS3**: Modern CSS features including CSS Variables, Flexbox, Grid, and custom animations
- **Vanilla JavaScript (ES6+)**: Pure JavaScript with no dependencies, utilizing modern ES6+ features
- **LocalStorage API**: Browser-native data persistence for offline functionality
- **Google Fonts**: Outfit and JetBrains Mono fonts for enhanced typography

## Installation

### Local Development

1. Clone the repository:

```bash
git clone https://github.com/Serkanbyx/simple-to-do-list.git
```

2. Navigate to the project directory:

```bash
cd simple-to-do-list
```

3. Open `index.html` in your browser:

**Option A - Using Python:**

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

**Option B - Using Node.js:**

```bash
npx serve
```

Then open the provided URL in your browser.

**Option C - Using VS Code:**
Install the "Live Server" extension and click "Go Live" in the status bar.

**Option D - Direct Opening:**
Simply double-click `index.html` or drag it into your browser.

## Usage

1. **Add a Task**: Type your task in the input field and click the "Add" button or press Enter
2. **Complete a Task**: Click the circular checkbox on the left side of any task
3. **Edit a Task**: Hover over a task and click the edit (pencil) icon, then modify the text
4. **Delete a Task**: Hover over a task and click the delete (trash) icon
5. **Filter Tasks**: Use the filter buttons (All/Active/Completed) to view specific tasks
6. **Reorder Tasks**: Drag and drop tasks to change their order
7. **Clear Completed**: Click "Clear Completed" to remove all completed tasks

## How It Works?

### State Management

The application uses a simple state object to manage all data:

```javascript
const state = {
  todos: [], // Array of todo objects
  currentFilter: "all", // Current filter: 'all', 'active', 'completed'
  editingId: null, // ID of the task being edited
};
```

### Data Persistence

Tasks are automatically saved to LocalStorage whenever changes occur:

```javascript
const saveToStorage = (todos) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
};
```

### Todo Object Structure

Each task is stored as an object with the following properties:

```javascript
{
    id: "unique-id",           // Generated unique identifier
    text: "Task description",  // Task content
    completed: false,          // Completion status
    createdAt: "ISO date"      // Creation timestamp
}
```

### Event Delegation

The application uses event delegation for efficient event handling on dynamic content:

```javascript
elements.todoList.addEventListener("click", handleTodoListClick);
```

## Customization

### Change Theme Colors

Modify the CSS variables in `css/style.css` to customize the color scheme:

```css
:root {
  --color-bg-primary: #0f0f12; /* Main background */
  --color-accent: #00d4aa; /* Accent color (teal) */
  --color-text-primary: #f5f5f7; /* Primary text */
  --color-danger: #ff5b6a; /* Delete button color */
}
```

### Change Fonts

Update the font imports in `index.html` and CSS variables:

```css
:root {
  --font-primary: "Outfit", -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", monospace;
}
```

### Modify Animation Timing

Adjust transition speeds in the CSS variables:

```css
:root {
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
  --transition-slow: 400ms ease;
}
```

## Features in Detail

### Completed Features

- [x] Add new tasks with validation
- [x] Mark tasks as complete/incomplete
- [x] Edit existing tasks inline
- [x] Delete individual tasks with animation
- [x] Filter by All/Active/Completed
- [x] Drag and drop reordering
- [x] LocalStorage persistence
- [x] Clear all completed tasks
- [x] Responsive mobile design
- [x] Keyboard accessibility
- [x] XSS protection

### Future Features

- [ ] Due dates and reminders
- [ ] Task categories/labels
- [ ] Dark/Light theme toggle
- [ ] Export/Import tasks
- [ ] Cloud synchronization
- [ ] Task priority levels

## Contributing

Contributions are welcome! Here's how you can help:

1. Fork the repository
2. Create a feature branch:

```bash
git checkout -b feat/amazing-feature
```

3. Commit your changes:

```bash
git commit -m "feat: add amazing feature"
```

4. Push to the branch:

```bash
git push origin feat/amazing-feature
```

5. Open a Pull Request

### Commit Message Format

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `chore:` Maintenance tasks

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Developer

**Serkan Bayraktar**

- Website: [serkanbayraktar.com](https://serkanbayraktar.com/)
- GitHub: [@Serkanbyx](https://github.com/Serkanbyx)
- Email: serkanbyx1@gmail.com

## Acknowledgments

- [Google Fonts](https://fonts.google.com/) - Outfit and JetBrains Mono fonts
- [Shields.io](https://shields.io/) - Badges for README
- Design inspiration from modern productivity applications

## Contact

Have questions or suggestions?

- Open an [Issue](https://github.com/Serkanbyx/simple-to-do-list/issues)
- Email: serkanbyx1@gmail.com
- Website: [serkanbayraktar.com](https://serkanbayraktar.com/)

## v4 Smart Task Extraction（智能拆解）

v4 在 v3 专注流程基础上新增「智能拆解」能力：在顶部输入框用自然语言描述任务，点击「智能拆解」按钮，服务端调用 OpenAI 兼容模型生成可编辑的草稿卡片，用户勾选并点「添加到今日」后才会写入工作区。模型只产生草稿，绝不自动创建/删除/改写任务。

### 架构

- **服务端（`server/`）**：Express 入口 + `POST /api/task-extractions` 路由。模型客户端（`modelClient.js`）按 OpenAI 兼容协议请求；草稿解析与规范化（`taskExtractor.js`）为纯函数模块。密钥只在服务端 `process.env`，绝不进入前端。
- **前端**：顶部新增「智能拆解」按钮 + 主栏 `#extractionResults` 草稿区。失败时保留用户原始输入并展示真实错误，绝不伪造草稿、绝不静默降级。
- **测试**：`server/test/` 用 `node:test` + 内置 mock，覆盖纯函数与路由处理函数（53 项全部通过）。

### 启动

```bash
# 1. 安装依赖
npm install

# 2. 配置模型密钥（复制示例并填写）
cp .env.example .env
# 编辑 .env 填入 MODEL_BASE_URL / MODEL_NAME / MODEL_API_KEY

# 3. 启动服务
npm start

# 4. 访问
# http://localhost:8106
```

### 环境变量

| 变量 | 说明 | 示例 |
| --- | --- | --- |
| `PORT` | 服务监听端口（默认 8106） | `8106` |
| `MODEL_BASE_URL` | OpenAI 兼容模型服务基础地址 | `https://api.example.com` |
| `MODEL_NAME` | 模型名 | `gpt-4o-mini` |
| `MODEL_API_KEY` | 模型密钥（**仅在服务端，绝不提交**） | `sk-...` |

### 已知限制

- 未配置 `MODEL_API_KEY` 时，点击「智能拆解」会返回 503 并提示「智能拆解未配置」，不会伪造任何草稿。
- 模型服务不可达 / 超时 / 返回无效 JSON 时返回 502，前端保留用户输入并提示重试。
- 草稿的「项目」字段为字符串名称：添加到今日时若名称匹配已有项目则归入，否则自动新建同名项目。

### 运行测试

```bash
npm test
```

---

## v5 Accounts and Cloud Workspace（账号登录与云端工作区）

v5 adds user authentication and cloud task storage. Users can work offline with local tasks and optionally sign in to save tasks to the server. Login uses email + password (no email verification required in this version). Cloud tasks are stored in SQLite with user isolation.

### New Features

- **Email/Password Authentication**: Simple registration and login flow
- **Cloud Task Storage**: Persistent server-side task storage with SQLite
- **User Isolation**: Each user's tasks are completely separated
- **Session Management**: Secure session tokens with configurable expiry
- **Dual Workspace**: Local tasks (browser storage) + Cloud tasks (server database)

### Architecture

- **Server Auth (`server/auth/`)**: 
  - `password.js`: bcrypt-based password hashing with configurable rounds
  - `session.js`: Session token generation and validation
  - `middleware.js`: Request authentication middleware
- **Server Database (`server/db/`)**: 
  - `database.js`: SQLite connection pooling and schema initialization
  - Tables: `users`, `cloud_tasks`, `sessions`
- **Server Routes (`server/routes/`)**: 
  - `POST /api/auth/register`: Create new account
  - `POST /api/auth/login`: Sign in and get session token
  - `POST /api/auth/logout`: End session
  - `GET /api/auth/me`: Get current user info
  - Full CRUD for `/api/cloud/tasks` (GET, POST, PUT, DELETE)
- **Frontend**: Login modal, cloud workspace UI, separate local/cloud task lists

### Environment Variables (v5)

| Variable | Description | Example |
| --- | --- | --- |
| `SESSION_SECRET` | Secret key for session tokens | `your-random-secret-here` |
| `DB_PATH` | SQLite database file path | `server/data/daylight.db` |
| `NODE_ENV` | Environment mode | `development` or `production` |

### Security Notes

- Passwords are hashed with bcrypt (rounds=10)
- Session tokens are 32-byte random hex strings
- API key and session secret must NOT be committed to git
- User input is sanitized before database operations
- Cloud tasks are always scoped to authenticated user

---

## v6 Local-to-Cloud Sync（本地任务同步）

v6 adds explicit sync capability: users can push their local browser tasks to the cloud workspace with a single click. The sync operation is append-only, idempotent, and preserves both local and cloud tasks.

### Sync Behavior

- **Explicit Trigger**: User clicks "Sync to Cloud" button after login
- **Append-Only**: Local tasks are added to cloud; existing cloud tasks are preserved
- **Deduplication**: Tasks are matched by immutable ID to prevent duplicates
- **Idempotent**: Running sync multiple times does not create duplicate tasks
- **Confirmation Dialog**: Shows how many local tasks will be synced before proceeding

### Implementation

- **Route**: `POST /api/cloud/sync`
- **Logic** (`server/routes/sync.js`):
  1. Receive array of local tasks from frontend
  2. Fetch existing cloud tasks for the authenticated user
  3. Filter out tasks that already exist (match by task ID)
  4. Insert only new tasks with `(task_id, user_id)` as composite key
  5. Return sync summary (total sent, new inserted, skipped duplicates)
- **Database**: `cloud_tasks` table uses `(task_id, user_id)` as composite primary key to enforce uniqueness per user

### Usage Flow

1. User works offline with local tasks (browser localStorage)
2. User signs in or registers
3. User clicks "Sync to Cloud" button
4. Confirmation modal shows: "X local tasks will be synced"
5. After sync: both local and cloud workspaces contain the tasks
6. On another device: sign in to access cloud tasks

### Testing

```bash
npm test
```

All tests pass, including sync deduplication and idempotency checks.

---

## Current Version

This repository is at **v6** with the following capabilities:

- ✅ v1-v3: Basic CRUD, filtering, drag-and-drop, focus mode
- ✅ v4: AI-powered natural language task extraction
- ✅ v5: User accounts and cloud task storage
- ✅ v6: Local-to-cloud explicit sync with deduplication

---

⭐ If you like this project, don't forget to give it a star!
