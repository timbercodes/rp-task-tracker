/**
 * RP Task Tracker - Archive Controller
 * Handles the display of completed/archived tasks.
 */

(() => {

document.getElementById('btn-back-dashboard').addEventListener('click', () => {
    window.location.href = 'dashboard.html';
});

document.addEventListener('DOMContentLoaded', () => {
    loadArchive();
});

function loadArchive() {
    chrome.storage.local.get(['rpgTasks', 'savedForums'], (result) => {
        const allTasks = result.rpgTasks || [];
        const forums = result.savedForums || [];
        
        // Берем только архивные задачи
        let archivedTasks = allTasks.filter(t => t.archived);

        // Сортируем от самых недавно завершенных к старым
        archivedTasks.sort((a, b) => {
            const timeA = a.completionDate ? new Date(a.completionDate).getTime() : 0;
            const timeB = b.completionDate ? new Date(b.completionDate).getTime() : 0;
            return timeB - timeA;
        });

        const listContainer = document.getElementById('archive-list');
        listContainer.innerHTML = '';

        if (archivedTasks.length === 0) {
            listContainer.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 40px;">Архив пуст. Выполни задачу на доске, чтобы она появилась здесь!</p>';
            return;
        }

        archivedTasks.forEach(task => {
            // Ищем название форума для красивого отображения
            const forum = forums.find(f => f.id === task.forumId);
            const forumName = forum ? forum.name : 'Неизвестный форум';

            // Форматируем дату завершения (ДД.ММ.ГГГГ)
            const finishDate = task.completionDate ? new Date(task.completionDate).toLocaleDateString('ru-RU') : 'Неизвестно';

            const safeTitle = escapeHTML(task.title);
            const safeUrl = escapeHTML(task.url);
            const safeTag = escapeHTML(task.tag);
            
            let titleHtml = task.url ? `<a href="${safeUrl}" target="_blank" style="color: var(--text-main); text-decoration: none; font-weight: 600; font-size: 1.1rem;">${safeTitle}</a>` : `<span style="font-weight: 600; font-size: 1.1rem;">${safeTitle}</span>`;
            let tagHtml = task.tag ? `<span class="tag" style="background: #333; padding: 2px 8px; border-radius: 4px; color: #ccc;">${safeTag}</span>` : '';

            // Высчитываем затраченное время (только для Моих долгов и Ожидания)
            let timeTakenHtml = '';
            if ((task.type === 'turn' || task.type === 'wait') && task.completionDate && task.date) {
                const start = new Date(task.date).getTime();
                const end = new Date(task.completionDate).getTime();
                let diff = end - start;
                if (diff > 0) {
                    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
                    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    
                    const prefix = task.type === 'turn' ? 'Пост написан за:' : 'Ответа ждали:';
                    timeTakenHtml = `<div class="time-taken">${prefix} ${d}д ${h}ч</div>`;
                }
            } else if (task.type === 'deadline') {
                timeTakenHtml = `<div style="color: var(--text-muted);">Дедлайн закрыт</div>`;
            }

            const typeLabel = getTypeLabel(task.type);

            const card = document.createElement('div');
            card.className = 'archive-card';
            
            card.innerHTML = `
                <div>
                    <div>${titleHtml}</div>
                    <div class="archive-meta">
                        <span style="color: var(--accent);">${forumName}</span>
                        <span>•</span>
                        <span>${typeLabel}</span>
                        ${tagHtml ? `<span>•</span> ${tagHtml}` : ''}
                    </div>
                </div>
                <div class="archive-stats">
                    ${timeTakenHtml}
                    <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 5px;">Завершено: ${finishDate}</div>
                </div>
            `;
            
            listContainer.appendChild(card);
        });
    });
}

function getTypeLabel(type) {
    switch(type) {
        case 'turn': return 'Мой долг';
        case 'wait': return 'Ожидание';
        case 'deadline': return 'Срочный дедлайн';
        default: return 'Задача';
    }
}

})();
