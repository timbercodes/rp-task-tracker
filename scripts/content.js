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
 * Makes the Floating Action Button draggable within the viewport and persists
 * its position per forum in chrome.storage.local.
 * @param {HTMLElement} btn - The FAB DOM element.
 * @param {string} forumId - Current forum ID for saving coordinates.
 * @param {Function} onClickCallback - Callback triggered only on a clean click (not drag).
 */
function makeFabDraggable(btn, forumId, onClickCallback) {
    chrome.storage.local.get(['fabPositions'], (res) => {
        const pos = res.fabPositions?.[forumId];
        if (pos) {
            Object.assign(btn.style, { left: `${pos.left}px`, top: `${pos.top}px`, right: 'auto', bottom: 'auto' });
        }
    });

    btn.addEventListener('mousedown', (startEvent) => {
        if (startEvent.button !== 0) return;

        const rect = btn.getBoundingClientRect();
        let hasMoved = false;
        btn.classList.add('rpt-dragging');

        const onMouseMove = (moveEvent) => {
            const dx = moveEvent.clientX - startEvent.clientX;
            const dy = moveEvent.clientY - startEvent.clientY;
            if (Math.abs(dx) <= 4 && Math.abs(dy) <= 4 && !hasMoved) return;

            hasMoved = true;
            const left = Math.max(10, Math.min(window.innerWidth - btn.offsetWidth - 10, rect.left + dx));
            const top = Math.max(10, Math.min(window.innerHeight - btn.offsetHeight - 10, rect.top + dy));
            Object.assign(btn.style, { left: `${left}px`, top: `${top}px`, right: 'auto', bottom: 'auto' });
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            btn.classList.remove('rpt-dragging');

            if (hasMoved) {
                const finalRect = btn.getBoundingClientRect();
                chrome.storage.local.get(['fabPositions'], (res) => {
                    const positions = res.fabPositions || {};
                    positions[forumId] = { left: Math.round(finalRect.left), top: Math.round(finalRect.top) };
                    chrome.storage.local.set({ fabPositions: positions });
                });
            } else {
                onClickCallback();
            }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

/**
 * Injects the Floating Action Button (FAB) and Task Modal into the target DOM.
 * @param {Object} forum - The matched forum configuration object
 * @param {Array<Object>} tasks - Current array of saved tasks
 */
function injectUI(forum, tasks) {
    const currentUrl = window.location.href;
    const cleanCurrentUrl = getCleanTopicUrl(currentUrl);

    // Match topic by clean URL (ignoring #p12345 and &p=2) and include completed dailies
    let existingTask = tasks.find(
        t => getCleanTopicUrl(t.url) === cleanCurrentUrl && !t.archived
    );

    // --- 1. Create Floating Action Button (using 'div' to prevent host forum <button> CSS bugs) ---
    const btn = document.createElement('div');
    btn.id = 'rpt-floating-btn';
    document.body.appendChild(btn);

    // --- 2. Prepare Modal Initial State ---
    const modal = document.createElement('div');
    modal.id = 'rpt-modal';

    const cleanTitle = document.title.split(' - ')[0].trim();
    let forumChars = getForumChars(forum);
    const defaultChar = detectDefaultCharacter(forumChars);
    const today = new Date().toISOString().split('T')[0];

    // --- 3. Build Modal DOM (All elements rendered upfront so state transitions don't require page reload) ---
    modal.innerHTML = `
        <span class="rpt-close" id="rpt-close-btn">&times;</span>
        <h4 id="rpt-modal-header"></h4>
        <div id="rpt-add-new-instead" class="rpt-hidden">+ добавить ещё одну задачу для этой темы</div>
        
        <div id="rpt-quick-actions" class="rpt-quick-actions rpt-hidden">
            <button type="button" id="rpt-quick-pingpong" class="rpt-quick-btn"></button>
            <button type="button" id="rpt-quick-complete" class="rpt-quick-btn"></button>
        </div>

        <label class="rpt-label" for="rpt-title">Название темы</label>
        <input type="text" id="rpt-title">
        
        <label class="rpt-label" for="rpt-char">Персонаж</label>
        <input type="text" id="rpt-char">
        <div id="rpt-char-pills" class="rpt-char-pills"></div>
        
        <label class="rpt-label" for="rpt-type">Тип задачи</label>
        <select id="rpt-type">
            <option value="wait">Жду ответа</option>
            <option value="turn">Мой ход</option>
            <option value="daily">Ежедневная рутина</option>
            <option value="deadline">Срочный дедлайн</option>
        </select>
        
        <label class="rpt-label" for="rpt-date">Дата</label>
        <input type="date" id="rpt-date">
        
        <label class="rpt-label" for="rpt-note">Заметка к задаче (необязательно)</label>
        <textarea id="rpt-note" rows="2" placeholder="О чём не забыть в посте..."></textarea>

        <button type="button" id="rpt-save-btn"></button>
    `;
    document.body.appendChild(modal);

    // Group all modal DOM references into a single clean object
    const ui = {
        header: modal.querySelector('#rpt-modal-header'),
        addNewLink: modal.querySelector('#rpt-add-new-instead'),
        quickActions: modal.querySelector('#rpt-quick-actions'),
        pingPongBtn: modal.querySelector('#rpt-quick-pingpong'),
        completeBtn: modal.querySelector('#rpt-quick-complete'),
        title: modal.querySelector('#rpt-title'),
        char: modal.querySelector('#rpt-char'),
        pills: modal.querySelector('#rpt-char-pills'),
        type: modal.querySelector('#rpt-type'),
        date: modal.querySelector('#rpt-date'),
        note: modal.querySelector('#rpt-note'),
        saveBtn: modal.querySelector('#rpt-save-btn'),
        closeBtn: modal.querySelector('#rpt-close-btn')
    };

    const refreshCharPills = () => {
        renderCharacterPills({
            containerEl: ui.pills,
            inputEl: ui.char,
            characters: forumChars,
            pillClass: 'rpt-char-pill',
            activeClass: 'rpt-pill-active',
            hiddenClass: 'rpt-hidden'
        });
    };

    /**
     * Synchronizes modal fields, header text, "+ add another" link, and quick action buttons
     * based on whether existingTask is set or null.
     */
    const syncModalUI = () => {
        if (existingTask) {
            btn.innerHTML = ICON_EDIT_FAB;
            btn.title = 'Тема уже в трекере (редактировать)';
            ui.header.textContent = 'Редактировать задачу';
            ui.saveBtn.textContent = 'Сохранить изменения';
            ui.addNewLink.classList.remove('rpt-hidden');
            ui.quickActions.classList.remove('rpt-hidden');

            ui.title.value = existingTask.title || cleanTitle;
            ui.char.value = existingTask.tag || defaultChar;
            ui.type.value = existingTask.type || 'wait';
            ui.date.value = existingTask.date ? existingTask.date.split('T')[0] : today;
            ui.note.value = existingTask.note || '';

            if (existingTask.type === 'turn' || existingTask.type === 'wait') {
                ui.pingPongBtn.classList.remove('rpt-hidden');
                ui.pingPongBtn.innerHTML = `${ICON_PINGPONG} <span>${existingTask.type === 'turn' ? 'Отдал пост' : 'Пришел ответ'}</span>`;
            } else {
                ui.pingPongBtn.classList.add('rpt-hidden');
            }

            let completeLabel = 'Завершить';
            if (existingTask.type === 'daily') {
                completeLabel = existingTask.completed ? 'Снять отметку' : 'Отметить сегодня';
            } else if (existingTask.type === 'deadline') {
                completeLabel = 'Закрыть дедлайн';
            }
            ui.completeBtn.innerHTML = `${ICON_CHECK} <span>${completeLabel}</span>`;
        } else {
            btn.innerHTML = ICON_ADD_FAB;
            btn.title = 'Добавить тему в трекер';
            ui.header.textContent = `Новая задача: ${forum.name}`;
            ui.saveBtn.textContent = 'Сохранить';
            ui.addNewLink.classList.add('rpt-hidden');
            ui.quickActions.classList.add('rpt-hidden');

            ui.title.value = cleanTitle;
            ui.char.value = defaultChar;
            ui.type.value = 'wait';
            ui.date.value = today;
            ui.note.value = '';
        }
        refreshCharPills();
    };

    syncModalUI();

    // --- 4. Bind Event Listeners ---
    makeFabDraggable(btn, forum.id, () => modal.classList.toggle('rpt-active'));
    ui.closeBtn.addEventListener('click', () => modal.classList.remove('rpt-active'));

    // Switch modal to "Add another task for this topic" mode
    ui.addNewLink.addEventListener('click', () => {
        existingTask = null;
        syncModalUI();
    });

    // Quick Action: Ping-Pong directly from the forum
    ui.pingPongBtn.addEventListener('click', () => {
        if (!existingTask) return;
        pingPongTaskById(existingTask.id, (updatedTask) => {
            existingTask = updatedTask;
            btn.innerHTML = ICON_CHECK_FAB;
            modal.classList.remove('rpt-active');
            setTimeout(syncModalUI, 1500);
        });
    });

    // Quick Action: Complete directly from the forum
    ui.completeBtn.addEventListener('click', () => {
        if (!existingTask) return;
        completeTaskById(existingTask.id, (activeTaskAfter) => {
            existingTask = activeTaskAfter;
            btn.innerHTML = ICON_CHECK_FAB;
            modal.classList.remove('rpt-active');
            setTimeout(syncModalUI, 1500);
        });
    });

    // Save or Update Task
    ui.saveBtn.addEventListener('click', () => {
        const title = ui.title.value;
        const char = ui.char.value;
        const type = ui.type.value;
        const rawDate = ui.date.value;
        const note = ui.note.value.trim();

        if (!rawDate) return alert('Пожалуйста, выбери дату!');

        const previousDate = existingTask ? existingTask.date : '';
        const finalDateStr = buildTaskDateString(type, rawDate, previousDate);

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
            }

            if (existingTask) {
                const taskIndex = latestTasks.findIndex(t => t.id === existingTask.id);
                if (taskIndex > -1) {
                    latestTasks[taskIndex].title = title;
                    latestTasks[taskIndex].url = currentUrl;
                    latestTasks[taskIndex].tag = finalCharTag;
                    latestTasks[taskIndex].type = type;
                    latestTasks[taskIndex].date = finalDateStr;
                    latestTasks[taskIndex].note = note;
                    existingTask = latestTasks[taskIndex];
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
                setTimeout(syncModalUI, 1500);
            });
        });
    });
}

})();
