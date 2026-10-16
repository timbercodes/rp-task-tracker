/**
 * RP Task Tracker - Dashboard Controller
 * Handles UI state transitions, forum/character configuration, storage sync,
 * and task board rendering.
 * Note: Relies on scripts/utils.js being loaded first.
 */

(() => {

// ==========================================================================
// 1. State & DOM References
// ==========================================================================

let forums = [];
let editingId = null;
let currentEditingTaskId = null;
let pendingDeleteForumId = null;
let pendingDeleteChar = null; // { forumId, charName }

// Views & Containers
const onboardingView = document.getElementById('onboarding-view');
const boardView = document.getElementById('board-view');
const forumsList = document.getElementById('added-forums-list');
const mainBoard = document.getElementById('main-board');

// Buttons
const btnAddForum = document.getElementById('btn-add-forum');
const btnFinish = document.getElementById('btn-finish-onboarding');
const btnSettings = document.getElementById('btn-settings');
const btnCancelSettings = document.getElementById('btn-cancel-settings');
const btnArchive = document.getElementById('btn-archive');

// Modals
const editModal = document.getElementById('task-edit-modal');
const deleteForumModal = document.getElementById('forum-delete-modal');
const deleteCharModal = document.getElementById('char-delete-modal');

// Onboarding Form Inputs
const inputName = document.getElementById('forum-name');
const inputUrl = document.getElementById('forum-url');
const inputChars = document.getElementById('forum-chars');

// ==========================================================================
// 2. Initialization & Storage Synchronization
// ==========================================================================

/**
 * Initializes the dashboard state on DOM load.
 * Injects header icons, runs legacy data migration if needed, and routes to the active view.
 */
document.addEventListener('DOMContentLoaded', () => {
    btnSettings.innerHTML = ICON_SETTINGS;
    btnArchive.innerHTML = ICON_ARCHIVE;

    chrome.storage.local.get(['savedForums'], (result) => {
        if (result.savedForums && result.savedForums.length > 0) {
            forums = result.savedForums;

            // =================================================================
            // TODO: [AUTO-MIGRATOR v1.2.0] — REMOVE THIS BLOCK AFTER MIGRATION
            // Automatically converts legacy comma-separated character strings into arrays
            if (forums.some(f => typeof f.characters === 'string')) {
                forums = forums.map(f => ({
                    ...f,
                    characters: getForumChars(f.characters)
                }));
                chrome.storage.local.set({ savedForums: forums });
            }
            // =================================================================

            showBoardView();
        }
    });
});

/**
 * Listens for storage updates from other tabs or the in-page FAB
 * and re-renders the board automatically.
 */
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        if (changes.savedForums) {
            forums = (changes.savedForums.newValue || []).map(f => ({
                ...f,
                characters: getForumChars(f)
            }));
        }
        if (changes.rpgTasks || changes.savedForums) {
            renderBoardColumns();
            loadAndRenderTasks();
        }
    }
});

// ==========================================================================
// 3. Forum & Character Settings Management
// ==========================================================================

/**
 * Handles adding a new forum or updating an existing forum configuration.
 */
btnAddForum.addEventListener('click', () => {
    const name = inputName.value.trim();
    const url = inputUrl.value.trim();
    const chars = getForumChars(inputChars.value);

    if (!name || !url) {
        alert('Название и ссылка обязательны!');
        return;
    }

    if (editingId) {
        const forum = forums.find(f => f.id === editingId);
        if (forum) {
            forum.name = name;
            forum.url = url;
            forum.characters = chars;
        }
        editingId = null;
        btnAddForum.textContent = 'Добавить форум';
    } else {
        const newForum = {
            id: Date.now().toString(),
            name: name,
            url: url,
            characters: chars
        };
        forums.push(newForum);
    }

    clearInputs();
    renderForumsList();
    checkFinishButton();
});

/**
 * Renders the list of configured forums with interactive character chips.
 */
function renderForumsList() {
    forumsList.innerHTML = '';

    forums.forEach(forum => {
        const item = document.createElement('div');
        item.className = 'forum-item';

        const safeName = escapeHTML(forum.name);
        const safeUrl = escapeHTML(forum.url);
        const charList = getForumChars(forum);

        const chipsHtml = charList.map(c => {
            const safeChar = escapeHTML(c);
            return `<span class="char-chip">${safeChar}<span class="char-chip-remove" data-forum-id="${forum.id}" data-char="${safeChar}" title="Удалить персонажа">&times;</span></span>`;
        }).join('');

        item.innerHTML = `
            <div class="forum-info">
                <strong>${safeName}</strong>
                <span>${safeUrl}</span>
                <div class="char-chips-container" data-forum-id="${forum.id}">
                    ${chipsHtml}
                    <button type="button" class="char-chip-add-btn" data-forum-id="${forum.id}" title="Быстро добавить персонажа">+ Персонаж</button>
                </div>
            </div>
            <div class="forum-actions">
                <button class="btn-edit" data-id="${forum.id}" title="Редактировать форум">${ICON_EDIT}</button>
                <button class="btn-delete" data-id="${forum.id}" title="Удалить форум">${ICON_TRASH}</button>
            </div>
        `;
        forumsList.appendChild(item);
    });
}

/**
 * Event delegation for forum list actions (chip deletion, inline character creation, forum edit/delete).
 */
forumsList.addEventListener('click', (e) => {
    // 1. Remove character chip
    const removeChipBtn = e.target.closest('.char-chip-remove');
    if (removeChipBtn) {
        const forumId = removeChipBtn.getAttribute('data-forum-id');
        const charName = removeChipBtn.getAttribute('data-char');
        pendingDeleteChar = { forumId, charName };
        document.getElementById('delete-char-title').textContent = `Удалить персонажа «${charName}»?`;
        deleteCharModal.classList.remove('hidden');
        return;
    }

    // 2. Inline '+ Персонаж' creation
    const addChipBtn = e.target.closest('.char-chip-add-btn');
    if (addChipBtn) {
        const forumId = addChipBtn.getAttribute('data-forum-id');
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'char-inline-input';
        input.placeholder = 'Имя и Enter...';

        addChipBtn.replaceWith(input);
        input.focus();

        const commitInlineChar = () => {
            const val = input.value.trim();
            if (val) {
                const forum = forums.find(f => f.id === forumId);
                if (forum) {
                    const updated = resolveAndLearnCharacters(forum.characters, val);
                    forum.characters = updated.updatedForumChars;
                    chrome.storage.local.set({ savedForums: forums });
                }
            }
            renderForumsList();
        };

        input.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') {
                ev.preventDefault();
                input.blur();
            } else if (ev.key === 'Escape') {
                input.value = '';
                input.blur();
            }
        });
        input.addEventListener('blur', commitInlineChar, { once: true });
        return;
    }

    // 3. Edit or Delete Forum
    const btn = e.target.closest('button');
    if (!btn) return;

    const id = btn.getAttribute('data-id');

    if (btn.classList.contains('btn-delete')) {
        const forumToDelete = forums.find(f => f.id === id);
        if (!forumToDelete) return;

        pendingDeleteForumId = id;
        document.getElementById('delete-forum-title').textContent = `Удалить «${forumToDelete.name}»?`;
        deleteForumModal.classList.remove('hidden');
    }

    if (btn.classList.contains('btn-edit')) {
        const forum = forums.find(f => f.id === id);
        if (!forum) return;

        inputName.value = forum.name;
        inputUrl.value = forum.url;
        inputChars.value = getForumChars(forum).join(', ');

        editingId = id;
        btnAddForum.textContent = 'Сохранить изменения';
    }
});

/**
 * Clears forum configuration input fields.
 */
function clearInputs() {
    inputName.value = '';
    inputUrl.value = '';
    inputChars.value = '';
}

/**
 * Updates the disabled state of the primary onboarding/settings finish button.
 * Allows saving an empty forum list when accessed from Settings mode.
 */
function checkFinishButton() {
    const isSettingsMode = !btnCancelSettings.classList.contains('hidden');
    btnFinish.disabled = isSettingsMode ? false : (forums.length === 0);
}

/**
 * Saves forum configurations and transitions to the appropriate view.
 */
btnFinish.addEventListener('click', () => {
    chrome.storage.local.set({ savedForums: forums }, () => {
        if (forums.length === 0) {
            btnCancelSettings.classList.add('hidden');
            document.querySelector('.onboarding-card h1').textContent = 'Добро пожаловать в трекер! 🎲';
            document.querySelector('.onboarding-card p').textContent = 'Давай добавим твои форумы, чтобы настроить доску.';
            btnFinish.textContent = 'Перейти к доске';
            checkFinishButton();
        } else {
            showBoardView();
            btnCancelSettings.classList.add('hidden');
        }
    });
});

/**
 * Navigates to the Archive page.
 */
btnArchive.addEventListener('click', () => {
    window.location.href = 'archive.html';
});

/**
 * Opens the Settings view from the main board.
 */
btnSettings.addEventListener('click', () => {
    boardView.classList.add('hidden');
    onboardingView.classList.remove('hidden');
    btnCancelSettings.classList.remove('hidden');

    renderForumsList();
    checkFinishButton();

    document.querySelector('.onboarding-card h1').textContent = 'Настройки форумов ⚙️';
    document.querySelector('.onboarding-card p').textContent = 'Управление твоими ролевыми проектами.';
    btnFinish.textContent = 'Сохранить и вернуться к доске';
});

/**
 * Discards unsaved settings changes and returns to the task board.
 */
btnCancelSettings.addEventListener('click', () => {
    chrome.storage.local.get(['savedForums'], (result) => {
        forums = (result.savedForums || []).map(f => ({
            ...f,
            characters: getForumChars(f)
        }));
        showBoardView();
        btnCancelSettings.classList.add('hidden');
    });
});

// ==========================================================================
// 4. Main Task Board Rendering & Sorting
// ==========================================================================

/**
 * Switches the active view to the main task board and triggers rendering.
 */
function showBoardView() {
    onboardingView.classList.add('hidden');
    boardView.classList.remove('hidden');

    renderBoardColumns();
    loadAndRenderTasks();
}

/**
 * Generates forum columns dynamically based on saved forums.
 */
function renderBoardColumns() {
    mainBoard.innerHTML = '';

    forums.forEach(forum => {
        const col = document.createElement('div');
        col.className = 'column';

        const safeName = escapeHTML(forum.name);
        const charList = getForumChars(forum);
        const safeChars = escapeHTML(charList.join(', '));
        const safeUrl = escapeHTML(forum.url);

        const charsHtml = safeChars
            ? `<div class="column-chars">${ICON_USERS}<span>${safeChars}</span></div>`
            : '';

        const forumLink = safeUrl.startsWith('http') ? safeUrl : `https://${safeUrl}`;

        col.innerHTML = `
            <h2>
                <a href="${forumLink}" target="_blank" class="column-link" title="Перейти на форум">${safeName}</a>
                ${charsHtml}
            </h2>
            <div class="task-list" id="list-${forum.id}"></div>
        `;

        mainBoard.appendChild(col);
    });
}

/**
 * Calculates an urgency score for sorting active tasks.
 * Lower score indicates higher priority (positioned closer to the top of the column).
 * @param {string} type - Task type ('daily', 'deadline', 'turn', 'wait').
 * @param {number} targetTime - Task timestamp in milliseconds.
 * @param {number} now - Current timestamp in milliseconds.
 * @returns {number} Computed urgency score.
 */
function getUrgencyScore(type, targetTime, now) {
    const diffDays = (now - targetTime) / (1000 * 60 * 60 * 24);

    switch (type) {
        case 'daily': return -10000;
        case 'deadline': return -5000 - diffDays;
        case 'turn': return 0 - diffDays;
        case 'wait': return 5000 - diffDays;
        default: return 10000;
    }
}

/**
 * Fetches tasks from storage, resets dailies if needed, updates the header summary,
 * sorts active tasks by priority, and renders task cards into forum columns.
 */
function loadAndRenderTasks() {
    chrome.storage.local.get(['rpgTasks'], (result) => {
        const tasks = result.rpgTasks || [];

        // Check and reset daily tasks at midnight (Moscow time)
        if (resetDailiesIfNeeded(tasks)) {
            chrome.storage.local.set({ rpgTasks: tasks });
            return;
        }

        const now = Date.now();
        const activeTasks = tasks.filter(t => !t.archived);

        // Update header summary counters
        const turnsCount = activeTasks.filter(t => t.type === 'turn').length;
        const waitsCount = activeTasks.filter(t => t.type === 'wait').length;
        const totalCharsCount = forums.reduce((sum, f) => sum + getForumChars(f).length, 0);

        const summaryEl = document.getElementById('dashboard-summary');
        if (summaryEl) {
            summaryEl.innerHTML =
                `Активных форумов: <span class="text-accent">${forums.length}</span> &nbsp;•&nbsp; ` +
                `Персонажей: <span class="text-accent">${totalCharsCount}</span> &nbsp;•&nbsp; ` +
                `Мой ход: <span class="text-accent">${turnsCount}</span> &nbsp;•&nbsp; ` +
                `Жду ответа: <span class="text-accent">${waitsCount}</span>`;
        }

        // Sort active tasks: incomplete first, then by urgency score
        activeTasks.sort((a, b) => {
            if (a.completed && !b.completed) return 1;
            if (!a.completed && b.completed) return -1;
            if (a.completed && b.completed) return 0;

            const timeA = new Date(a.date).getTime();
            const timeB = new Date(b.date).getTime();
            return getUrgencyScore(a.type, timeA, now) - getUrgencyScore(b.type, timeB, now);
        });

        // Clear all task lists immediately before insertion to prevent duplicate rendering on rapid storage events
        document.querySelectorAll('.task-list').forEach(col => {
            col.innerHTML = '';
        });

        // Render task cards
        activeTasks.forEach(task => {
            const column = document.getElementById(`list-${task.forumId}`);
            if (!column) return;

            const card = document.createElement('div');
            card.className = `task-card ${task.completed ? 'completed' : getStatusColor(task.type, task.date, now)}`;

            const safeTitle = escapeHTML(task.title);
            const safeUrl = escapeHTML(task.url);
            const safeTag = escapeHTML(task.tag);
            const safeNote = escapeHTML(task.note);

            const titleHtml = task.url ? `<a href="${safeUrl}" target="_blank">${safeTitle}</a>` : safeTitle;
            const timerHtml = getTimerHtml(task.type, task.date, now, task);
            const tagHtml = task.tag ? `<span class="tag">${safeTag}</span>` : '';
            const noteHtml = safeNote ? `<div class="task-note">${safeNote}</div>` : '';

            let pingPongBtnHtml = '';
            if (task.type === 'turn' || task.type === 'wait') {
                const ppTitle = task.type === 'turn'
                    ? 'Пост написан! Передать ход соигроку (пост сохранится в Архив)'
                    : 'Ответ получен! Забрать ход себе';
                pingPongBtnHtml = `<button class="btn-pingpong-task" data-task-id="${task.id}" title="${ppTitle}">${ICON_PINGPONG}</button>`;
            }

            let completeTitle = 'Завершить эпизод';
            if (task.type === 'daily') completeTitle = 'Отметить на сегодня';
            if (task.type === 'deadline') completeTitle = 'Закрыть дедлайн (в Архив)';

            card.innerHTML = `
                <div class="task-header">
                    <div class="task-content">
                        <div class="task-title">${titleHtml}</div>
                        <div class="task-meta">${tagHtml}</div>
                        ${noteHtml}
                        <div class="task-timer">${timerHtml}</div>
                    </div>
                    <div class="task-actions-wrapper">
                        <div class="task-actions">
                            ${pingPongBtnHtml}
                            <button class="btn-complete-task" data-task-id="${task.id}" title="${completeTitle}">${ICON_CHECK}</button>
                            <button class="btn-edit-task" data-task-id="${task.id}" title="Редактировать">${ICON_EDIT}</button>
                            <button class="btn-delete-task" data-task-id="${task.id}" title="Убрать с доски">${ICON_TRASH}</button>
                        </div>
                    </div>
                </div>
            `;

            column.appendChild(card);
        });

        // Render empty state placeholders for columns without active tasks
        document.querySelectorAll('.task-list').forEach(col => {
            if (col.children.length === 0) {
                col.innerHTML = `
                    <div class="empty-column-state">
                        Пока никаких задач.<br>Ты сможешь добавить их прямо со страницы форума, на котором играешь ✨
                    </div>
                `;
            }
        });
    });
}

/**
 * Determines the status border CSS class based on task type and elapsed/remaining time.
 * @param {string} type - Task type ('wait', 'turn', 'daily', 'deadline').
 * @param {string} date - Task ISO date string.
 * @param {number} now - Current timestamp in milliseconds.
 * @returns {string} CSS status class ('status-green', 'status-yellow', or 'status-red').
 */
function getStatusColor(type, date, now) {
    const target = new Date(date).getTime();

    if (type === 'wait' || type === 'turn') {
        const diffDays = (now - target) / (1000 * 60 * 60 * 24);
        if (diffDays > 7) return 'status-red';
        if (diffDays > 3) return 'status-yellow';
        return 'status-green';
    }
    if (type === 'deadline') {
        const leftDays = (target - now) / (1000 * 60 * 60 * 24);
        if (leftDays < 2) return 'status-red';
        if (leftDays < 5) return 'status-yellow';
        return 'status-green';
    }
    return 'status-green';
}

/**
 * Generates the localized timer HTML for a task card.
 * @param {string} type - Task type ('wait', 'turn', 'daily', 'deadline').
 * @param {string} date - Task ISO date string.
 * @param {number} now - Current timestamp in milliseconds.
 * @param {Object} task - Full task object.
 * @returns {string} HTML string for the task timer.
 */
function getTimerHtml(type, date, now, task) {
    if (type === 'daily') {
        return `<span>Ежедневка</span>`;
    }

    const target = new Date(date).getTime();
    let timeReference = now;

    if (task && task.completed && task.completionDate) {
        timeReference = new Date(task.completionDate).getTime();
    }

    const diff = (type === 'wait' || type === 'turn')
        ? (timeReference - target)
        : (target - timeReference);

    if (type === 'deadline' && diff < 0) {
        return '<span class="text-danger">Дедлайн горит!</span>';
    }

    const durationStr = formatDuration(diff);

    if (type === 'wait') return `Жду ответа: ${durationStr}`;
    if (type === 'turn') return `Мой ход: ${durationStr}`;
    if (type === 'deadline') return `Осталось: ${durationStr}`;

    return '';
}

// ==========================================================================
// 5. Task Actions (Complete, Ping-Pong, Edit, Delete, Daily Reset)
// ==========================================================================

/**
 * Deletes an active task from the board after user confirmation.
 * @param {string} id - Task identifier.
 */
function deleteTask(id) {
    if (confirm('Убрать эту задачу с доски? (В архив она не попадет)')) {
        chrome.storage.local.get(['rpgTasks'], (result) => {
            const tasks = (result.rpgTasks || []).filter(t => t.id !== id);
            chrome.storage.local.set({ rpgTasks: tasks });
        });
    }
}

/**
 * Handles task completion based on task type:
 * - 'daily': toggles completed state on the board until midnight reset.
 * - 'wait': removes the waiting card from the board without archiving.
 * - 'turn' / 'deadline': moves the task to the Archive with a completion timestamp.
 * @param {string} id - Task identifier.
 */
function handleCompleteAction(id) {
    chrome.storage.local.get(['rpgTasks'], (result) => {
        const tasks = result.rpgTasks || [];
        const taskIndex = tasks.findIndex(t => t.id === id);

        if (taskIndex > -1) {
            const task = tasks[taskIndex];

            if (task.type === 'daily') {
                task.completed = !task.completed;
            } else if (task.type === 'wait') {
                tasks.splice(taskIndex, 1);
            } else {
                task.archived = true;
                task.completed = true;
                task.completionDate = new Date().toISOString();
            }

            chrome.storage.local.set({ rpgTasks: tasks });
        }
    });
}

/**
 * Toggles a task between 'turn' and 'wait' states (Ping-Pong).
 * When flipping from 'turn' to 'wait', saves a completed snapshot of the post into the Archive.
 * @param {string} id - Task identifier.
 */
function handlePingPongAction(id) {
    chrome.storage.local.get(['rpgTasks'], (result) => {
        const tasks = result.rpgTasks || [];
        const taskIndex = tasks.findIndex(t => t.id === id);

        if (taskIndex > -1) {
            const task = tasks[taskIndex];
            const nowObj = new Date();
            const freshDateStr = getLocalTimestampString(nowObj);

            if (task.type === 'turn') {
                const archivedCopy = {
                    ...task,
                    id: `${Date.now()}_arch`,
                    completed: true,
                    archived: true,
                    completionDate: nowObj.toISOString()
                };
                tasks.push(archivedCopy);

                task.type = 'wait';
                task.date = freshDateStr;
            } else if (task.type === 'wait') {
                task.type = 'turn';
                task.date = freshDateStr;
            }

            chrome.storage.local.set({ rpgTasks: tasks });
        }
    });
}

/**
 * Delegated click listener for task card action buttons on the main board.
 */
mainBoard.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const taskId = btn.getAttribute('data-task-id');
    if (!taskId) return;

    if (btn.classList.contains('btn-pingpong-task')) handlePingPongAction(taskId);
    if (btn.classList.contains('btn-complete-task')) handleCompleteAction(taskId);
    if (btn.classList.contains('btn-delete-task')) deleteTask(taskId);
    if (btn.classList.contains('btn-edit-task')) openEditModal(taskId);
});

/**
 * Opens the task edit modal and populates fields and character quick-select pills.
 * @param {string} taskId - Target task identifier.
 */
function openEditModal(taskId) {
    chrome.storage.local.get(['rpgTasks'], (result) => {
        const tasks = result.rpgTasks || [];
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        currentEditingTaskId = taskId;

        const charInput = document.getElementById('edit-task-char');
        const pillsContainer = document.getElementById('edit-task-char-pills');

        document.getElementById('edit-task-title').value = task.title || '';
        charInput.value = task.tag || '';
        document.getElementById('edit-task-type').value = task.type || 'wait';
        document.getElementById('edit-task-note').value = task.note || '';
        document.getElementById('edit-task-date').value = task.date
            ? task.date.split('T')[0]
            : new Date().toISOString().split('T')[0];

        const forum = forums.find(f => f.id === task.forumId);
        const forumChars = forum ? getForumChars(forum) : [];

        renderCharacterPills({
            containerEl: pillsContainer,
            inputEl: charInput,
            characters: forumChars,
            pillClass: 'char-pill',
            activeClass: 'active',
            hiddenClass: 'hidden'
        });

        editModal.classList.remove('hidden');
    });
}

/**
 * Closes the task edit modal without saving.
 */
function closeEditModal() {
    editModal.classList.add('hidden');
    currentEditingTaskId = null;
}

document.getElementById('btn-cancel-edit').addEventListener('click', closeEditModal);

/**
 * Saves modifications from the task edit modal to storage.
 */
document.getElementById('btn-save-task-edit').addEventListener('click', () => {
    if (!currentEditingTaskId) return;

    chrome.storage.local.get(['rpgTasks'], (result) => {
        const tasks = result.rpgTasks || [];
        const taskIndex = tasks.findIndex(t => t.id === currentEditingTaskId);

        if (taskIndex > -1) {
            const newType = document.getElementById('edit-task-type').value;
            const rawDate = document.getElementById('edit-task-date').value;
            const finalDateStr = buildTaskDateString(newType, rawDate, tasks[taskIndex].date);

            const rawCharInput = document.getElementById('edit-task-char').value;
            const taskForum = forums.find(f => f.id === tasks[taskIndex].forumId);
            let finalCharTag = rawCharInput.trim();

            if (taskForum) {
                const resolved = resolveAndLearnCharacters(taskForum.characters, rawCharInput);
                finalCharTag = resolved.formattedTag;
                if (resolved.hasNewChars) {
                    taskForum.characters = resolved.updatedForumChars;
                    chrome.storage.local.set({ savedForums: forums });
                }
            }

            tasks[taskIndex].title = document.getElementById('edit-task-title').value;
            tasks[taskIndex].tag = finalCharTag;
            tasks[taskIndex].type = newType;
            tasks[taskIndex].date = finalDateStr;
            tasks[taskIndex].note = document.getElementById('edit-task-note').value.trim();

            chrome.storage.local.set({ rpgTasks: tasks }, closeEditModal);
        }
    });
});

/**
 * Resets completed daily tasks if a new calendar day has begun in Moscow (UTC+3).
 * @param {Array<Object>} tasks - Array of task objects.
 * @returns {boolean} True if at least one daily task was reset.
 */
function resetDailiesIfNeeded(tasks) {
    const moscowTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
    const yyyy = moscowTime.getFullYear();
    const mm = String(moscowTime.getMonth() + 1).padStart(2, '0');
    const dd = String(moscowTime.getDate()).padStart(2, '0');
    const todayMoscow = `${yyyy}-${mm}-${dd}`;

    let needsUpdate = false;

    tasks.forEach(task => {
        if (task.type === 'daily' && task.date < todayMoscow) {
            task.date = todayMoscow;
            task.completed = false;
            needsUpdate = true;
        }
    });

    return needsUpdate;
}

// ==========================================================================
// 6. Deletion Confirmation Modals (Forums & Characters)
// ==========================================================================

/**
 * Executes forum deletion according to the selected archive preservation strategy.
 * @param {boolean} keepArchive - True to retain archived history, false to wipe all tasks.
 */
function executeForumDeletion(keepArchive) {
    if (!pendingDeleteForumId) return;

    const id = pendingDeleteForumId;
    const forumToDelete = forums.find(f => f.id === id);
    if (!forumToDelete) return;

    forums = forums.filter(f => f.id !== id);

    chrome.storage.local.get(['rpgTasks'], (result) => {
        let tasks = result.rpgTasks || [];

        if (keepArchive) {
            tasks = tasks.filter(t => t.forumId !== id || t.archived);
            tasks.forEach(t => {
                if (t.forumId === id && t.archived) {
                    t.forumName = forumToDelete.name;
                }
            });
        } else {
            tasks = tasks.filter(t => t.forumId !== id);
        }

        chrome.storage.local.set({ rpgTasks: tasks });
    });

    closeDeleteForumModal();
    renderForumsList();
    checkFinishButton();
}

/**
 * Closes the forum deletion confirmation modal.
 */
function closeDeleteForumModal() {
    deleteForumModal.classList.add('hidden');
    pendingDeleteForumId = null;
}

document.getElementById('btn-delete-keep-archive').addEventListener('click', () => executeForumDeletion(true));
document.getElementById('btn-delete-wipe-all').addEventListener('click', () => executeForumDeletion(false));
document.getElementById('btn-cancel-delete-forum').addEventListener('click', closeDeleteForumModal);
document.getElementById('btn-close-delete-modal').addEventListener('click', closeDeleteForumModal);

/**
 * Executes character deletion from a forum and optionally cleans up active tasks.
 * @param {boolean} removeActiveTasks - True to remove/update active tasks assigned to this character.
 */
function executeCharDeletion(removeActiveTasks) {
    if (!pendingDeleteChar) return;
    const { forumId, charName } = pendingDeleteChar;
    const forum = forums.find(f => f.id === forumId);
    if (!forum) return;

    forum.characters = getForumChars(forum).filter(
        c => c.toLowerCase() !== charName.toLowerCase()
    );
    chrome.storage.local.set({ savedForums: forums });

    if (removeActiveTasks) {
        chrome.storage.local.get(['rpgTasks'], (result) => {
            let tasks = result.rpgTasks || [];
            const targetLower = charName.toLowerCase();

            tasks = tasks.filter(t => {
                if (t.archived || t.forumId !== forumId || !t.tag) return true;

                const taskChars = t.tag.split(',').map(s => s.trim()).filter(Boolean);
                const hasTarget = taskChars.some(c => c.toLowerCase() === targetLower);
                if (!hasTarget) return true;

                const remainingChars = taskChars.filter(c => c.toLowerCase() !== targetLower);
                if (remainingChars.length > 0) {
                    t.tag = remainingChars.join(', ');
                    return true;
                }
                return false;
            });

            chrome.storage.local.set({ rpgTasks: tasks });
        });
    }

    closeDeleteCharModal();
    renderForumsList();
}

/**
 * Closes the character deletion confirmation modal.
 */
function closeDeleteCharModal() {
    deleteCharModal.classList.add('hidden');
    pendingDeleteChar = null;
}

document.getElementById('btn-char-delete-with-tasks').addEventListener('click', () => executeCharDeletion(true));
document.getElementById('btn-char-delete-keep-tasks').addEventListener('click', () => executeCharDeletion(false));
document.getElementById('btn-cancel-char-delete').addEventListener('click', closeDeleteCharModal);
document.getElementById('btn-close-char-delete-modal').addEventListener('click', closeDeleteCharModal);

// Global Escape key listener to close any active modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (!deleteForumModal.classList.contains('hidden')) closeDeleteForumModal();
        if (!editModal.classList.contains('hidden')) closeEditModal();
        if (!deleteCharModal.classList.contains('hidden')) closeDeleteCharModal();
    }
});

})();
