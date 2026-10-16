/**
 * RP Task Tracker - Content Script
 * Injected into matched forum pages. Responsible for parsing topic metadata,
 * rendering the Floating Action Button (FAB), and handling in-page task creation/editing.
 * Note: Relies on scripts/utils.js being injected first.
 */

(() => {

// Fetch extension configuration and task list on page load
chrome.storage.local.get(['savedForums', 'rpgTasks'], (result) => {
    const forums = result.savedForums || [];
    let tasks = result.rpgTasks || [];
    const currentHost = window.location.hostname;

    // Check if the current website matches any of the user's saved forums
    const matchedForum = forums.find(f => currentHost.includes(f.url) || f.url.includes(currentHost));

    if (matchedForum) {
        injectUI(matchedForum, tasks);
    }
});

/**
 * Detects the active character name from Rusff/MyBB page scripts (UserLogin)
 * or falls back to the first configured character for the forum.
 * @param {Array<string>} forumChars - Configured character names for the current forum.
 * @returns {string} Detected or default character name.
 */
function detectDefaultCharacter(forumChars) {
    const loginMatch = document.documentElement.innerHTML.match(/UserLogin\s*=\s*['"]([^'"]+)['"]/);
    const rawPageLogin = loginMatch ? loginMatch[1].trim() : '';
    const ignoredLogins = ['гость', 'guest', 'реклама', 'pr'];
    const isGuestOrSystem = !rawPageLogin || ignoredLogins.includes(rawPageLogin.toLowerCase());

    if (!isGuestOrSystem) {
        const matchedSaved = forumChars.find(c => c.toLowerCase() === rawPageLogin.toLowerCase());
        return matchedSaved || rawPageLogin;
    }
    return forumChars[0] || '';
}

/**
 * Injects the Floating Action Button (FAB) and Task Modal into the target DOM.
 * @param {Object} forum - The matched forum configuration object
 * @param {Array<Object>} tasks - Current array of saved tasks
 */
function injectUI(forum, tasks) {
    const currentUrl = window.location.href;

    // Look for existing task for this forum and URL
    let existingTask = tasks.find(t => t.url === currentUrl && !t.completed && !t.archived);

    // --- Create Floating Action Button ---
    const btn = document.createElement('button');
    btn.id = 'rpt-floating-btn';
    btn.innerHTML = existingTask ? ICON_EDIT_FAB : ICON_ADD_FAB;
    btn.title = existingTask ? 'Тема уже в трекере (редактировать)' : 'Добавить тему в трекер';
    document.body.appendChild(btn);

    // --- Prepare Modal Initial State ---
    const modal = document.createElement('div');
    modal.id = 'rpt-modal';
    
    const cleanTitle = document.title.split(' - ')[0].trim();
    let forumChars = getForumChars(forum);
    const defaultChar = detectDefaultCharacter(forumChars);
    const today = new Date().toISOString().split('T')[0];

    // If task exists — use data from memory, otherwise parse from page
    const titleValue = existingTask ? existingTask.title : cleanTitle;
    const charValue = existingTask ? existingTask.tag : defaultChar;
    const typeValue = existingTask ? existingTask.type : 'wait';
    const dateValue = (existingTask && existingTask.date) ? existingTask.date.split('T')[0] : today;
    const noteValue = (existingTask && existingTask.note) ? existingTask.note : '';

    // SANITIZE DATA BEFORE INJECTING INTO HTML (Fixing the XSS vulnerability)
    const safeTitleValue = escapeHTML(titleValue);
    const safeCharValue = escapeHTML(charValue);
    const safeForumName = escapeHTML(forum.name);
    const safeNoteValue = escapeHTML(noteValue);

    const modalHeader = existingTask ? 'Редактировать задачу' : `Новая задача: ${safeForumName}`;
    const btnText = existingTask ? 'Сохранить изменения' : 'Сохранить';
    const addNewLinkHtml = existingTask
        ? `<div id="rpt-add-new-instead">+ добавить ещё одну задачу для этой темы</div>`
        : '';
    
    
    // --- Build Modal DOM ---
    modal.innerHTML = `
        <span class="rpt-close" id="rpt-close-btn">&times;</span>
        <h4 id="rpt-modal-header">${modalHeader}</h4>
        ${addNewLinkHtml}
        
        <label class="rpt-label" for="rpt-title">Название темы</label>
        <input type="text" id="rpt-title" value="${safeTitleValue}">
        
        <label class="rpt-label" for="rpt-char">Персонаж</label>
        <input type="text" id="rpt-char" value="${safeCharValue}">
        <div id="rpt-char-pills" class="rpt-char-pills"></div>
        
        <label class="rpt-label" for="rpt-type">Тип задачи</label>
        <select id="rpt-type">
            <option value="wait" ${typeValue === 'wait' ? 'selected' : ''}>Жду ответа</option>
            <option value="turn" ${typeValue === 'turn' ? 'selected' : ''}>Мой ход</option>
            <option value="daily" ${typeValue === 'daily' ? 'selected' : ''}>Ежедневная рутина</option>
            <option value="deadline" ${typeValue === 'deadline' ? 'selected' : ''}>Срочный дедлайн</option>
        </select>
        
        <label class="rpt-label" for="rpt-date">Дата</label>
        <input type="date" id="rpt-date" value="${dateValue}">
        
        <label class="rpt-label" for="rpt-note">Заметка к задаче (необязательно)</label>
        <textarea id="rpt-note" rows="2" placeholder="О чём не забыть в посте...">${safeNoteValue}</textarea>

        <button id="rpt-save-btn">${btnText}</button>
    `;
    document.body.appendChild(modal);

    const charInputEl = document.getElementById('rpt-char');
    const pillsContainerEl = document.getElementById('rpt-char-pills');

    const refreshCharPills = () => {
        renderCharacterPills({
            containerEl: pillsContainerEl,
            inputEl: charInputEl,
            characters: forumChars,
            pillClass: 'rpt-char-pill',
            activeClass: 'rpt-pill-active',
            hiddenClass: 'rpt-hidden'
        });
    };
    refreshCharPills();

    // --- Bind Event Listeners ---
    // Toggle modal visibility
    btn.addEventListener('click', () => modal.classList.toggle('rpt-active'));
    // Close modal via 'X' button
    document.getElementById('rpt-close-btn').addEventListener('click', () => modal.classList.remove('rpt-active'));

    // Handle "Add as new task" option if editing an existing task
    if (existingTask) {
        document.getElementById('rpt-add-new-instead').addEventListener('click', (e) => {
            existingTask = null;
            document.getElementById('rpt-modal-header').textContent = `Новая задача: ${safeForumName}`;
            document.getElementById('rpt-save-btn').textContent = 'Сохранить';
            e.target.classList.add('rpt-hidden');

            document.getElementById('rpt-title').value = cleanTitle;
            charInputEl.value = defaultChar;
            document.getElementById('rpt-note').value = '';
            refreshCharPills();
        });
    }

    // Handle task creation and storage
    document.getElementById('rpt-save-btn').addEventListener('click', () => {
        const title = document.getElementById('rpt-title').value;
        const char = charInputEl.value;
        const type = document.getElementById('rpt-type').value;
        const rawDate = document.getElementById('rpt-date').value;
        const note = document.getElementById('rpt-note').value.trim();

        if (!rawDate) return alert('Пожалуйста, выбери дату!');

        const previousDate = existingTask ? existingTask.date : '';
        const finalDateStr = buildTaskDateString(type, rawDate, previousDate);

        // Fetch latest storage state immediately before saving to prevent race conditions across tabs
        chrome.storage.local.get(['rpgTasks', 'savedForums'], (result) => {
            const latestTasks = result.rpgTasks || [];
            const latestForums = result.savedForums || [];

            const resolved = resolveAndLearnCharacters(forumChars, char);
            const finalCharTag = resolved.formattedTag;

            if (resolved.hasNewChars) {
                forumChars = resolved.updatedForumChars;
                const forumIdx = latestForums.findIndex(f => f.id === forum.id);
                if (forumIdx > -1) {
                    latestForums[forumIdx].characters = forumChars;
                    chrome.storage.local.set({ savedForums: latestForums });
                }
                refreshCharPills();
            }

            if (existingTask) {
                const taskIndex = latestTasks.findIndex(t => t.id === existingTask.id);
                if (taskIndex > -1) {
                    latestTasks[taskIndex].title = title;
                    latestTasks[taskIndex].tag = finalCharTag;
                    latestTasks[taskIndex].type = type;
                    latestTasks[taskIndex].date = finalDateStr;
                    latestTasks[taskIndex].note = note;
                }
            } else {
                const newTask = {
                    id: Date.now().toString(),
                    forumId: forum.id,
                    title: title,
                    url: currentUrl,
                    tag: finalCharTag,
                    type: type,
                    date: finalDateStr,
                    note: note,
                    completed: false,
                    archived: false
                };
                latestTasks.push(newTask);
                existingTask = newTask;
            }

            chrome.storage.local.set({ rpgTasks: latestTasks }, () => {
                btn.innerHTML = ICON_CHECK_FAB;
                modal.classList.remove('rpt-active');

                setTimeout(() => {
                    btn.innerHTML = ICON_EDIT_FAB;
                    btn.title = 'Тема уже в трекере (редактировать)';
                    document.getElementById('rpt-modal-header').textContent = 'Редактировать задачу';
                    document.getElementById('rpt-save-btn').textContent = 'Сохранить изменения';
                }, 2000);
            });
        });
    });
}

})();
