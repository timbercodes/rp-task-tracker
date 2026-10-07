// 1. При загрузке страницы спрашиваем у браузера наши форумы и задачи
chrome.storage.local.get(['savedForums', 'rpgTasks'], (result) => {
    const forums = result.savedForums || [];
    let tasks = result.rpgTasks || [];
    const currentHost = window.location.hostname;

    // Ищем, есть ли текущий сайт в нашем списке (сравниваем домены)
    const matchedForum = forums.find(f => currentHost.includes(f.url) || f.url.includes(currentHost));

    // Если форум найден в базе — инжектим кнопку
    if (matchedForum) {
        injectUI(matchedForum, tasks);
    }
});

function injectUI(forum, tasks) {
    // 2. Создаем плавающую кнопку
    const btn = document.createElement('button');
    btn.id = 'rpt-floating-btn';
    btn.innerHTML = '📝';
    btn.title = 'Добавить в трекер долгов';
    document.body.appendChild(btn);

    // 3. Создаем мини-модальное окно
    const modal = document.createElement('div');
    modal.id = 'rpt-modal';
    
    // Очищаем тайтл (Rusff обычно ставит тире, вытаскиваем первую часть до тире)
    let cleanTitle = document.title.split(' - ')[0].trim();
    
    // Если у юзера указано несколько персонажей, берем первого по умолчанию
    let defaultChar = forum.characters ? forum.characters.split(',')[0].trim() : '';

    // Получаем сегодня в формате YYYY-MM-DD для подстановки по умолчанию
    const today = new Date().toISOString().split('T')[0];

    modal.innerHTML = `
        <span class="rpt-close" id="rpt-close-btn">&times;</span>
        <h4 style="margin: 0; color: #64ffda; font-size: 16px;">Новый долг: ${forum.name}</h4>
        
        <label style="font-size: 12px; color: #888;">Название темы</label>
        <input type="text" id="rpt-title" value="${cleanTitle}">
        
        <label style="font-size: 12px; color: #888;">Персонаж</label>
        <input type="text" id="rpt-char" value="${defaultChar}" placeholder="Чей пост?">
        
        <label style="font-size: 12px; color: #888;">Тип задачи</label>
        <select id="rpt-type">
            <option value="wait">Жду ответа (Счетчик вверх)</option>
            <option value="deadline">Дедлайн (Таймер вниз)</option>
        </select>
        
        <label style="font-size: 12px; color: #888;">Дата (отсчета или дедлайна)</label>
        <input type="date" id="rpt-date" value="${today}">
        
        <button id="rpt-save-btn">Сохранить</button>
    `;
    document.body.appendChild(modal);

    btn.addEventListener('click', () => modal.classList.toggle('rpt-active'));
    document.getElementById('rpt-close-btn').addEventListener('click', () => modal.classList.remove('rpt-active'));

    document.getElementById('rpt-save-btn').addEventListener('click', () => {
        const title = document.getElementById('rpt-title').value;
        const char = document.getElementById('rpt-char').value;
        const type = document.getElementById('rpt-type').value;
        const date = document.getElementById('rpt-date').value;
        const url = window.location.href;

        if (!date) return alert('Укажи дату!');

        const newTask = {
            id: Date.now().toString(),
            forumId: forum.id,
            title: title,
            url: url,
            tag: char,
            type: type,
            date: date, // Теперь берем железно выбранную дату
            completed: false,
            archived: false
        };

        tasks.push(newTask);
        chrome.storage.local.set({ rpgTasks: tasks }, () => {
            btn.innerHTML = '✅';
            modal.classList.remove('rpt-active');
            setTimeout(() => btn.innerHTML = '📝', 2000);
        });
    });
}
