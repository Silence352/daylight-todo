# Simple To-Do List — Step-by-Step Build Guide

> **Archived: original build playbook.** This document is the original roadmap used to build the Simple To-Do List application. The codebase may have evolved since this guide was written (for example, the drag-and-drop logic has been rewritten to be ID-based). For current setup, architecture, and deployment notes, see [../README.md](../README.md).

---

> **Project Summary:** Simple To-Do List is a fully client-side, modern task management application with zero external dependencies. Users can add tasks, mark them as completed, edit them inline, delete them, reorder them via drag-and-drop, and view tasks through All / Active / Completed filters. Data is persisted with the browser's `localStorage` API. A single centralized `state` object, event delegation, and XSS protection via `escapeHtml` form the core of the application. The dark theme is built on CSS custom properties; accessibility (ARIA, keyboard navigation, `:focus-visible`) and responsive design are treated as first-class concerns.

Each step below is a self-contained prompt. Execute them in order.
Stack: HTML5, CSS3 (Custom Properties, Flexbox, Animations), Vanilla JavaScript (ES6+), LocalStorage API, Google Fonts (Outfit, JetBrains Mono).

---

## Table of Contents

**PHASE 1 — Project Foundation**

- STEP 1 — Project Scaffolding & File Structure
- STEP 2 — Semantic HTML Skeleton

**PHASE 2 — Theme & Styling System**

- STEP 3 — CSS Variables & Reset
- STEP 4 — Layout, Components & Animations

**PHASE 3 — Core Application Logic**

- STEP 5 — State Management & LocalStorage
- STEP 6 — CRUD Operations

**PHASE 4 — Interactions & Rendering**

- STEP 7 — Rendering & XSS-Safe Templates
- STEP 8 — Filters & Statistics
- STEP 9 — Inline Editing & Keyboard Support
- STEP 10 — Drag & Drop Reordering

**PHASE 5 — Polish & Deploy**

- STEP 11 — Accessibility & Responsive Pass
- STEP 12 — Deployment (Netlify / Static Hosting)

**Appendices**

- Appendix A — Shared Constants & Data Model
- Appendix B — Reusable Patterns
- Appendix C — Common Pitfalls
- Appendix D — Pre-flight Checklist

---

## Global Build Rules (apply to EVERY step)

- **No git operations.** Do not run `git` commands, do not commit, and do not push. Version control is handled manually by the user.
- Do not install unapproved packages. This project is intentionally dependency-free; keep it that way.
- Do not run long-running processes (dev servers, watchers) unless explicitly requested.
- Treat every step as self-contained: it states its goal, the files it touches, and an acceptance checklist.
- Prefer native browser APIs over libraries. Use ES6+, arrow functions, `const`/`let`, and template literals.
- Follow DRY: extract repeated logic into small, reusable helper functions.
- Every user-provided string rendered into the DOM MUST be escaped.

---

## Architecture at a Glance

```mermaid
flowchart LR
    User([User]) -->|interacts| UI[index.html + style.css]
    UI -->|DOM events| App[app.js]
    App -->|reads/writes| State[(state object)]
    State -->|render| UI
    App -->|persist JSON| LS[(localStorage)]
    LS -->|load on init| App
    Fonts[Google Fonts] -.->|@import| UI
```

The application has three layers: presentation (`index.html`), styling (`css/style.css`), and logic (`js/app.js`). All state lives in a single in-memory `state` object; on every change the `state` is serialized to `localStorage` and the UI is re-rendered. There is no backend, database, or network call — the app runs entirely offline.

---

# PHASE 1 — PROJECT FOUNDATION

---

## STEP 1 — Project Scaffolding & File Structure

**Goal:** Create a minimal, scalable folder structure.

**Files/folders to create:**

```
simple-to-do-list/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── app.js
└── README.md
```

**Implementation notes:**

- Do not use a build tool, package manager, or transpiler. The files must be openable directly in the browser.
- CSS and JS are linked as external files in the HTML (`<link>` and `<script src>`). Do not use inline styles/scripts.

**Acceptance checklist:**

- [ ] When `index.html` is opened in the browser, `css/style.css` and `js/app.js` load without 404 errors.
- [ ] No console errors.

---

## STEP 2 — Semantic HTML Skeleton

**Goal:** Build an accessible, semantic HTML skeleton.

**Files to edit:** `index.html`

**Implementation notes:**

- Add `<html lang="en">`, `<meta charset>`, `<meta name="viewport">`, and a descriptive `<meta name="description">`.
- Add `preconnect` links for Google Fonts and the Outfit + JetBrains Mono `@import` in the `<head>`.
- Structure the page sections with semantic tags:
  - `<header>`: title and subtitle.
  - `<section class="add-todo-section">`: `<form id="todoForm">` + text input + "Add" button.
  - `<section class="filters-section">`: filter buttons with `role="tablist"` (`data-filter="all|active|completed"`) and a task counter.
  - `<section class="todo-list-section">`: `<ul id="todoList">` and the `#emptyState` empty-state block.
  - `<footer>`: "Clear Completed" button.
- Add `aria-label` to every interactive element. Give filter buttons `role="tab"` and `aria-selected`.
- Add `maxlength="150"` and `autocomplete="off"` to the input.

**Acceptance checklist:**

- [ ] All sections exist with semantic tags.
- [ ] The form, input, and buttons have `aria-label`s.
- [ ] The page is navigable with the keyboard (Tab).

---

# PHASE 2 — THEME & STYLING SYSTEM

---

## STEP 3 — CSS Variables & Reset

**Goal:** Define theme tokens and a base reset.

**Files to edit:** `css/style.css`

**Implementation notes:**

- Define all design tokens as CSS Custom Properties inside `:root`: background colors, accent colors, text colors, status colors (success/danger/warning), border, shadow, border-radius, transition durations, and font variables (see Appendix A).
- Apply a universal reset: `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }`.
- Give `body` a dark-theme background, a radial/linear gradient pattern, and flexbox centering.
- Define `:focus-visible` outline and `::selection` styles for accessibility.

**Acceptance checklist:**

- [ ] Colors are used only through `var(--token)` (no repeated hardcoded hex values).
- [ ] Keyboard focus is visually prominent.

---

## STEP 4 — Layout, Components & Animations

**Goal:** Style all visual components and animations.

**Files to edit:** `css/style.css`

**Implementation notes:**

- Center `.app-container` with a max width (560px); add an entrance animation (`fadeInUp`).
- Component styles: form, input, buttons (`.btn-add`, `.btn-clear`), filter pills, `.todo-item`, custom round checkbox, `.todo-text`, `.todo-edit-input`, hover-revealed `.todo-actions`, `.drag-handle`, `.empty-state`.
- Animations: `slideIn`, `slideOut`, `fadeIn`, `fadeInUp`. Transitions must use `var(--transition-*)`.
- Define class-based indicators for drag-and-drop visual feedback: `.todo-item.dragging`, `.todo-item.drag-over-top`, `.todo-item.drag-over-bottom` (instead of inline style injection).
- Apply `line-through` and reduced opacity on `.completed` for completed tasks.

**Acceptance checklist:**

- [ ] Hover, focus, and completed states are visually distinguishable.
- [ ] Drag visual feedback is done with CSS classes; JS does not write inline styles.

---

# PHASE 3 — CORE APPLICATION LOGIC

---

## STEP 5 — State Management & LocalStorage

**Goal:** Set up the centralized state and persistence layer.

**Files to edit:** `js/app.js`

**Implementation notes:**

- Define a single `state` object: `{ todos: [], currentFilter: 'all', editingId: null }`.
- Define the `STORAGE_KEY` constant (`'simple-todo-list'`).
- Collect DOM references in a single `elements` object.
- Write `loadFromStorage()` and `saveToStorage(todos)` with `try/catch`; return an empty array on read errors.

**Acceptance checklist:**

- [ ] Tasks persist when the page is refreshed.
- [ ] The app does not crash when `localStorage` is corrupted/unavailable.

---

## STEP 6 — CRUD Operations

**Goal:** Write the create, read, update, and delete logic for tasks.

**Files to edit:** `js/app.js`

**Implementation notes:**

- `generateId()`: `Date.now().toString(36) + Math.random().toString(36).slice(2)` (do not use the deprecated `substr`).
- `addTodo(text)`: `trim` the text, ignore if empty, prepend the new todo to `state.todos` (`unshift`), save, and render.
- `toggleTodo(id)`, `deleteTodo(id)` (with exit animation), `clearCompleted()`.
- After each mutation: `saveToStorage` → `renderTodos` → `updateStats`.

**Acceptance checklist:**

- [ ] Adding/deleting/toggling a task is reflected instantly in the UI and in `localStorage`.
- [ ] Empty or whitespace-only text cannot be added.

---

# PHASE 4 — INTERACTIONS & RENDERING

---

## STEP 7 — Rendering & XSS-Safe Templates

**Goal:** Render the task list safely.

**Files to edit:** `js/app.js`

**Implementation notes:**

- `escapeHtml(text)`: create a `<div>`, assign `textContent`, and return `innerHTML`. Every user text written to the DOM must pass through this.
- `createTodoItemHTML(todo)`: a pure function returning separate templates for edit mode and normal mode.
- `renderTodos()`: build the filtered list, show `#emptyState` if empty, otherwise fill `innerHTML` and bind `dragstart`/`dragend` listeners.

**Acceptance checklist:**

- [ ] An input like `<img src=x onerror=alert(1)>` is displayed as text and does not execute.
- [ ] The empty-state block appears when the list is empty.

---

## STEP 8 — Filters & Statistics

**Goal:** Filtering and a live counter.

**Files to edit:** `js/app.js`

**Implementation notes:**

- `setFilter(filter)`: update `state.currentFilter`, set the active button class and `aria-selected`, then call `renderTodos()` and `updateStats()` (keep the counter update in a single place — DRY).
- `getFilteredTodos()`: return a filtered array based on `currentFilter`.
- `updateStats()`: write the counter text based on the filter and show the "Clear" button when there are completed tasks.

**Acceptance checklist:**

- [ ] The counter text updates correctly when the filter changes.
- [ ] The "Clear" button is hidden when there are no completed tasks.

---

## STEP 9 — Inline Editing & Keyboard Support

**Goal:** Inline editing without a modal.

**Files to edit:** `js/app.js`

**Implementation notes:**

- `startEditTodo(id)`: set `state.editingId`, re-render, focus the edit input, and move the caret to the end.
- `saveEditTodo(id, newText)` (cancel if empty) and `cancelEditTodo()`.
- Event delegation: a single `click` listener on `todoList` routes by `data-action` (`toggle|edit|delete|save|cancel`).
- `keydown`: `Enter` saves and `Escape` cancels in the edit input.

**Acceptance checklist:**

- [ ] Editing is saved with Enter and canceled with Escape.
- [ ] Saving with empty text cancels the edit.

---

## STEP 10 — Drag & Drop Reordering

**Goal:** Reorder tasks via drag-and-drop (must work correctly even when a filter is active).

**Files to edit:** `js/app.js`, `css/style.css`

**Implementation notes:**

- Rely on the **todo ID**, not the DOM index. Store `draggedId` on `dragstart`.
- `dragover`: toggle `.drag-over-top` / `.drag-over-bottom` on the target based on the cursor position relative to its midpoint.
- `drop`: find and remove `draggedId` from `state.todos`; re-insert based on the target ID's real position and `insertAfter`. This approach moves the correct item even in a filtered view.
- Clear all visual state with `dragend` and `clearDragIndicators()`.

**Acceptance checklist:**

- [ ] Dragging does not move the wrong item when the "Active" or "Completed" filter is open.
- [ ] The new order is written to `localStorage` after dragging.

---

# PHASE 5 — POLISH & DEPLOY

---

## STEP 11 — Accessibility & Responsive Pass

**Goal:** Harden accessibility and mobile support.

**Files to edit:** `index.html`, `css/style.css`

**Implementation notes:**

- Make sure all action buttons have an `aria-label`; checkbox labels should provide meaningful text based on the completed state.
- `@media (max-width: 480px)`: stack the form vertically, make the button full width, center the filters, and keep action buttons always visible on mobile.
- Keyboard focus must be clear via `:focus-visible`; keep color contrast at WCAG AA level.

**Acceptance checklist:**

- [ ] The app is fully usable with the keyboard alone.
- [ ] The layout does not break below 480px.

---

## STEP 12 — Deployment (Netlify / Static Hosting)

**Goal:** Publish the static site.

**Implementation notes:**

- No build step required; the repository root can be deployed directly.
- Netlify: connect the repository, leave the build command empty, and set the publish directory to the root (`/`).
- For local preview you may use `python -m http.server 8000` or `npx serve` (run only if the user requests it).

**Acceptance checklist:**

- [ ] All assets (CSS, JS, fonts) load on the published URL.
- [ ] `localStorage` persistence works in the live environment.

---

# Appendix A — Shared Constants & Data Model

**Storage key:**

```javascript
const STORAGE_KEY = 'simple-todo-list';
```

**Todo data model:**

```javascript
{
    id: "unique-id",          // produced by generateId()
    text: "Task description", // rendered via escapeHtml
    completed: false,
    createdAt: "ISO date"     // new Date().toISOString()
}
```

**Theme tokens (excerpt):**

```css
:root {
    --color-bg-primary: #0f0f12;
    --color-accent: #00d4aa;
    --color-text-primary: #f5f5f7;
    --color-danger: #ff5b6a;
    --transition-fast: 150ms ease;
    --font-primary: 'Outfit', -apple-system, sans-serif;
    --font-mono: 'JetBrains Mono', monospace;
}
```

---

# Appendix B — Reusable Patterns

- **Event delegation:** Use a single parent listener for dynamic list items; branch by `data-action`. Avoid binding a separate listener to each item.
- **Single source of truth:** All state lives in the `state` object; the UI is always derived from `state` (`render after mutate`).
- **Pure render helpers:** `createTodoItemHTML` and `escapeHtml` are side-effect free and easy to test.
- **CSS-driven feedback:** Visual states (`dragging`, `drag-over-*`, `completed`) are managed via class toggling instead of inline styles in JS.

---

# Appendix C — Common Pitfalls

- **Mistaking the DOM index for the state index:** When a filter is active, the DOM order does not match the `state.todos` order. Always work by ID when reordering.
- **Using `substr`:** Deprecated. Prefer `slice` or `substring`.
- **Skipping escaping:** Writing raw user text into `innerHTML` creates an XSS hole; always pass it through `escapeHtml`.
- **Scattering the counter update:** Manage the `updateStats` call from a single place (`setFilter`); do not repeat it at the call site.

---

# Appendix D — Pre-flight Checklist

- [ ] Adding, completing, editing, and deleting tasks works.
- [ ] All / Active / Completed filters and the counter are correct.
- [ ] Drag-and-drop moves the correct item across all filters.
- [ ] Data persists after refresh (`localStorage`).
- [ ] XSS inputs are displayed as text.
- [ ] Keyboard navigation and focus visibility work.
- [ ] The responsive layout does not break below 480px.
- [ ] No errors/warnings in the console.
