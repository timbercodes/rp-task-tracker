/**
 * RP Task Tracker - Dashboard Controller
 * Handles UI interactions, local storage operations, and Kanban board rendering.
 * Note: Relies on scripts/utils.js being loaded in the HTML.
 */

(() => {

let forums = [];
let editingId = null;
let currentEditingTaskId = null;
let pendingDeleteForumId = null;
const deleteForumModal = document.getElementById('forum-delete-modal');
let pendingDeleteChar = null; // { forumId, charName }
const deleteCharModal = document.getElementById('char-delete-modal');

// --- DOM Elements ---
const onboardingView = document.getElementById('onboarding-view');
const kanbanView = document.getElementById('kanban-view');
const btnAddForum = document.getElementById('btn-add-forum');
const btnFinish = document.getElementById('btn-finish-onboarding');
const forumsList = document.getElementById('added-forums-list');
const btnSettings = document.getElementById('btn-settings');
const btnCancelSettings = document.getElementById('btn-cancel-settings');
const editModal = document.getElementById('task-edit-modal');
const btnArchive = document.getElementById('btn-archive');

// --- Input Fields ---
const inputName = document.getElementById('forum-name');
const inputUrl = document.getElementById('forum-url');
const inputChars = document.getElementById('forum-chars');

/**
 * Initializes the extension state on DOM load.
 * Checks for existing configurations and routes to the appropriate view.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Inject the settings icon into the HTML button
    document.getElementById('btn-settings').innerHTML = ICON_SETTINGS;
    document.getElementById('btn-archive').innerHTML = ICON_ARCHIVE;

    chrome.storage.local.get(['savedForums'], (result) => {
        if (result.savedForums && result.savedForums.length > 0) {
            forums = result.savedForums;

            // =================================================================
            // TODO: [AUTO-MIGRATOR v1.2.0] — УДАЛИТЬ ЭТОТ БЛОК ПОСЛЕ ПЕРЕХОДА
            // Автоматически переводит старые строки ("John, Jane") в массивы в базе
            if (forums.some(f => typeof f.characters === 'string')) {
                forums = forums.map(f => ({
                    ...f,
                    characters: getForumChars(f.characters)
                }));
                chrome.storage.local.set({ savedForums: forums });
            }
            // =================================================================

            showKanbanView();
        }
    });
});

/**
 * Real-time Sync: Listens for storage changes from other tabs (or the floating button)
 * and automatically re-renders the dashboard without needing to refresh the page.
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
            renderKanbanColumns();
            loadAndRenderTasks();
        }
    }
});

/**
 * Handles the creation and modification of forum configurations.
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
        // Update existing forum
        const forum = forums.find(f => f.id === editingId);
        forum.name = name;
        forum.url = url;
        forum.characters = chars;
        editingId = null;
        btnAddForum.textContent = 'Добавить форум';
    } else {
        // Create new forum
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
            <div class="forum-info" style="flex: 1; padding-right: 10px;">
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
 * Event delegation for forum list actions (Edit/Delete forum, Add/Remove character chips).
 */
forumsList.addEventListener('click', (e) => {
    // 1. Handle clicking 'x' on a character chip
    const removeChipBtn = e.target.closest('.char-chip-remove');
    if (removeChipBtn) {
        const forumId = removeChipBtn.getAttribute('data-forum-id');
        const charName = removeChipBtn.getAttribute('data-char');
        pendingDeleteChar = { forumId, charName };
        document.getElementById('delete-char-title').textContent = `Удалить персонажа «${charName}»?`;
        deleteCharModal.style.display = 'flex';
        return;
    }

    // 2. Handle clicking '+ Персонаж' inline button
    const addChipBtn = e.target.closest('.char-chip-add-btn');
    if (addChipBtn) {
        const forumId = addChipBtn.getAttribute('data-forum-id');
        const container = addChipBtn.parentElement;

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

    // 3. Handle Edit / Delete Forum buttons
    const btn = e.target.closest('button');
    if (!btn) return;

    const id = btn.getAttribute('data-id');

    if (btn.classList.contains('btn-delete')) {
        const forumToDelete = forums.find(f => f.id === id);
        if (!forumToDelete) return;

        pendingDeleteForumId = id;
        document.getElementById('delete-forum-title').textContent = `Удалить «${forumToDelete.name}»?`;
        deleteForumModal.style.display = 'flex';
    }

    if (btn.classList.contains('btn-edit')) {
        const forum = forums.find(f => f.id === id);
        inputName.value = forum.name;
        inputUrl.value = forum.url;
        inputChars.value = getForumChars(forum).join(', ');
        
        editingId = id;
        btnAddForum.textContent = 'Сохранить изменения';
    }
});

/**
 * Clears onboarding input fields.
 */
function clearInputs() {
    inputName.value = '';
    inputUrl.value = '';
    inputChars.value = '';
}

/**
 * Validates if the user can proceed.
 * In v1.0.1, we allow saving an empty list to support deleting all forums.
 */
function checkFinishButton() {
    // If we are in "Settings" mode (Cancel button is visible), we CAN save an empty list.
    // If it's the very first onboarding, we force at least one forum.
    if (btnCancelSettings.style.display === 'block') {
        btnFinish.disabled = false; 
    } else {
        btnFinish.disabled = forums.length === 0;
    }
}

/**
 * Persists forum configurations and determines the next view.
 */
btnFinish.addEventListener('click', () => {
    chrome.storage.local.set({ savedForums: forums }, () => {
        // If the user deleted all forums, lock them in the onboarding view
        if (forums.length === 0) {
            btnCancelSettings.style.display = 'none';
            document.querySelector('.onboarding-card h1').textContent = 'Добро пожаловать в трекер! 🎲';
            document.querySelector('.onboarding-card p').textContent = 'Давай добавим твои форумы, чтобы настроить доску.';
            btnFinish.textContent = 'Перейти к доске';
            checkFinishButton(); // Will disable the button since length is 0
        } else {
            // Normal flow: proceed to board
            showKanbanView();
            btnCancelSettings.style.display = 'none';
        }
    });
});

btnArchive.addEventListener('click', () => {
    window.location.href = 'archive.html';
});

/**
 * Transitions back to the settings/onboarding view.
 */
btnSettings.addEventListener('click', () => {
    kanbanView.style.display = 'none';
    onboardingView.style.display = 'flex';

    // Show Cancel button only when accessing from the dashboard
    btnCancelSettings.style.display = 'block';
    
    // Current forums for update/delete
    renderForumsList();
    checkFinishButton(); 
    
    document.querySelector('.onboarding-card h1').textContent = 'Настройки форумов ⚙️';
    document.querySelector('.onboarding-card p').textContent = 'Управление твоими ролевыми проектами.';
    btnFinish.textContent = 'Сохранить и вернуться к доске';
});

/**
 * Switches UI to Kanban mode and initializes board rendering.
 */
function showKanbanView() {
    onboardingView.style.display = 'none';
    kanbanView.style.display = 'flex';
    
    renderKanbanColumns();
    loadAndRenderTasks(); 
}

/**
 * Generates Kanban columns dynamically based on saved forums.
 */
function renderKanbanColumns() {
    const board = document.getElementById('main-board');
    board.innerHTML = ''; 

    forums.forEach(forum => {
        const col = document.createElement('div');
        col.className = 'column';

        const safeName = escapeHTML(forum.name);
        const charList = getForumChars(forum);
        const safeChars = escapeHTML(charList.join(', '));
        const safeUrl = escapeHTML(forum.url);
        
        let charsHtml = safeChars 
            ? `<div style="font-size: 0.8rem; color: var(--text-muted); text-transform: none; letter-spacing: normal; margin-top: 5px;">${ICON_USERS} ${safeChars}</div>` 
            : '';
        
        const forumLink = safeUrl.startsWith('http') ? safeUrl : `https://${safeUrl}`;
        
        col.innerHTML = `
            <h2>
                <a href="${forumLink}" target="_blank" style="color: inherit; text-decoration: none;" title="Перейти на форум">${safeName}</a>
                ${charsHtml}
            </h2>
            <div class="task-list" id="list-${forum.id}"></div>
        `;
        
        board.appendChild(col);
    });
}

/**
 * Fetches tasks from local storage, sorts them by urgency, and renders them in corresponding columns.
 */
function loadAndRenderTasks() {
    chrome.storage.local.get(['rpgTasks'], (result) => {
        let tasks = result.rpgTasks || [];

        // --- CHECK AND RESET DAILIES ---
        const wasUpdated = resetDailiesIfNeeded(tasks);
        if (wasUpdated) {
            // If the script reset checkboxes, save the new data to memory.
            // The chrome.storage.onChanged listener will restart this function,
            // so we just interrupt execution here to avoid rendering twice.
            chrome.storage.local.set({ rpgTasks: tasks });
            return; 
        }
        // -----------------------------------

        const now = new Date().getTime();

        // --- FILTER ARCHIVE ---
        let activeTasks = tasks.filter(t => !t.archived);

        // --- DASHBOARD SUMMARY ---
        const turnsCount = activeTasks.filter(t => t.type === 'turn').length;
        const waitsCount = activeTasks.filter(t => t.type === 'wait').length;
        const totalCharsCount = forums.reduce((sum, f) => sum + getForumChars(f).length, 0);
        
        const summaryEl = document.getElementById('dashboard-summary');
        if (summaryEl) {
            summaryEl.innerHTML = 
                `Активных форумов: <span style="color: var(--accent); font-weight: 600;">${forums.length}</span> &nbsp;•&nbsp; ` +
                `Персонажей: <span style="color: var(--accent); font-weight: 600;">${totalCharsCount}</span> &nbsp;•&nbsp; ` +
                `Мой ход: <span style="color: var(--accent); font-weight: 600;">${turnsCount}</span> &nbsp;•&nbsp; ` +
                `Жду ответа: <span style="color: var(--accent); font-weight: 600;">${waitsCount}</span>`;
        }

        // --- SMART PRIORITY SORTING ---
        activeTasks.sort((a, b) => {
            // 1. Completed tasks ALWAYS go to the absolute bottom
            if (a.completed && !b.completed) return 1;
            if (!a.completed && b.completed) return -1;
            if (a.completed && b.completed) return 0;

            let timeA = new Date(a.date).getTime();
            let timeB = new Date(b.date).getTime();
            
            // Helper function to calculate an absolute "urgency score" for an active task.
            // LOWER score means HIGHER priority (closer to the top of the column).
            function getUrgencyScore(type, targetTime) {
                const diffMs = now - targetTime;
                const diffDays = diffMs / (1000 * 60 * 60 * 24);

                switch(type) {
                    case 'daily':
                        return -10000; // Dailies always at the top

                    case 'deadline':
                        return -5000 - diffDays; // Deadlines (high priority, burns as time goes on)

                    case 'turn':
                        return 0 - diffDays; // Personal debts (older = more urgent)

                    case 'wait':
                        return 5000 - diffDays; // Waiting (lowest active priority)

                    default:
                        return 10000;
                }
            }

            let urgencyA = getUrgencyScore(a.type, timeA);
            let urgencyB = getUrgencyScore(b.type, timeB);

            return urgencyA - urgencyB;
        });

        // --- Sort and distribute tasks across columns ---
        activeTasks.forEach(task => {
            // Find the column that belongs to this forum (id="list-{forumId}")
            const column = document.getElementById(`list-${task.forumId}`);
            if (!column) return; // If the forum was deleted, the card won't be rendered (or you can send it to archive)

            const card = document.createElement('div');
            card.className = `task-card ${task.completed ? 'completed' : getStatusColor(task.type, task.date, now)}`;

            const safeTitle = escapeHTML(task.title);
            const safeUrl = escapeHTML(task.url);
            const safeTag = escapeHTML(task.tag);
            const safeNote = escapeHTML(task.note);

            let titleHtml = task.url ? `<a href="${safeUrl}" target="_blank">${safeTitle}</a>` : safeTitle;
            let timerHtml = getTimerHtml(task.type, task.date, now, task);
            let tagHtml = task.tag ? `<span class="tag">${safeTag}</span>` : '';
            let noteHtml = safeNote ? `<div class="task-note">${safeNote}</div>` : '';

            // --- SMART PING-PONG BUTTON ---
            let pingPongBtnHtml = '';
            if (task.type === 'turn' || task.type === 'wait') {
                const ppTitle = task.type === 'turn' 
                    ? 'Пост написан! Передать ход соигроку (пост сохранится в Архив)' 
                    : 'Ответ получен! Забрать ход себе';
                pingPongBtnHtml = `<button class="btn-pingpong-task" data-task-id="${task.id}" title="${ppTitle}">${ICON_PINGPONG}</button>`;
            }

            // --- SMART COMPLETE BUTTON TOOLTIP ---
            let completeTitle = 'Завершить эпизод';
            if (task.type === 'daily') completeTitle = 'Отметить на сегодня';
            if (task.type === 'deadline') completeTitle = 'Закрыть дедлайн (в Архив)';

            card.innerHTML = `
                <div class="task-header">
                    <div style="flex: 1; padding-right: 10px;">
                        <div class="task-title">${titleHtml}</div>
                        <div class="task-meta" style="margin-top: 5px;">${tagHtml}</div>
                        ${noteHtml}
                        <div class="task-timer" style="color: ${task.completed ? 'inherit' : 'var(--text-main)'}">${timerHtml}</div>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 15px;">
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

        // --- EMPTY STATE FOR COLUMNS ---
        // If a forum column has no active tasks, show a helpful placeholder
        document.querySelectorAll('.task-list').forEach(col => {
            if (col.children.length === 0) {
                col.innerHTML = `
                    <div style="text-align: center; padding: 30px 15px; color: var(--text-muted); font-size: 0.85rem; line-height: 1.5; border: 1px dashed var(--border); border-radius: 6px; margin-top: 5px; opacity: 0.7;">
                        Пока никаких задач.<br>Ты сможешь добавить их прямо со страницы форума, на котором играешь ✨
                    </div>
                `;
            }
        });
    });
}

/**
 * Determines the border color class based on task type and time differential.
 * @param {string} type - Task type ('wait', 'turn', 'daily', 'deadline')
 * @param {string} date - ISO date string
 * @param {number} now - Current timestamp
 * @returns {string} CSS class for status color
 */
function getStatusColor(type, date, now) {
    const target = new Date(date).getTime();
    
    if (type === 'wait' || type === 'turn') {
        // Counting up: time passed since the event occurred
        const diffDays = (now - target) / (1000 * 60 * 60 * 24);
        if (diffDays > 7) return 'status-red';
        if (diffDays > 3) return 'status-yellow';
        return 'status-green';
    } else if (type === 'deadline') {
        // Counting down: time left until deadline
        const leftDays = (target - now) / (1000 * 60 * 60 * 24);
        if (leftDays < 2) return 'status-red';
        if (leftDays < 5) return 'status-yellow';
        return 'status-green';
    } else if (type === 'daily') {
        // Daily tasks reset or are simply marked. Using a green status for MVP.
        return 'status-green'; 
    }
    
    return 'status-green'; // Fallback
}

/**
 * Generates the HTML for the task timer based on its type and time differential.
 * @param {string} type - Task type ('wait', 'turn', 'daily', 'deadline')
 * @param {string} date - ISO date string
 * @param {number} now - Current timestamp
 * @param {Object} task - The full task object (needed to check completion date)
 * @returns {string} HTML string for the timer
 */
function getTimerHtml(type, date, now, task) {
    const target = new Date(date).getTime();
    
    if (type === 'daily') {
        return `<span>Ежедневка</span>`; 
    }

    // Timer fix: which timeReference to use for calculation?
    let timeReference = now;
    // If the task is completed and has a specific completion date, calculate based on that
    if (task && task.completed && task.completionDate) {
        timeReference = new Date(task.completionDate).getTime();
    }
    
    // For wait/turn we calculate how much time has passed. For deadline - how much is left.
    let diff = (type === 'wait' || type === 'turn') ? (timeReference - target) : (target - timeReference);
    
    if (type === 'deadline' && diff < 0) return '<span style="color: var(--red);">Дедлайн горит!</span>';
    
    if (diff < 0) diff = 0;

    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (type === 'wait') return `Жду ответа: ${d}д ${h}ч`;
    if (type === 'turn') return `Мой ход: ${d}д ${h}ч`;
    if (type === 'deadline') return `Осталось: ${d}д ${h}ч`;
    
    return '';
}

/**
 * Deletes a task by ID after user confirmation.
 * @param {string} id - Task identifier
 */
function deleteTask(id) {
    if (confirm('Убрать эту задачу с доски? (В архив она не попадет)')) {
        chrome.storage.local.get(['rpgTasks'], (result) => {
            let tasks = result.rpgTasks || [];
            tasks = tasks.filter(t => t.id !== id);
            chrome.storage.local.set({ rpgTasks: tasks });
        });
    }
}

/**
 * Handles the completion of a task.
 * - 'daily': toggled (completed: true/false) on the board until midnight reset.
 * - 'wait': silently removed from the board (previous posts are already in Archive).
 * - 'turn' / 'deadline': sent to the Archive with a frozen completion timestamp.
 * @param {string} id - Task identifier
 */
function handleCompleteAction(id) {
    chrome.storage.local.get(['rpgTasks'], (result) => {
        let tasks = result.rpgTasks || [];
        const taskIndex = tasks.findIndex(t => t.id === id);

        if (taskIndex > -1) {
            const task = tasks[taskIndex];

            if (task.type === 'daily') {
                task.completed = !task.completed;
            } else if (task.type === 'wait') {
                // Silently remove completed wait task from active board without popup
                tasks.splice(taskIndex, 1);
            } else {
                task.archived = true;
                task.completed = true;
                // Timer frozen: Saving the exact completion time
                task.completionDate = new Date().toISOString();
            }
            
            chrome.storage.local.set({ rpgTasks: tasks });
        }
    });
}

/**
 * Handles the Smart Ping-Pong transition between 'turn' and 'wait'.
 * - 'turn' -> 'wait': Saves a completed copy to the Archive, flips active card to 'wait', and resets timer.
 * - 'wait' -> 'turn': Flips active card to 'turn' and resets timer (no archive entry).
 * @param {string} id - Task identifier
 */
function handlePingPongAction(id) {
    chrome.storage.local.get(['rpgTasks'], (result) => {
        let tasks = result.rpgTasks || [];
        const taskIndex = tasks.findIndex(t => t.id === id);
        
        if (taskIndex > -1) {
            const task = tasks[taskIndex];
            const nowObj = new Date();
            
            // Build local YYYY-MM-DDTHH:MM:SS string for accurate timer reset
            const yyyy = nowObj.getFullYear();
            const mm = String(nowObj.getMonth() + 1).padStart(2, '0');
            const dd = String(nowObj.getDate()).padStart(2, '0');
            const timeStr = nowObj.toTimeString().split(' ')[0];
            const freshDateStr = `${yyyy}-${mm}-${dd}T${timeStr}`;

            if (task.type === 'turn') {
                // 1. Create an archived snapshot of the written post for history & stats
                const archivedCopy = {
                    ...task,
                    id: Date.now().toString() + '_arch',
                    completed: true,
                    archived: true,
                    completionDate: nowObj.toISOString()
                };
                tasks.push(archivedCopy);

                // 2. Flip the active card on the board to 'wait' and reset timer
                task.type = 'wait';
                task.date = freshDateStr;

            } else if (task.type === 'wait') {
                // Co-player replied: flip back to 'turn' and start counting from 0d 0h
                task.type = 'turn';
                task.date = freshDateStr;
            }

            chrome.storage.local.set({ rpgTasks: tasks });
        }
    });
}

// --- Task Editing Logic ---

/**
 * Global click listener for the Kanban board to handle complete/edit/delete events safely.
 */
document.getElementById('main-board').addEventListener('click', (e) => {
    // Find the button that was clicked (using closest to ensure the button itself is targeted)
    const btn = e.target.closest('button');
    if (!btn) return;

    const taskId = btn.getAttribute('data-task-id');
    if (!taskId) return;

    if (btn.classList.contains('btn-pingpong-task')) {
        handlePingPongAction(taskId);
    }

    if (btn.classList.contains('btn-complete-task')) {
        handleCompleteAction(taskId);
    }

    if (btn.classList.contains('btn-delete-task')) {
        deleteTask(taskId);
    }

    if (btn.classList.contains('btn-edit-task')) {
        openEditModal(taskId);
    }
});

/**
 * Opens the edit modal and populates it with task data.
 * @param {string} taskId - Target task identifier
 */
function openEditModal(taskId) {
    chrome.storage.local.get(['rpgTasks'], (result) => {
        const tasks = result.rpgTasks || [];
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        currentEditingTaskId = taskId;
        
        const charInput = document.getElementById('edit-task-char');
        document.getElementById('edit-task-title').value = task.title || '';
        charInput.value = task.tag || '';
        document.getElementById('edit-task-type').value = task.type || 'wait';
        document.getElementById('edit-task-note').value = task.note || '';
        
        if (task.date) {
            document.getElementById('edit-task-date').value = task.date.split('T')[0];
        } else {
            document.getElementById('edit-task-date').value = new Date().toISOString().split('T')[0];
        }

        // Render clickable character pills for this task's forum
        const pillsContainer = document.getElementById('edit-task-char-pills');
        pillsContainer.innerHTML = '';
        const forum = forums.find(f => f.id === task.forumId);
        const forumChars = forum ? getForumChars(forum) : [];

        const syncPillsActiveState = () => {
            const currentNames = charInput.value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
            pillsContainer.querySelectorAll('.char-pill').forEach(pill => {
                const pillName = pill.getAttribute('data-char').toLowerCase();
                pill.classList.toggle('active', currentNames.includes(pillName));
            });
        };

        forumChars.forEach(c => {
            const pill = document.createElement('span');
            pill.className = 'char-pill';
            pill.setAttribute('data-char', c);
            pill.textContent = c;
            pill.title = 'Клик — выбрать персонажа (Ctrl+Клик — выбрать нескольких)';
            pill.addEventListener('click', (ev) => {
                if (ev.ctrlKey || ev.metaKey || ev.shiftKey) {
                    // Multi-select toggle for shared tasks/dailies
                    const existing = charInput.value.split(',').map(s => s.trim()).filter(Boolean);
                    const idx = existing.findIndex(x => x.toLowerCase() === c.toLowerCase());
                    if (idx > -1) existing.splice(idx, 1);
                    else existing.push(c);
                    charInput.value = existing.join(', ');
                } else {
                    charInput.value = c;
                }
                syncPillsActiveState();
            });
            pillsContainer.appendChild(pill);
        });

        charInput.oninput = syncPillsActiveState;
        syncPillsActiveState();

        editModal.style.display = 'flex';
    });
}

/**
 * Modal Cancel action
 */
document.getElementById('btn-cancel-edit').addEventListener('click', () => {
    editModal.style.display = 'none';
    currentEditingTaskId = null;
});

/**
 * Modal Save action
 */
document.getElementById('btn-save-task-edit').addEventListener('click', () => {
    if (!currentEditingTaskId) return;

    chrome.storage.local.get(['rpgTasks'], (result) => {
        let tasks = result.rpgTasks || [];
        const taskIndex = tasks.findIndex(t => t.id === currentEditingTaskId);
        
        if (taskIndex > -1) {
            const newType = document.getElementById('edit-task-type').value;
            const rawDate = document.getElementById('edit-task-date').value;
            
            // // SMART TIME INJECTION (Preserves original hours if the date wasn't changed)
            const oldDateObj = tasks[taskIndex].date || '';
            const oldDay = oldDateObj.split('T')[0];
            const oldTime = oldDateObj.split('T')[1];

            let finalDateStr = rawDate;
            if (newType === 'deadline') {
                finalDateStr = `${rawDate}T23:59:59`;
            } else if (newType === 'turn' || newType === 'wait') {
                // Keep original start time if day didn't change and it wasn't a deadline
                const timeToUse = (rawDate === oldDay && oldTime && oldTime !== '23:59:59')
                    ? oldTime
                    : new Date().toTimeString().split(' ')[0];
                finalDateStr = `${rawDate}T${timeToUse}`;
            }

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

            chrome.storage.local.set({ rpgTasks: tasks }, () => {
                editModal.style.display = 'none';
                currentEditingTaskId = null;
            });
        }
    });
});

/**
 * Cancels settings edits and returns to the Kanban board without saving.
 */
btnCancelSettings.addEventListener('click', () => {
    // Re-fetch original data from memory to discard unsaved changes
    chrome.storage.local.get(['savedForums'], (result) => {
        forums = result.savedForums || [];
        showKanbanView();
        
        // Hide cancel button for next potential fresh onboarding
        btnCancelSettings.style.display = 'none'; 
    });
});

/**
 * Checks and resets daily tasks if a new day has started in Moscow (UTC+3).
 * @param {Array} tasks - Array of task objects
 * @returns {boolean} - Returns true if any task was modified
 */
function resetDailiesIfNeeded(tasks) {
    // Get current time specifically in the Moscow time zone
    const moscowTime = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/Moscow"}));
    
    // Form the YYYY-MM-DD string for Moscow
    const yyyy = moscowTime.getFullYear();
    const mm = String(moscowTime.getMonth() + 1).padStart(2, '0');
    const dd = String(moscowTime.getDate()).padStart(2, '0');
    const todayMoscow = `${yyyy}-${mm}-${dd}`;

    let needsUpdate = false;

    tasks.forEach(task => {
        if (task.type === 'daily') {
            // If the daily task date is earlier than today's date in Moscow
            if (task.date < todayMoscow) {
                task.date = todayMoscow; // Update the date
                task.completed = false;  // Remove the completion check
                needsUpdate = true;
            }
        }
    });

    return needsUpdate;
}

/**
 * Executes forum deletion with the chosen archive strategy.
 * @param {boolean} keepArchive - True to preserve archived tasks, false to wipe all
 */
function executeForumDeletion(keepArchive) {
    if (!pendingDeleteForumId) return;
    
    const id = pendingDeleteForumId;
    const forumToDelete = forums.find(f => f.id === id);
    if (!forumToDelete) return;

    // Remove forum from active array
    forums = forums.filter(f => f.id !== id);

    // CASCADING DELETE: Handle tasks associated with this forum ID
    chrome.storage.local.get(['rpgTasks'], (result) => {
        let tasks = result.rpgTasks || [];

        if (keepArchive) {
            // Soft delete: keep archived tasks, remove only active ones
            tasks = tasks.filter(t => t.forumId !== id || t.archived);
            
            // Bake the forum name into orphaned archived tasks
            tasks.forEach(t => {
                if (t.forumId === id && t.archived) {
                    t.forumName = forumToDelete.name;
                }
            });
        } else {
            // Hard delete: remove all tasks for this forum
            tasks = tasks.filter(t => t.forumId !== id);
        }

        chrome.storage.local.set({ rpgTasks: tasks });
    });

    // Reset modal state and update UI
    deleteForumModal.style.display = 'none';
    pendingDeleteForumId = null;
    renderForumsList();
    checkFinishButton();
}

/**
 * Executes character deletion from a forum.
 * @param {boolean} removeActiveTasks - True to also remove/clean active tasks for this character
 */
function executeCharDeletion(removeActiveTasks) {
    if (!pendingDeleteChar) return;
    const { forumId, charName } = pendingDeleteChar;
    const forum = forums.find(f => f.id === forumId);
    if (!forum) return;

    // 1. Remove character from the forum's list
    forum.characters = getForumChars(forum).filter(
        c => c.toLowerCase() !== charName.toLowerCase()
    );
    chrome.storage.local.set({ savedForums: forums });

    // 2. Optionally clean up active tasks associated with this character
    if (removeActiveTasks) {
        chrome.storage.local.get(['rpgTasks'], (result) => {
            let tasks = result.rpgTasks || [];
            const targetLower = charName.toLowerCase();

            tasks = tasks.filter(t => {
                // Never delete archived history or tasks from other forums
                if (t.archived || t.forumId !== forumId || !t.tag) return true;

                const taskChars = t.tag.split(',').map(s => s.trim()).filter(Boolean);
                const hasTarget = taskChars.some(c => c.toLowerCase() === targetLower);
                if (!hasTarget) return true;

                // Filter out the deleted character
                const remainingChars = taskChars.filter(c => c.toLowerCase() !== targetLower);
                if (remainingChars.length > 0) {
                    // Shared task with multiple characters: keep task, just update tag
                    t.tag = remainingChars.join(', ');
                    return true;
                }
                // Single-character active task: remove from board
                return false;
            });

            chrome.storage.local.set({ rpgTasks: tasks });
        });
    }

    closeDeleteCharModal();
    renderForumsList();
}

function closeDeleteCharModal() {
    deleteCharModal.style.display = 'none';
    pendingDeleteChar = null;
}

document.getElementById('btn-char-delete-with-tasks').addEventListener('click', () => executeCharDeletion(true));
document.getElementById('btn-char-delete-keep-tasks').addEventListener('click', () => executeCharDeletion(false));
document.getElementById('btn-cancel-char-delete').addEventListener('click', closeDeleteCharModal);
document.getElementById('btn-close-char-delete-modal').addEventListener('click', closeDeleteCharModal);

// Modal button listeners
document.getElementById('btn-delete-keep-archive').addEventListener('click', () => executeForumDeletion(true));
document.getElementById('btn-delete-wipe-all').addEventListener('click', () => executeForumDeletion(false));

function closeDeleteForumModal() {
    deleteForumModal.style.display = 'none';
    pendingDeleteForumId = null;
}

document.getElementById('btn-cancel-delete-forum').addEventListener('click', closeDeleteForumModal);
document.getElementById('btn-close-delete-modal').addEventListener('click', closeDeleteForumModal);

// Close modals on 'Escape' key press or clicking outside the card
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (deleteForumModal.style.display === 'flex') closeDeleteForumModal();
        if (editModal.style.display === 'flex') {
            editModal.style.display = 'none';
            currentEditingTaskId = null;
        }
        if (deleteCharModal.style.display === 'flex') closeDeleteCharModal();
    }
});

})();
