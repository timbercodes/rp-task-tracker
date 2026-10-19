# RP Task Tracker 🎲

![Version](https://img.shields.io/badge/version-1.2.0-64ffda?style=flat-square&labelColor=1e1e1e)
![Manifest](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)
![JavaScript](https://img.shields.io/badge/Vanilla_JS-ES6+-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![CSS3](https://img.shields.io/badge/Styling-CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)
![Store Status](https://img.shields.io/badge/Chrome_Web_Store-Available-69f0ae?style=flat-square&labelColor=1e1e1e)

[🇷🇺 Читать на русском](#русская-версия)

A lightweight, privacy-first Chrome Extension designed for forum-based roleplay (RP) players to manage episodes, turn order, daily routines, and deadlines across multiple forums in one unified workspace.

Built completely with Vanilla JavaScript (ES6+), this tracker provides a multi-forum task board and injects a smart, draggable Floating Action Button (FAB) directly into configured roleplay forums.

## 📸 Screenshots

<img width="1280" height="800" alt="RP Task Tracker — Main Board" src="https://github.com/user-attachments/assets/9c9fef4c-b14e-4e21-875a-57b8e1026032" />
<img width="1280" height="800" alt="RP Task Tracker — In-Page Forum Button" src="https://github.com/user-attachments/assets/4a355356-38b0-434d-97d6-365b411e9339" />

## ✨ Key Features (v1.2.0)
* **Multi-Forum Task Board:** Dynamic columns generated for each of your roleplay projects with live task counters and character lists.
* **Smart Ping-Pong Turn Tracking:** Flip an episode between *"My Turn"* and *"Waiting for Reply"* in one click—completed posts are automatically logged to your Archive with elapsed writing time.
* **In-Page Floating Action Button (FAB):** Captures topic titles, URLs, and detects your active character (`UserLogin`) directly on the forum page. Supports dragging, in-page Ping-Pong, and task editing.
* **Character Management & Filtering:** Organize characters as interactive chips in settings, assign multiple characters per episode, and filter the entire board by role in one click.
* **Episode Micro-Notes ("Anti-Sclerosis"):** Attach plot reminders directly to task cards so you never forget what you wanted to write.
* **Automated Daily Resets:** Daily routine tasks (lotteries, check-ins) automatically reset at midnight (UTC+3).
* **Post Archive:** Keeps a clean history of your completed posts and closed deadlines.

## 📦 Installation
* **Chrome Web Store:** [link](https://chromewebstore.google.com/detail/rp-task-tracker/ejddkjmlihcbapnippfmliiiaddilnon?authuser=0&hl=ru)
* **Manual Installation (Developer Mode):**
  1. Download the latest `.zip` archive from [**Releases (v1.2.0)**](https://github.com/timbercodes/rp-task-tracker/releases/latest) and extract it.
  2. Open `chrome://extensions/` in your browser (Chrome, Edge, Brave, Opera, Yandex).
  3. Enable **Developer mode** in the top-right corner.
  4. Click **Load unpacked** and select the extracted folder.

## 🏗 Architecture & Tech Stack
* **Platform:** Chrome Extension API (Manifest V3)
* **Core Logic:** Vanilla JavaScript (ES6+), zero external dependencies.
* **Dynamic Content Scripts:** Uses `chrome.scripting.registerContentScripts` to inject the in-page button strictly on domains explicitly added by the user.
* **Storage:** `chrome.storage.local`. All data is strictly isolated and stored locally on the user's device.
* **Styling:** Pure CSS3 with Custom Properties (CSS Variables).

## 🗺 Roadmap
- **v1.3.0**: MyBB API integration, separate settings, automation
- **v1.4.0**: side panel, timeline view, mood tags, themes
- **v1.5.0 / 2.0**: reports, statistics, backups and sync

Details: [Milestones](https://github.com/timbercodes/rp-task-tracker/milestones)

---

## Русская версия

Легкое браузерное расширение для текстовых ролевиков. Помогает отслеживать очередность постов, заметки к эпизодам, ежедневные задачи и дедлайны по нескольким форумам в одном окне.

### Основные возможности
* **Доска по форумам:** Отдельная колонка для каждого проекта с автоматической сортировкой задач по срочности.
* **Режим «Пинг-понг»:** Передача хода между «Мой ход» и «Жду ответа» в один клик с автоматическим сохранением написанных постов в Архив и подсчетом времени ответа.
* **Умная кнопка на форуме:** Автоматически подхватывает название темы, ссылку и имя текущего персонажа (`UserLogin`), распознает тему на любой странице и позволяет переключать статус прямо на форуме. Кнопку можно перетащить в любое удобное место экрана.
* **Фильтрация по ролям и микро-заметки:** Быстрый фильтр задач по конкретному персонажу и поле для заметок к будущему посту.
* **Сброс ежедневок:** Автоматическое обновление ежедневных задач (лотерей, перекличек) в 00:00 по МСК.

### Установка
* **Chrome Web Store:** [ссылка](https://chromewebstore.google.com/detail/rp-task-tracker/ejddkjmlihcbapnippfmliiiaddilnon?authuser=0&hl=ru)
* **Установка вручную (Режим разработчика):**
  1. Скачайте последний архив `.zip` в разделе [**Releases (v1.2.0)**](https://github.com/timbercodes/rp-task-tracker/releases/latest) и распакуйте в любую папку.
  2. Откройте в браузере (Chrome, Яндекс.Браузер, Edge, Opera) страницу `chrome://extensions/`.
  3. Включите переключатель **«Режим разработчика»** (Developer mode) в правом верхнем углу.
  4. Нажмите **«Загрузить распакованное расширение»** (Load unpacked) и выберите распакованную папку.

### План развития (Roadmap)
- **v1.3.0**: интеграция с MyBB API, отдельные настройки, автоматизация
- **v1.4.0**: боковая панель, режим таймлайна, теги настроения, темы оформления
- **v1.5.0 / 2.0**: генератор отчетов для банка, статистика, бэкапы и синхронизация

Подробности: [Milestones](https://github.com/timbercodes/rp-task-tracker/milestones)

---

## 🔒 Privacy Policy / Политика конфиденциальности

**English:**
RP Task Tracker does **not** collect, transmit, store, or share any personal data, browsing history, or user content on external servers. All user-created data (configured forum URLs, character names, task links, and notes) is stored exclusively locally on the user's device using the browser's native `chrome.storage.local` API. Host permissions are used solely to display the extension's task-tracking button on forum domains explicitly configured by the user.

**Русский:**
Расширение RP Task Tracker **не** собирает, не передает и не хранит личные данные, историю браузера или пользовательский контент на внешних серверах. Все данные (ссылки на форумы, имена персонажей, карточки задач и заметки) хранятся исключительно локально на устройстве пользователя в изолированном хранилище браузера (`chrome.storage.local`). Разрешения на доступ к сайтам используются только для отображения кнопки трекера на тех ролевых форумах, которые пользователь сам добавил в настройки.
