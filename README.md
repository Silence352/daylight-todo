# Daylight

A progressively enhanced to-do application that started as a simple browser-based task list and evolved into an AI-powered workspace with cloud sync.

**Current version: v6** — Accounts, cloud storage, local-to-cloud sync, and AI task extraction.

---

## What is Daylight?

Daylight began as a fork of [simple-to-do-list](https://github.com/Serkanbyx/simple-to-do-list) by Serkan Bayraktar. Through six iterations it grew from a pure frontend app into a full-stack workspace:

- **v1**: Warm theme redesign with bilingual support (Chinese/English)
- **v2**: Three-column dashboard with projects, priorities, and progress tracking
- **v3**: Focus mode with 25/45-minute timers
- **v4**: AI-powered task extraction from natural language
- **v5**: User accounts and cloud task storage
- **v6**: Local-to-cloud sync with deduplication

Each version preserves the previous capabilities while adding new ones.

---

## Quick Start

### Prerequisites

- Node.js 18+ (for v4-v6 server features)
- An OpenAI-compatible API endpoint (for v4 AI extraction)

### Installation

```bash
# Clone this repository
git clone https://github.com/Silence352/daylight-todo.git
cd daylight-todo

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings (see Configuration section)

# Start the server
npm start
```

Visit `http://localhost:8106`

### Configuration

Edit `.env` before starting:

| Variable | Required | Description | Example |
| --- | --- | --- | --- |
| `PORT` | No | Server port (default: 8106) | `8106` |
| `MODEL_BASE_URL` | For AI features | OpenAI-compatible API base URL | `https://api.example.com` |
| `MODEL_NAME` | For AI features | Model identifier | `gpt-4o-mini` |
| `MODEL_API_KEY` | For AI features | API authentication key | `sk-...` |
| `SESSION_SECRET` | For accounts | Random secret for session tokens | `your-random-string` |
| `DB_PATH` | No | SQLite database location | `server/data/daylight.db` |
| `NODE_ENV` | No | Environment mode | `development` |

**Security**: Never commit `.env` or expose `MODEL_API_KEY` / `SESSION_SECRET` publicly.

---

## Features by Version

### v1: Warm Theme & Bilingual Support

- Redesigned UI with warm dawn colors (soft whites, golden accents)
- Chinese as default language, toggle to English
- Language preference persists across sessions
- Retained all original features: add/edit/delete tasks, drag-and-drop, filters

### v2: Dashboard Layout

- **Three-column interface**:
  - Left: Project list and filter
  - Center: Today's priority tasks and full task list
  - Right: Progress indicators and statistics
- **Extended task fields**:
  - Priority level (low/medium/high)
  - Due dates
  - Estimated duration
- **Data migration**: Existing v1 tasks automatically upgraded with default values
- **Responsive**: Collapses to single column on mobile

### v3: Focus Mode

- Select a priority task and start a focus session (25 or 45 minutes)
- Full-screen focus view hides other tasks
- Pause/resume/end controls
- Session state survives page refresh (persists timer and remaining time)

### v4: AI Task Extraction

Natural language input → structured task drafts.

**How it works**:
1. User types: *"Morning: fix login bug (1h). Afternoon: review token logic, write tests."*
2. Click "Extract Tasks" button
3. AI generates editable draft cards with suggested project, priority, duration
4. User reviews, edits, and selects which drafts to add

**Architecture**:
- Backend route: `POST /api/task-extractions`
- Model client: OpenAI-compatible API (configured via `.env`)
- Pure function parser: `server/modules/taskExtractor.js`
- Frontend: Draft review UI with checkboxes, never auto-creates tasks

**Failure handling**: If API key missing, returns 503. If model unreachable or invalid response, returns 502 with user input preserved.

### v5: Accounts & Cloud Workspace

**Authentication**:
- Email + password registration and login
- No email verification required (simple development flow)
- bcrypt password hashing (10 rounds)
- Session tokens (32-byte random hex)

**Cloud storage**:
- Server-side SQLite database (`server/data/daylight.db`)
- Three tables: `users`, `cloud_tasks`, `sessions`
- User isolation: each user's tasks are completely separate

**Dual workspace**:
- Local tasks: browser localStorage (works offline)
- Cloud tasks: server database (accessible across devices)
- User chooses when to sign in; local tasks remain usable without an account

**API routes**:
- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Sign in, receive session token
- `POST /api/auth/logout` — End session
- `GET /api/auth/me` — Current user info
- `/api/cloud/tasks` — Full CRUD (GET, POST, PUT, DELETE) for cloud tasks

### v6: Local-to-Cloud Sync

Explicit, user-triggered sync that merges local browser tasks into the cloud workspace.

**Sync behavior**:
- **Explicit**: User clicks "Sync to Cloud" after login
- **Append-only**: Adds local tasks to cloud; never deletes existing cloud tasks
- **Deduplication**: Matches by task ID; skips tasks already in cloud
- **Idempotent**: Running sync multiple times doesn't create duplicates
- **Confirmation**: Shows count of tasks to sync before proceeding

**Implementation** (`POST /api/cloud/sync`):
1. Frontend sends array of local tasks
2. Server fetches user's existing cloud tasks
3. Filters out tasks already present (by ID)
4. Inserts new tasks with `(task_id, user_id)` composite key
5. Returns summary: total sent, new inserted, skipped

**Use case**: Work offline on Device A, sign in on Device B → sync brings tasks from A to cloud, accessible from B.

---

## Architecture

### Tech Stack

**Frontend**:
- Vanilla JavaScript (ES6+), no framework
- CSS custom properties for theming
- LocalStorage for offline persistence
- Responsive grid layout

**Backend** (v4+):
- Node.js + Express
- SQLite (better-sqlite3) for data
- bcrypt for password hashing
- OpenAI-compatible client for AI features

**Testing**:
- `node:test` (Node.js built-in test runner)
- Unit tests for pure functions
- Integration tests for API routes
- Run with `npm test`

### Project Structure

```
daylight-todo/
├── index.html              # Main application page
├── css/
│   └── style.css          # All styles, CSS variables
├── js/
│   └── app.js             # Frontend application logic
├── server/
│   ├── index.js           # Express entry point
│   ├── auth/              # Authentication logic
│   ├── db/                # Database schema and queries
│   ├── modules/           # Pure functions (task extraction, etc.)
│   ├── routes/            # API route handlers
│   └── test/              # Server-side tests
├── .env.example           # Environment template
└── package.json           # Dependencies and scripts
```

---

## Development

### Running Tests

```bash
npm test
```

Tests cover:
- Task extraction parsing (v4)
- Authentication flow (v5)
- Cloud task CRUD (v5)
- Sync deduplication (v6)

### npm Scripts

- `npm start` — Start server (port from `.env`, default 8106)
- `npm test` — Run all tests
- `npm run dev` — Start with auto-reload (if nodemon configured)

---

## Security

- **Passwords**: hashed with bcrypt before storage, never stored in plaintext
- **Sessions**: 32-byte random tokens, validated on every authenticated request
- **Secrets**: `MODEL_API_KEY` and `SESSION_SECRET` live only in `.env` (never committed)
- **XSS protection**: User input is escaped before DOM insertion
- **SQL injection**: Parameterized queries throughout
- **User isolation**: Cloud tasks always scoped to authenticated user ID

---

## Roadmap

**Completed** (v1-v6):
- ✅ Warm bilingual UI
- ✅ Project organization and priorities
- ✅ Focus mode with persistent timers
- ✅ AI task extraction
- ✅ User accounts
- ✅ Cloud storage
- ✅ Local-to-cloud sync

**Future considerations**:
- [ ] Bidirectional sync (cloud → local merge)
- [ ] Real-time collaboration
- [ ] Mobile native apps
- [ ] Recurring tasks
- [ ] Task attachments

---

## Credits

**Original project**: [simple-to-do-list](https://github.com/Serkanbyx/simple-to-do-list) by [Serkan Bayraktar](https://github.com/Serkanbyx)

**Daylight evolution** (v1-v6): Built with Huawei Cloud CodeArts as a demonstration of AI-assisted iterative development.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

Original project by Serkan Bayraktar, extended work by this fork.

---

## Troubleshooting

### AI extraction returns 503

**Cause**: `MODEL_API_KEY` not configured in `.env`

**Fix**: Add your API key to `.env` and restart the server.

### Database locked errors

**Cause**: Multiple server instances or improper shutdown

**Fix**: Stop all Node processes, delete `server/data/daylight.db-wal` and `-shm` files, restart.

### Port already in use

**Cause**: Another process using port 8106

**Fix**: Change `PORT` in `.env` or stop the conflicting process.

### Tests fail on Windows

**Cause**: `better-sqlite3` native build issues

**Fix**: Ensure Visual Studio Build Tools installed, run `npm rebuild better-sqlite3`

---

## Contributing

This is a demonstration project. If you want to build on it:

1. Fork this repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes with tests
4. Run `npm test` to verify
5. Commit with conventional commits: `feat:`, `fix:`, `docs:`, etc.
6. Push and open a pull request

---

**Questions?** Open an issue on GitHub.
