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

---

⭐ If you like this project, don't forget to give it a star!
