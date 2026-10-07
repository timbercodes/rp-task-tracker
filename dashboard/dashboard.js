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

// 7. Функция показа доски (здесь же красивая заглушка)
function showKanbanView() {
    onboardingView.style.display = 'none';
    kanbanView.style.display = 'flex';
    
    // Формируем красивый HTML-список из массива форумов
    const forumsHtmlList = forums.map(f => {
        let charsInfo = f.characters ? `<span style="color: var(--text-muted); font-size: 0.9em;">(Персонажи: ${f.characters})</span>` : '';
        return `<li style="margin-bottom: 8px;">🔹 <b>${f.name}</b> ${charsInfo}</li>`;
    }).join('');

    // Временная заглушка вместо колонок
    document.getElementById('main-board').innerHTML = 
        `<div style="padding: 20px; background: var(--surface); border-radius: 8px; border: 1px solid var(--border); width: 100%; max-width: 600px;">
            <h3 style="color: var(--green); margin-bottom: 15px;">✅ Данные успешно загружены!</h3>
            <p style="margin-bottom: 10px;">Активные проекты:</p>
            <ul style="list-style: none; padding: 0;">
                ${forumsHtmlList}
            </ul>
            <p style="color: var(--text-muted); margin-top: 20px; font-size: 0.9em;">
                🔜 Совсем скоро здесь появится генерация колонок.
            </p>
        </div>`;
}
