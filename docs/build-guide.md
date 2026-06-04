# Simple To-Do List — Step-by-Step Build Guide

> **Archived: original build playbook.** Bu belge, Simple To-Do List uygulamasını sıfırdan inşa etmek için kullanılan orijinal yol haritasıdır. Kod tabanı bu kılavuz yazıldıktan sonra gelişmiş olabilir (örneğin sürükle-bırak mantığı ID tabanlı olacak şekilde yeniden yazılmıştır). Güncel kurulum, mimari ve dağıtım notları için bkz. [../README.md](../README.md).

---

> **Project Summary:** Simple To-Do List, hiçbir harici bağımlılığı olmayan, tamamen istemci tarafında çalışan modern bir görev yönetim uygulamasıdır. Kullanıcılar görev ekleyebilir, tamamlandı olarak işaretleyebilir, satır içi düzenleyebilir, silebilir, sürükle-bırak ile yeniden sıralayabilir ve görevleri Tümü / Aktif / Tamamlanan filtreleriyle görüntüleyebilir. Veriler tarayıcının `localStorage` API'si ile kalıcı olarak saklanır. Tek bir merkezi `state` objesi, event delegation ve `escapeHtml` ile XSS koruması uygulamanın çekirdeğini oluşturur. Koyu tema, CSS değişkenleri üzerine kurulmuştur; erişilebilirlik (ARIA, klavye navigasyonu, `:focus-visible`) ve responsive tasarım öncelikli tutulmuştur.

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

Uygulama üç katmandan oluşur: sunum (`index.html`), stil (`css/style.css`) ve mantık (`js/app.js`). Tüm durum bellekteki tek bir `state` objesinde tutulur; her değişiklikte `state` `localStorage`'a serileştirilir ve arayüz yeniden render edilir. Backend, veritabanı veya ağ çağrısı yoktur — uygulama tamamen çevrimdışı çalışır.

---

# PHASE 1 — PROJECT FOUNDATION

---

## STEP 1 — Project Scaffolding & File Structure

**Goal:** Minimal, ölçeklenebilir bir klasör yapısı oluştur.

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

- Build aracı, paket yöneticisi veya transpiler kullanma. Dosyalar tarayıcıda doğrudan açılabilir olmalı.
- CSS ve JS, HTML'e harici dosyalar olarak bağlanır (`<link>` ve `<script src>`). Inline stil/script kullanma.

**Acceptance checklist:**

- [ ] `index.html` tarayıcıda açıldığında 404 vermeden `css/style.css` ve `js/app.js` yükleniyor.
- [ ] Konsol hatası yok.

---

## STEP 2 — Semantic HTML Skeleton

**Goal:** Erişilebilir, anlamsal HTML iskeletini kur.

**Files to edit:** `index.html`

**Implementation notes:**

- `<html lang="tr">`, `<meta charset>`, `<meta name="viewport">` ve açıklayıcı bir `<meta name="description">` ekle.
- Google Fonts için `preconnect` linkleri ve Outfit + JetBrains Mono `@import`'unu `<head>`'e ekle.
- Sayfa bölümlerini anlamsal etiketlerle yapılandır:
  - `<header>`: başlık ve alt başlık.
  - `<section class="add-todo-section">`: `<form id="todoForm">` + metin girişi + "Ekle" butonu.
  - `<section class="filters-section">`: `role="tablist"` ile filtre butonları (`data-filter="all|active|completed"`) ve görev sayacı.
  - `<section class="todo-list-section">`: `<ul id="todoList">` ve `#emptyState` boş durum bloğu.
  - `<footer>`: "Tamamlananları Temizle" butonu.
- Tüm etkileşimli elementlere `aria-label` ekle. Filtre butonlarına `role="tab"` ve `aria-selected` ver.
- Input'a `maxlength="150"` ve `autocomplete="off"` ekle.

**Acceptance checklist:**

- [ ] Tüm bölümler anlamsal etiketlerle mevcut.
- [ ] Form, input ve butonların `aria-label`'ları var.
- [ ] Sayfa klavyeyle (Tab) gezilebiliyor.

---

# PHASE 2 — THEME & STYLING SYSTEM

---

## STEP 3 — CSS Variables & Reset

**Goal:** Tema tokenlarını ve temel sıfırlamayı tanımla.

**Files to edit:** `css/style.css`

**Implementation notes:**

- `:root` içinde tüm tasarım tokenlarını CSS Custom Properties olarak tanımla: arka plan renkleri, accent renkler, metin renkleri, durum renkleri (success/danger/warning), border, shadow, border-radius, geçiş süreleri ve font değişkenleri (bkz. Appendix A).
- Evrensel reset uygula: `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }`.
- `body`'ye koyu tema arka planı, radial/linear gradient deseni ve flexbox merkezleme ekle.
- Erişilebilirlik için `:focus-visible` outline ve `::selection` stillerini tanımla.

**Acceptance checklist:**

- [ ] Renkler yalnızca `var(--token)` üzerinden kullanılıyor (hardcoded hex tekrarları yok).
- [ ] Klavye odağı görsel olarak belirgin.

---

## STEP 4 — Layout, Components & Animations

**Goal:** Tüm görsel bileşenleri ve animasyonları stille.

**Files to edit:** `css/style.css`

**Implementation notes:**

- `.app-container`'ı maksimum genişlikle (560px) ortala; giriş animasyonu (`fadeInUp`) ekle.
- Bileşen stilleri: form, input, butonlar (`.btn-add`, `.btn-clear`), filtre pill'leri, `.todo-item`, özel yuvarlak checkbox, `.todo-text`, `.todo-edit-input`, hover ile beliren `.todo-actions`, `.drag-handle`, `.empty-state`.
- Animasyonlar: `slideIn`, `slideOut`, `fadeIn`, `fadeInUp`. Geçişler `var(--transition-*)` kullanmalı.
- Sürükle-bırak görsel geri bildirimi için class tabanlı göstergeler tanımla: `.todo-item.dragging`, `.todo-item.drag-over-top`, `.todo-item.drag-over-bottom` (inline stil enjeksiyonu yerine).
- Tamamlanmış görev için `.completed` üzerinde `line-through` ve azaltılmış opaklık.

**Acceptance checklist:**

- [ ] Hover, focus ve completed durumları görsel olarak ayırt edilebiliyor.
- [ ] Görsel sürükleme geri bildirimi CSS class'larıyla yapılıyor, JS inline stil yazmıyor.

---

# PHASE 3 — CORE APPLICATION LOGIC

---

## STEP 5 — State Management & LocalStorage

**Goal:** Merkezi durum ve kalıcılık katmanını kur.

**Files to edit:** `js/app.js`

**Implementation notes:**

- Tek bir `state` objesi tanımla: `{ todos: [], currentFilter: 'all', editingId: null }`.
- `STORAGE_KEY` sabitini tanımla (`'simple-todo-list'`).
- DOM referanslarını tek bir `elements` objesinde topla.
- `loadFromStorage()` ve `saveToStorage(todos)` fonksiyonlarını `try/catch` ile yaz; okuma hatasında boş dizi döndür.

**Acceptance checklist:**

- [ ] Sayfa yenilendiğinde görevler korunuyor.
- [ ] `localStorage` bozuk/erişilemez olduğunda uygulama çökmüyor.

---

## STEP 6 — CRUD Operations

**Goal:** Görev oluşturma, okuma, güncelleme ve silme mantığını yaz.

**Files to edit:** `js/app.js`

**Implementation notes:**

- `generateId()`: `Date.now().toString(36) + Math.random().toString(36).slice(2)` (deprecated `substr` kullanma).
- `addTodo(text)`: metni `trim` et, boşsa yoksay, yeni todo'yu `state.todos`'un başına ekle (`unshift`), kaydet ve render et.
- `toggleTodo(id)`, `deleteTodo(id)` (çıkış animasyonu ile), `clearCompleted()`.
- Her mutasyon sonrası: `saveToStorage` → `renderTodos` → `updateStats`.

**Acceptance checklist:**

- [ ] Görev ekleme/silme/işaretleme anında arayüze ve `localStorage`'a yansıyor.
- [ ] Boş veya yalnızca boşluktan oluşan metin eklenemiyor.

---

# PHASE 4 — INTERACTIONS & RENDERING

---

## STEP 7 — Rendering & XSS-Safe Templates

**Goal:** Görev listesini güvenli şekilde render et.

**Files to edit:** `js/app.js`

**Implementation notes:**

- `escapeHtml(text)`: bir `<div>` oluşturup `textContent` atayarak `innerHTML` döndür. DOM'a yazılan tüm kullanıcı metinleri bundan geçmeli.
- `createTodoItemHTML(todo)`: düzenleme modu ve normal mod için ayrı şablonlar döndüren saf fonksiyon.
- `renderTodos()`: filtrelenmiş listeyi üret, boşsa `#emptyState`'i göster, aksi halde `innerHTML`'i doldur ve `dragstart`/`dragend` dinleyicilerini bağla.

**Acceptance checklist:**

- [ ] `<img src=x onerror=alert(1)>` gibi bir girdi metin olarak görüntüleniyor, çalışmıyor.
- [ ] Liste boşken boş durum bloğu görünüyor.

---

## STEP 8 — Filters & Statistics

**Goal:** Filtreleme ve canlı sayaç.

**Files to edit:** `js/app.js`

**Implementation notes:**

- `setFilter(filter)`: `state.currentFilter`'ı güncelle, aktif buton class'ını ve `aria-selected`'ı ayarla, ardından `renderTodos()` ve `updateStats()` çağır (sayaç güncellemesini tek noktada tut — DRY).
- `getFilteredTodos()`: `currentFilter`'a göre filtrelenmiş dizi döndür.
- `updateStats()`: filtreye göre sayaç metnini yaz ve tamamlanan varsa "Temizle" butonunu göster.

**Acceptance checklist:**

- [ ] Filtre değişiminde sayaç metni doğru güncelleniyor.
- [ ] Tamamlanan görev yokken "Temizle" butonu gizli.

---

## STEP 9 — Inline Editing & Keyboard Support

**Goal:** Modal olmadan satır içi düzenleme.

**Files to edit:** `js/app.js`

**Implementation notes:**

- `startEditTodo(id)`: `state.editingId`'i ayarla, yeniden render et, edit input'a focus ver ve imleci sona taşı.
- `saveEditTodo(id, newText)` (boşsa iptal) ve `cancelEditTodo()`.
- Event delegation: `todoList` üzerinde tek `click` dinleyicisi `data-action` (`toggle|edit|delete|save|cancel`) ile yönlendirme yapar.
- `keydown`: edit input'ta `Enter` kaydeder, `Escape` iptal eder.

**Acceptance checklist:**

- [ ] Düzenleme Enter ile kaydediliyor, Escape ile iptal ediliyor.
- [ ] Boş metinle kaydetme düzenlemeyi iptal ediyor.

---

## STEP 10 — Drag & Drop Reordering

**Goal:** Görevleri sürükle-bırak ile yeniden sırala (filtre aktifken bile doğru çalışmalı).

**Files to edit:** `js/app.js`, `css/style.css`

**Implementation notes:**

- DOM indeksine değil, **todo ID'sine** dayan. `dragstart`'ta `draggedId`'i sakla.
- `dragover`: hedef öğenin orta noktasına göre `.drag-over-top` / `.drag-over-bottom` class'ını toggle et.
- `drop`: `draggedId`'i `state.todos` içinde bul ve çıkar; hedef ID'nin gerçek pozisyonuna göre `insertAfter`'a bakarak yeniden ekle. Bu yaklaşım, filtrelenmiş görünümde de doğru öğeyi taşır.
- `dragend` ve `clearDragIndicators()` ile tüm görsel durumları temizle.

**Acceptance checklist:**

- [ ] "Aktif" veya "Tamamlanan" filtresi açıkken sürükleme yanlış öğeyi taşımıyor.
- [ ] Sürükleme sonrası yeni sıra `localStorage`'a yazılıyor.

---

# PHASE 5 — POLISH & DEPLOY

---

## STEP 11 — Accessibility & Responsive Pass

**Goal:** a11y ve mobil uyumu sağlamlaştır.

**Files to edit:** `index.html`, `css/style.css`

**Implementation notes:**

- Tüm aksiyon butonlarının `aria-label`'ı olduğundan emin ol; checkbox label'ları completed durumuna göre anlamlı metin versin.
- `@media (max-width: 480px)`: formu dikey yap, butonu tam genişlik yap, filtreleri ortala, action butonlarını mobilde her zaman görünür kıl.
- `:focus-visible` ile klavye odağı net olmalı; renk kontrastlarını WCAG AA seviyesinde tut.

**Acceptance checklist:**

- [ ] Uygulama yalnızca klavye ile tam kullanılabiliyor.
- [ ] 480px altında düzen bozulmuyor.

---

## STEP 12 — Deployment (Netlify / Static Hosting)

**Goal:** Statik siteyi yayına al.

**Implementation notes:**

- Build adımı gerektirmez; depo kökü doğrudan yayınlanabilir.
- Netlify: depoyu bağla, build command boş, publish directory kök (`/`).
- Alternatif olarak lokal önizleme için `python -m http.server 8000` veya `npx serve` kullanılabilir (yalnızca kullanıcı isterse çalıştır).

**Acceptance checklist:**

- [ ] Yayınlanan URL'de tüm varlıklar (CSS, JS, fontlar) yükleniyor.
- [ ] `localStorage` kalıcılığı canlı ortamda çalışıyor.

---

# Appendix A — Shared Constants & Data Model

**Storage key:**

```javascript
const STORAGE_KEY = 'simple-todo-list';
```

**Todo data model:**

```javascript
{
    id: "unique-id",          // generateId() ile üretilir
    text: "Task description", // escapeHtml ile render edilir
    completed: false,
    createdAt: "ISO date"     // new Date().toISOString()
}
```

**Theme tokens (özet):**

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

- **Event delegation:** Dinamik liste öğeleri için tek bir üst dinleyici kullan; `data-action` ile dallan. Her öğeye ayrı dinleyici bağlamaktan kaçın.
- **Single source of truth:** Tüm durum `state` objesinde; arayüz her zaman `state`'ten türetilir (`render after mutate`).
- **Pure render helpers:** `createTodoItemHTML` ve `escapeHtml` yan etkisizdir, kolayca test edilebilir.
- **CSS-driven feedback:** Görsel durumlar (`dragging`, `drag-over-*`, `completed`) JS'te inline stil yerine class toggling ile yönetilir.

---

# Appendix C — Common Pitfalls

- **DOM indeksini state indeksi sanmak:** Filtre aktifken DOM sırası `state.todos` sırasıyla örtüşmez. Yeniden sıralamada her zaman ID ile çalış.
- **`substr` kullanımı:** Deprecated. `slice` veya `substring` tercih et.
- **Escape'i atlamak:** `innerHTML`'e ham kullanıcı metni yazmak XSS açığı yaratır; her zaman `escapeHtml`'den geçir.
- **Sayaç güncellemesini dağıtmak:** `updateStats` çağrısını tek noktadan (`setFilter`) yönet; çağıran tarafta tekrarlama.

---

# Appendix D — Pre-flight Checklist

- [ ] Görev ekleme, tamamlama, düzenleme, silme çalışıyor.
- [ ] Tümü / Aktif / Tamamlanan filtreleri ve sayaç doğru.
- [ ] Sürükle-bırak tüm filtrelerde doğru öğeyi taşıyor.
- [ ] Yenileme sonrası veriler korunuyor (`localStorage`).
- [ ] XSS girdileri metin olarak görüntüleniyor.
- [ ] Klavye navigasyonu ve odak görünürlüğü çalışıyor.
- [ ] 480px altında responsive düzen bozulmuyor.
- [ ] Konsolda hata/uyarı yok.
