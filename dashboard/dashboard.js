/**
 * RP Task Tracker - Dashboard Controller
 * Handles UI interactions, local storage operations, and Kanban board rendering.
 */

let forums = [];
let editingId = null;
let currentEditingTaskId = null;

// --- DOM Elements ---
const onboardingView = document.getElementById('onboarding-view');
const kanbanView = document.getElementById('kanban-view');
const btnAddForum = document.getElementById('btn-add-forum');
const btnFinish = document.getElementById('btn-finish-onboarding');
const forumsList = document.getElementById('added-forums-list');
const btnSettings = document.getElementById('btn-settings');
const editModal = document.getElementById('task-edit-modal');

// --- Input Fields ---
const inputName = document.getElementById('forum-name');
const inputUrl = document.getElementById('forum-url');
const inputChars = document.getElementById('forum-chars');

// --- SVG Icons ---
const ICON_CHECK = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
const ICON_EDIT = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
const ICON_TRASH = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
const ICON_SETTINGS = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
const ICON_USERS = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; opacity: 0.7;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`;

/**
 * Initializes the extension state on DOM load.
 * Checks for existing configurations and routes to the appropriate view.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Inject the settings icon into the HTML button
    document.getElementById('btn-settings').innerHTML = ICON_SETTINGS;

    chrome.storage.local.get(['savedForums'], (result) => {
        if (result.savedForums && result.savedForums.length > 0) {
            forums = result.savedForums;
            showKanbanView();
        }
    });
});

/**
 * Real-time Sync: Listens for storage changes from other tabs (or the floating button)
 * and automatically re-renders the dashboard without needing to refresh the page.
 */
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.rpgTasks) {
        // Перерисовываем колонки и задачи мгновенно
        renderKanbanColumns();
        loadAndRenderTasks();
    }
});

/**
 * Handles the creation and modification of forum configurations.
 */
btnAddForum.addEventListener('click', () => {
    const name = inputName.value.trim();
    const url = inputUrl.value.trim();
    const chars = inputChars.value.trim();

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
 * Renders the list of configured forums in the onboarding/settings view.
 */
function renderForumsList() {
    forumsList.innerHTML = '';
    
    forums.forEach(forum => {
        const item = document.createElement('div');
        item.className = 'forum-item';
        
        // Build the HTML with SVG constants instead of emojis
        item.innerHTML = `
            <div class="forum-info">
                <strong>${forum.name}</strong>
                <span>${forum.url}</span>
                ${forum.characters ? `<span>${ICON_USERS}${forum.characters}</span>` : ''}
            </div>
            <div class="forum-actions">
                <button class="btn-edit" data-id="${forum.id}" title="Редактировать">${ICON_EDIT}</button>
                <button class="btn-delete" data-id="${forum.id}" title="Удалить">${ICON_TRASH}</button>
            </div>
        `;
        forumsList.appendChild(item);
    });
}

/**
 * Event delegation for forum list actions (Edit/Delete).
 */
forumsList.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const id = btn.getAttribute('data-id');

    if (btn.classList.contains('btn-delete')) {
        forums = forums.filter(f => f.id !== id);
        renderForumsList();
        checkFinishButton();
    }

    if (btn.classList.contains('btn-edit')) {
        const forum = forums.find(f => f.id === id);
        inputName.value = forum.name;
        inputUrl.value = forum.url;
        inputChars.value = forum.characters || '';
        
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
 * Validates if the user can proceed to the Kanban board.
 */
function checkFinishButton() {
    btnFinish.disabled = forums.length === 0;
}

/**
 * Persists forum configurations and transitions to the Kanban view.
 */
btnFinish.addEventListener('click', () => {
    chrome.storage.local.set({ savedForums: forums }, () => {
        showKanbanView();
    });
});

/**
 * Transitions back to the settings/onboarding view.
 */
btnSettings.addEventListener('click', () => {
    kanbanView.style.display = 'none';
    onboardingView.style.display = 'flex';
    
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
        
        let charsHtml = forum.characters 
            ? `<div style="font-size: 0.8rem; color: var(--text-muted); text-transform: none; letter-spacing: normal; margin-top: 5px;">🎭 ${forum.characters}</div>` 
            : '';
        
        const forumLink = forum.url.startsWith('http') ? forum.url : `https://${forum.url}`;
        
        col.innerHTML = `
            <h2>
                <a href="${forumLink}" target="_blank" style="color: inherit; text-decoration: none;" title="Перейти на форум">${forum.name}</a>
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
        const tasks = result.rpgTasks || [];
        const now = new Date().getTime();

        // Sort tasks: Urgent deadlines and long-awaited replies at the top
        tasks.sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            
            let timeA = new Date(a.date).getTime();
            let timeB = new Date(b.date).getTime();
            
            let urgencyA = a.type === 'deadline' ? timeA - now : now - timeA;
            let urgencyB = b.type === 'deadline' ? timeB - now : now - timeB;

            return urgencyA - urgencyB;
        });

        // Sort and distribute tasks across columns
        tasks.forEach(task => {
            // Find the column that belongs to this forum (id="list-{forumId}")
            const column = document.getElementById(`list-${task.forumId}`);
            if (!column) return; // If the forum was deleted, the card won't be rendered (or you can send it to archive)

            const card = document.createElement('div');
            card.className = `task-card ${task.completed ? 'completed' : getStatusColor(task.type, task.date, now)}`;
            
            let titleHtml = task.url ? `<a href="${task.url}" target="_blank">${task.title}</a>` : task.title;
            let timerHtml = getTimerHtml(task.type, task.date, now);
            let tagHtml = task.tag ? `<span class="tag">${task.tag}</span>` : '';

            card.innerHTML = `
                <div class="task-header">
                    <div>
                        <div class="task-title">${titleHtml}</div>
                        <div class="task-meta" style="margin-top: 5px;">${tagHtml}</div>
                        <div class="task-timer" style="color: ${task.completed ? 'inherit' : 'var(--text-main)'}">${timerHtml}</div>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 15px;">
                        <div class="task-actions">
                            <button class="btn-complete-task" data-task-id="${task.id}" title="Выполнено/В архив">${ICON_CHECK}</button>
                            <button class="btn-edit-task" data-task-id="${task.id}" title="Редактировать">${ICON_EDIT}</button>
                            <button class="btn-delete-task" data-task-id="${task.id}" title="Удалить">${ICON_TRASH}</button>
                        </div>
                    </div>
                </div>
            `;
            
            column.appendChild(card);
        });
    });
}

/**
 * Determines the border color class based on task type and time differential.
 * @param {string} type - Task type ('wait' or 'deadline')
 * @param {string} date - ISO date string
 * @param {number} now - Current timestamp
 * @returns {string} CSS class for status color
 */
function getStatusColor(type, date, now) {
    const target = new Date(date).getTime();
    const diffDays = (now - target) / (1000 * 60 * 60 * 24);
    
    if (type === 'wait') {
        if (diffDays > 7) return 'status-red';
        if (diffDays > 3) return 'status-yellow';
        return 'status-green';
    } else {
        const leftDays = (target - now) / (1000 * 60 * 60 * 24);
        if (leftDays < 2) return 'status-red';
        if (leftDays < 5) return 'status-yellow';
        return 'status-green';
    }
}

/**
 * Generates the HTML for the task timer based on its type and time differential.
 * @param {string} type - Task type ('wait' or 'deadline')
 * @param {string} date - ISO date string
 * @param {number} now - Current timestamp
 * @returns {string} HTML string for the timer
 */
function getTimerHtml(type, date, now) {
    const target = new Date(date).getTime();
    let diff = type === 'wait' ? now - target : target - now;
    
    if (type === 'deadline' && diff < 0) return '<span style="color: var(--red);">Просрочено!</span>';
    
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    let prefix = type === 'wait' ? 'Жду ответа: ' : 'Осталось: ';
    return `${prefix} ${d}д ${h}ч`;
}

/**
 * Deletes a task by ID after user confirmation.
 * @param {string} id - Task identifier
 */
function deleteTask(id) {
    if (confirm('Точно удалить этот долг?')) {
        chrome.storage.local.get(['rpgTasks'], (result) => {
            let tasks = result.rpgTasks || [];
            tasks = tasks.filter(t => t.id !== id);
            chrome.storage.local.set({ rpgTasks: tasks });
        });
    }
}

/**
 * Toggles the 'completed' status of a task.
 * Thanks to the storage listener, changing this will automatically trigger a re-render.
 * @param {string} id - Task identifier
 */
function toggleTaskCompletion(id) {
    chrome.storage.local.get(['rpgTasks'], (result) => {
        let tasks = result.rpgTasks || [];
        const task = tasks.find(t => t.id === id);
        
        if (task) {
            task.completed = !task.completed;
            
            // Saving to memory. UI will update automatically due to chrome.storage.onChanged
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

    if (btn.classList.contains('btn-complete-task')) {
        toggleTaskCompletion(taskId);
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
        
        document.getElementById('edit-task-title').value = task.title || '';
        document.getElementById('edit-task-char').value = task.tag || '';
        document.getElementById('edit-task-type').value = task.type || 'wait';
        
        // Failsafe date parsing
        if (task.date) {
            document.getElementById('edit-task-date').value = task.date.split('T')[0];
        } else {
            document.getElementById('edit-task-date').value = new Date().toISOString().split('T')[0];
        }

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
            tasks[taskIndex].title = document.getElementById('edit-task-title').value;
            tasks[taskIndex].tag = document.getElementById('edit-task-char').value;
            tasks[taskIndex].type = document.getElementById('edit-task-type').value;
            tasks[taskIndex].date = document.getElementById('edit-task-date').value;

            chrome.storage.local.set({ rpgTasks: tasks }, () => {
                editModal.style.display = 'none';
                currentEditingTaskId = null;
            });
        }
    });
});
