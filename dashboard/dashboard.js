let forums = [];
let editingId = null;

// DOM элементы
const onboardingView = document.getElementById('onboarding-view');
const kanbanView = document.getElementById('kanban-view');
const btnAddForum = document.getElementById('btn-add-forum');
const btnFinish = document.getElementById('btn-finish-onboarding');
const forumsList = document.getElementById('added-forums-list');
const btnSettings = document.getElementById('btn-settings'); // <-- Поймали кнопку настроек

// Инпуты
const inputName = document.getElementById('forum-name');
const inputUrl = document.getElementById('forum-url');
const inputChars = document.getElementById('forum-chars');

// 1. Проверяем память при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['savedForums'], (result) => {
        if (result.savedForums && result.savedForums.length > 0) {
            forums = result.savedForums;
            showKanbanView(); // Вынесли переключение экранов в отдельную функцию
        }
    });
});

// 2. Добавление или сохранение форума
btnAddForum.addEventListener('click', () => {
    const name = inputName.value.trim();
    const url = inputUrl.value.trim();
    const chars = inputChars.value.trim();

    if (!name || !url) {
        alert('Название и ссылка обязательны!');
        return;
    }

    if (editingId) {
        const forum = forums.find(f => f.id === editingId);
        forum.name = name;
        forum.url = url;
        forum.characters = chars;
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

// 3. Отрисовка списка 
function renderForumsList() {
    forumsList.innerHTML = '';
    
    forums.forEach(forum => {
        const item = document.createElement('div');
        item.className = 'forum-item';
        item.innerHTML = `
            <div class="forum-info">
                <strong>${forum.name}</strong>
                <span>${forum.url}</span>
                ${forum.characters ? `<span>🎭 ${forum.characters}</span>` : ''}
            </div>
            <div class="forum-actions">
                <button class="btn-edit" data-id="${forum.id}" title="Редактировать">✏️</button>
                <button class="btn-delete" data-id="${forum.id}" title="Удалить">❌</button>
            </div>
        `;
        forumsList.appendChild(item);
    });
}

// 4. Делегирование событий
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

function clearInputs() {
    inputName.value = '';
    inputUrl.value = '';
    inputChars.value = '';
}

function checkFinishButton() {
    btnFinish.disabled = forums.length === 0;
}

// 5. Финализация онбординга
btnFinish.addEventListener('click', () => {
    chrome.storage.local.set({ savedForums: forums }, () => {
        showKanbanView();
    });
});

// 6. Открытие настроек (Возврат к онбордингу)
btnSettings.addEventListener('click', () => {
    kanbanView.style.display = 'none';
    onboardingView.style.display = 'flex';
    
    // Отрисовываем текущие форумы, чтобы юзер мог их удалить/редактировать
    renderForumsList();
    checkFinishButton(); 
    
    // Меняем текст кнопки, чтобы было логичнее
    document.querySelector('.onboarding-card h1').textContent = 'Настройки форумов ⚙️';
    document.querySelector('.onboarding-card p').textContent = 'Управление твоими ролевыми проектами.';
    btnFinish.textContent = 'Сохранить и вернуться к доске';
});

// 7. Функция показа доски и генерация колонок
function showKanbanView() {
    onboardingView.style.display = 'none';
    kanbanView.style.display = 'flex';
    
    renderKanbanColumns();
    loadAndRenderTasks(); 
}

function renderKanbanColumns() {
    const board = document.getElementById('main-board');
    board.innerHTML = ''; // Очищаем доску от старых данных

    forums.forEach(forum => {
        const col = document.createElement('div');
        col.className = 'column';
        
        // Если у форума указаны персонажи, добавляем их аккуратной подписью под названием
        let charsHtml = forum.characters 
            ? `<div style="font-size: 0.8rem; color: var(--text-muted); text-transform: none; letter-spacing: normal; margin-top: 5px;">🎭 ${forum.characters}</div>` 
            : '';
        
        // Генерируем колонку. Обрати внимание на id="list-${forum.id}" — 
        // именно сюда мы потом будем складывать карточки задач для конкретного форума.
        col.innerHTML = `
            <h2>
                ${forum.name}
                ${charsHtml}
            </h2>
            <div class="task-list" id="list-${forum.id}"></div>
        `;
        
        board.appendChild(col);
    });
}

// --- ДОБАВЛЯЕМ В САМЫЙ НИЗ ФАЙЛА dashboard/dashboard.js ---

// Функция вызывается внутри showKanbanView после отрисовки колонок
function loadAndRenderTasks() {
    chrome.storage.local.get(['rpgTasks'], (result) => {
        const tasks = result.rpgTasks || [];
        const now = new Date().getTime();

        // Сортируем: дедлайны поближе — наверх, ждуны подольше — наверх
        tasks.sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            
            let timeA = new Date(a.date).getTime();
            let timeB = new Date(b.date).getTime();
            
            let urgencyA = a.type === 'deadline' ? timeA - now : now - timeA;
            let urgencyB = b.type === 'deadline' ? timeB - now : now - timeB;

            return urgencyA - urgencyB;
        });

        // Раскидываем карточки по колонкам
        tasks.forEach(task => {
            // Ищем колонку, которая принадлежит этому форуму (мы задавали id="list-{forumId}")
            const column = document.getElementById(`list-${task.forumId}`);
            if (!column) return; // Если форум удалили, карточка пока не рендерится (или можно отправлять в архив)

            const card = document.createElement('div');
            // getStatusColor определит цвет левой рамки в зависимости от просрочки
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
                        <button class="btn-edit-task" data-task-id="${task.id}" style="background: none; border: none; cursor: pointer; font-size: 1.1rem;" title="Редактировать">✏️</button>
                        <button class="btn-delete-task" data-task-id="${task.id}" style="background: none; border: none; cursor: pointer; font-size: 1.1rem;" title="Удалить">🗑️</button>
                    </div>
                </div>
            `;
            
            column.appendChild(card);
        });
    });
}

// Вспомогательные функции для таймеров и цветов
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

function getTimerHtml(type, date, now) {
    const target = new Date(date).getTime();
    let diff = type === 'wait' ? now - target : target - now;
    
    if (type === 'deadline' && diff < 0) return '<span style="color: var(--red);">Просрочено!</span>';
    
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    let prefix = type === 'wait' ? 'Жду ответа: ' : 'Осталось: ';
    return `${prefix} ${d}д ${h}ч`;
}

function deleteTask(id) {
    if (confirm('Точно удалить этот долг?')) {
        chrome.storage.local.get(['rpgTasks'], (result) => {
            let tasks = result.rpgTasks || [];
            tasks = tasks.filter(t => t.id !== id);
            chrome.storage.local.set({ rpgTasks: tasks }, () => {
                // Очищаем колонки и перерисовываем заново
                renderKanbanColumns(); 
                loadAndRenderTasks();
            });
        });
    }
}

// --- ЛОГИКА РЕДАКТИРОВАНИЯ ЗАДАЧ ---
// --- ЛОГИКА КЛИКОВ ПО КАРТОЧКАМ (РЕДАКТИРОВАНИЕ И УДАЛЕНИЕ) ---
let currentEditingTaskId = null;
const editModal = document.getElementById('task-edit-modal');

// Один умный слушатель на всю доску
document.getElementById('main-board').addEventListener('click', (e) => {
    // Ищем, был ли клик по кнопке (используем closest, чтобы иконка не перехватывала клик)
    const btn = e.target.closest('button');
    if (!btn) return;

    const taskId = btn.getAttribute('data-task-id');
    if (!taskId) return;

    if (btn.classList.contains('btn-delete-task')) {
        deleteTask(taskId);
    }

    if (btn.classList.contains('btn-edit-task')) {
        openEditModal(taskId);
    }
});

function openEditModal(taskId) {
    chrome.storage.local.get(['rpgTasks'], (result) => {
        const tasks = result.rpgTasks || [];
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        currentEditingTaskId = taskId;
        
        document.getElementById('edit-task-title').value = task.title || '';
        document.getElementById('edit-task-char').value = task.tag || '';
        document.getElementById('edit-task-type').value = task.type || 'wait';
        
        // Бронебойная проверка даты: если даты нет, ставим "сегодня"
        if (task.date) {
            document.getElementById('edit-task-date').value = task.date.split('T')[0];
        } else {
            document.getElementById('edit-task-date').value = new Date().toISOString().split('T')[0];
        }

        editModal.style.display = 'flex';
    });
}

// Кнопка отмены
document.getElementById('btn-cancel-edit').addEventListener('click', () => {
    editModal.style.display = 'none';
    currentEditingTaskId = null;
});

// Сохранение изменений
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
                renderKanbanColumns(); 
                loadAndRenderTasks();
            });
        }
    });
});
