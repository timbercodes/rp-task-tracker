/**
 * RP Task Tracker - Archive Controller
 * Renders the history of completed roleplay posts and closed deadlines.
 * Note: Relies on scripts/utils.js being loaded first.
 */

(() => {

document.getElementById('btn-back-dashboard').addEventListener('click', () => {
    window.location.href = 'dashboard.html';
});

document.addEventListener('DOMContentLoaded', () => {
    loadArchive();
});

/**
 * Fetches archived tasks from storage, sorts them chronologically (newest first),
 * and renders archive cards into the DOM.
 */

function loadArchive() {
    chrome.storage.local.get(['rpgTasks', 'savedForums'], (result) => {
        const allTasks = result.rpgTasks || [];
        const forums = result.savedForums || [];

        const archivedTasks = allTasks.filter(t => t.archived);

        // Sort from most recently completed to oldest
        archivedTasks.sort((a, b) => {
            const timeA = a.completionDate ? new Date(a.completionDate).getTime() : 0;
            const timeB = b.completionDate ? new Date(b.completionDate).getTime() : 0;
            return timeB - timeA;
        });

        const listContainer = document.getElementById('archive-list');
        listContainer.innerHTML = '';

        if (archivedTasks.length === 0) {
            listContainer.innerHTML = `
                <p class="archive-empty">
                    В архиве пока тихо.<br>
                    Когда ты сдашь первый пост или закроешь дедлайн, он появится здесь на память ✨
                </p>
            `;
            return;
        }

        archivedTasks.forEach(task => {
            // Resolve forum name (fallback to baked-in task.forumName if forum was deleted)
            const forum = forums.find(f => f.id === task.forumId);
            const rawForumName = forum ? forum.name : (task.forumName || 'Удаленный форум');
            const safeForumName = escapeHTML(rawForumName);

            const finishDate = task.completionDate
                ? new Date(task.completionDate).toLocaleDateString('ru-RU')
                : 'Неизвестно';

            const safeTitle = escapeHTML(task.title);
            const safeUrl = escapeHTML(task.url);
            const safeTag = escapeHTML(task.tag);

            const titleHtml = task.url
                ? `<a href="${safeUrl}" target="_blank" class="archive-title">${safeTitle}</a>`
                : `<span class="archive-title">${safeTitle}</span>`;

            const tagHtml = task.tag ? `<span class="tag">${safeTag}</span>` : '';

            // Calculate elapsed time for turns and waits
            let timeTakenHtml = '';
            if ((task.type === 'turn' || task.type === 'wait') && task.completionDate && task.date) {
                const start = new Date(task.date).getTime();
                const end = new Date(task.completionDate).getTime();
                const durationStr = formatDuration(end - start);
                const prefix = task.type === 'turn' ? 'Пост написан за:' : 'Ответа ждали:';
                timeTakenHtml = `<div class="time-taken">${prefix} ${durationStr}</div>`;
            } else if (task.type === 'deadline') {
                timeTakenHtml = `<div class="text-muted">Дедлайн закрыт</div>`;
            }

            const typeLabel = getTypeLabel(task.type);

            const card = document.createElement('div');
            card.className = 'archive-card';
            card.innerHTML = `
                <div>
                    <div>${titleHtml}</div>
                    <div class="archive-meta">
                        <span class="text-accent">${safeForumName}</span>
                        <span>•</span>
                        <span>${typeLabel}</span>
                        ${tagHtml ? `<span>•</span> ${tagHtml}` : ''}
                    </div>
                </div>
                <div class="archive-stats">
                    ${timeTakenHtml}
                    <div class="archive-finish-date">Завершено: ${finishDate}</div>
                </div>
            `;

            listContainer.appendChild(card);
        });
    });
}

/**
 * Returns the localized display label for a completed task type.
 * @param {string} type - Task type identifier.
 * @returns {string} Localized label string.
 */
function getTypeLabel(type) {
    switch (type) {
        case 'turn': return 'Написанный пост';
        case 'wait': return 'Ожидание';
        case 'deadline': return 'Срочный дедлайн';
        default: return 'Задача';
    }
}

})();
