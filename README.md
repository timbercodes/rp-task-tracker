# RP Task Tracker 🎲

[🇷🇺 Читать на русском](#русская-версия)

A lightweight, privacy-first Chrome Extension designed for forum-based roleplay (RP) players to manage episodes, turn order, daily routines, and deadlines across multiple forums in one unified workspace.

Built completely with Vanilla JavaScript (ES6+), this tracker provides a multi-forum task board and injects a smart, draggable Floating Action Button (FAB) directly into configured roleplay forums.

## ✨ Key Features (v1.2.0)
* **Multi-Forum Task Board:** Dynamic columns generated for each of your roleplay projects with live task counters and character lists.
* **Smart Ping-Pong Turn Tracking:** Flip an episode between *"My Turn"* and *"Waiting for Reply"* in one click—completed posts are automatically logged to your Archive with elapsed writing time.
* **In-Page Floating Action Button (FAB):** Captures topic titles, URLs, and detects your active character (`UserLogin`) directly on the forum page. Supports dragging, in-page Ping-Pong, and task editing.
* **Character Management & Filtering:** Organize characters as interactive chips in settings, assign multiple characters per episode, and filter the entire board by role in one click.
* **Episode Micro-Notes ("Anti-Sclerosis"):** Attach plot reminders directly to task cards so you never forget what you wanted to write.
* **Automated Daily Resets:** Daily routine tasks (lotteries, check-ins) automatically reset at midnight (UTC+3).
* **Post Archive:** Keeps a searchable history of your completed posts and closed deadlines.

## 🏗 Architecture & Tech Stack
* **Platform:** Chrome Extension API (Manifest V3)
* **Core Logic:** Vanilla JavaScript (ES6+), zero external dependencies.
* **Dynamic Content Scripts:** Uses `chrome.scripting.registerContentScripts` to inject the in-page button strictly on domains explicitly added by the user.
* **Storage:** `chrome.storage.local`. All data is strictly isolated and stored locally on the user's device.
* **Styling:** Pure CSS3 with Custom Properties (CSS Variables).

---

## Русская версия

Легкое браузерное расширение для текстовых ролевиков. Помогает отслеживать очередность постов, заметки к эпизодам, ежедневные задачи и дедлайны по нескольким форумам в одном окне.

### Основные возможности
* **Доска по форумам:** Отдельная колонка для каждого проекта с автоматической сортировкой задач по срочности.
* **Режим «Пинг-понг»:** Передача хода между «Мой ход» и «Жду ответа» в один клик с автоматическим сохранением написанных постов в Архив и подсчетом времени ответа.
* **Умная кнопка на форуме:** Автоматически подхватывает название темы, ссылку и имя текущего персонажа (`UserLogin`), распознает тему на любой странице и позволяет переключать статус прямо на форуме. Кнопку можно перетащить в любое удобное место экрана.
* **Фильтрация по ролям и микро-заметки:** Быстрый фильтр задач по конкретному персонажу и поле для заметок к будущему посту.
* **Сброс ежедневок:** Автоматическое обновление ежедневных задач (лотерей, перекличек) в 00:00 по МСК.

### Установка вручную (Режим разработчика)
1. Скачайте последний релиз в формате `.zip` и распакуйте в любую папку.
2. Откройте в браузере (Chrome, Яндекс.Браузер, Edge, Opera) страницу `chrome://extensions/`.
3. Включите переключатель **«Режим разработчика»** (Developer mode) в правом верхнем углу.
4. Нажмите **«Загрузить распакованное расширение»** (Load unpacked) и выберите распакованную папку.

---

## 🔒 Privacy Policy / Политика конфиденциальности

**English:**
RP Task Tracker does **not** collect, transmit, store, or share any personal data, browsing history, or user content on external servers. All user-created data (configured forum URLs, character names, task links, and notes) is stored exclusively locally on the user's device using the browser's native `chrome.storage.local` API. Host permissions are used solely to display the extension's task-tracking button on forum domains explicitly configured by the user.

**Русский:**
Расширение RP Task Tracker **не** собирает, не передает и не хранит личные данные, историю браузера или пользовательский контент на внешних серверах. Все данные (ссылки на форумы, имена персонажей, карточки задач и заметки) хранятся исключительно локально на устройстве пользователя в изолированном хранилище браузера (`chrome.storage.local`). Разрешения на доступ к сайтам используются только для отображения кнопки трекера на тех ролевых форумах, которые пользователь сам добавил в настройки.