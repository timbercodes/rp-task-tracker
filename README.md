# Roleplay Task Tracker 🎲

[🇷🇺 Читать на русском](#русская-версия)

A lightweight Chrome Extension designed for forum-based roleplay gamers to manage cross-platform tasks, deadlines, and daily writing routines. 

Built completely with Vanilla JavaScript, this tracker injects a unified Kanban-style dashboard into the browser and interacts dynamically with forum DOM elements to capture task context.

## 🚀 Key Features (MVP)
* **Dynamic Dashboard:** A custom UI rendered via `chrome.storage.local` based on the user's active projects.
* **Smart Injection:** Content scripts inject "Track Action" buttons directly into forum topics (e.g., mybb engine).
* **Urgency Timers:** Automated sorting by deadline proximity and daily resets.

## 🏗 Architecture & Tech Stack

This extension is built with a focus on performance, privacy, and zero external dependencies.

*   **Platform:** Chrome Extension API (Manifest V3)
*   **Core Logic:** Vanilla JavaScript (ES6+), no frameworks (React/Vue) used to keep the extension extremely lightweight.
*   **Storage:** `chrome.storage.local` (Max 5MB per user). All data is strictly isolated and stored locally on the user's machine. No cloud databases or tracking are utilized.
*   **Styling:** Pure CSS3 with Custom Properties (CSS Variables) for easy theming and scaling.

### Component Structure
1.  **Service Worker (`background.js`):** Acts as the event router. Currently handles extension icon clicks to spawn the dashboard in a new tab.
2.  **Content Script (`content.js`):** Injected conditionally only into URLs configured by the user. Parses DOM elements (`document.title`, `window.location`) to extract topic names and URLs securely without breaking the host site's CSP (Content Security Policy).
3.  **Dashboard Controller (`dashboard.js`):** The brain of the UI. Handles CRUD operations for forums and tasks, dynamically generates the Kanban board, and calculates real-time time differentials for deadlines.

---

## Русская версия
Легкое браузерное расширение для ролевиков. Помогает отслеживать долги, ежедневные задачи и дедлайны по нескольким форумам в одном месте.

### Установка (Режим разработчика)
Так как расширение находится в активной разработке, оно устанавливается вручную:
1. Скачайте [последний релиз](ссылка_на_зип_архив) в формате `.zip` и распакуйте в любую удобную папку.
2. Откройте в браузере (Chrome, Яндекс, Edge) страницу `chrome://extensions/`.
3. В правом верхнем углу включите **«Режим разработчика»** (Developer mode).
4. Нажмите кнопку **«Загрузить распакованное расширение»** (Load unpacked) и выберите папку, в которую распаковали архив.
5. Готово! Иконка трекера появится в панели браузера.