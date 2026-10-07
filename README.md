# Roleplay Task Tracker 🎲

[🇷🇺 Читать на русском](#русская-версия)

A lightweight Chrome Extension designed for forum-based roleplay gamers to manage cross-platform tasks, deadlines, and daily writing routines. 

Built completely with Vanilla JavaScript, this tracker injects a unified Kanban-style dashboard into the browser and interacts dynamically with forum DOM elements to capture task context.

## 🚀 Key Features (MVP)
* **Dynamic Dashboard:** A custom UI rendered via `chrome.storage.local` based on the user's active projects.
* **Smart Injection:** Content scripts inject "Track Action" buttons directly into forum topics (e.g., mybb engine).
* **Urgency Timers:** Automated sorting by deadline proximity and daily resets.

## 🛠 Tech Stack
* **JavaScript (ES6+)** - Core logic, DOM manipulation, Chrome Extensions API.
* **HTML5 & CSS3** - Responsive Grid/Flexbox UI.
* **Manifest V3** - Modern Chrome extension architecture.

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