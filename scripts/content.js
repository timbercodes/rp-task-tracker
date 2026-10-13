/**
 * RP Task Tracker - Content Script
 * Injected into active web pages. Responsible for parsing page data,
 * injecting the floating action button (FAB), and handling task creation/editing directly from the forum.
 * Note: Relies on scripts/utils.js being injected first.
 */

(() => {

// 1. Fetch extension configuration and task list on page load
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
 * Injects the Floating Action Button (FAB) and Task Modal into the target DOM.
 * @param {Object} forum - The matched forum configuration object
 * @param {Array<Object>} tasks - Current array of saved tasks
 */
function injectUI(forum, tasks) {
    const currentUrl = window.location.href;

    // Look for existing task for this forum and URL
    let existingTask = tasks.find(t => t.url === currentUrl && !t.completed);

    // --- Create Floating Button ---
    const btn = document.createElement('button');
    btn.id = 'rpt-floating-btn';

    // Smart icon: Set initial smart icon based on task existence
    btn.innerHTML = existingTask ? ICON_EDIT_FAB : ICON_ADD_FAB;
    btn.title = existingTask ? 'Редактировать задачу' : 'Добавить в трекер задач';
    document.body.appendChild(btn);

    // --- Create Modal Container ---
    const modal = document.createElement('div');
    modal.id = 'rpt-modal';
    
    // Parse the forum topic title, removing standard trailing elements
    let cleanTitle = document.title.split(' - ')[0].trim();
    
    // Extract default character if specified in settings
    let defaultChar = forum.characters ? forum.characters.split(',')[0].trim() : '';

    // Get current date for default value in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    // If task exists — use data from memory, otherwise parse from page
    const titleValue = existingTask ? existingTask.title : cleanTitle;
    const charValue = existingTask ? existingTask.tag : defaultChar;
    const typeValue = existingTask ? existingTask.type : 'wait';
    const dateValue = existingTask ? (existingTask.date || today) : today;
    
    // SANITIZE DATA BEFORE INJECTING INTO HTML (Fixing the XSS vulnerability)
    const safeTitleValue = escapeHTML(titleValue);
    const safeCharValue = escapeHTML(charValue);
    const safeForumName = escapeHTML(forum.name);

    const modalHeader = existingTask ? 'Редактировать задачу' : `Новая задача: ${safeForumName}`;
    const btnText = existingTask ? 'Сохранить изменения' : 'Сохранить';

    // Build Modal HTML
    modal.innerHTML = `
        <span class="rpt-close" id="rpt-close-btn">&times;</span>
        <h4 id="rpt-modal-header" style="margin: 0; color: #64ffda; font-size: 16px; padding-bottom: 10px;">${modalHeader}</h4>${existingTask ? `<div id="rpt-add-new-instead" style="font-size: 11px; color: #888; cursor: pointer; text-decoration: underline; margin-bottom: 10px;">+ или добавить как новую задачу?</div>` : ''}
        
        <label style="font-size: 12px; color: #888;">Название темы</label>
        <input type="text" id="rpt-title" value="${safeTitleValue}">
        
        <label style="font-size: 12px; color: #888;">Персонаж</label>
        <input type="text" id="rpt-char" value="${safeCharValue}">
        
        <label style="font-size: 12px; color: #888;">Тип задачи</label>
        <select id="rpt-type">
            <option value="wait" ${typeValue === 'wait' ? 'selected' : ''}>Жду ответа</option>
            <option value="turn" ${typeValue === 'turn' ? 'selected' : ''}>Мой долг</option>
            <option value="daily" ${typeValue === 'daily' ? 'selected' : ''}>Ежедневная рутина</option>
            <option value="deadline" ${typeValue === 'deadline' ? 'selected' : ''}>Срочный дедлайн</option>
        </select>
        
        <label style="font-size: 12px; color: #888;">Дата</label>
        <input type="date" id="rpt-date" value="${dateValue}">
        
        <button id="rpt-save-btn">${btnText}</button>
    `;
    document.body.appendChild(modal);

    // --- Event Listeners ---
    
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
            e.target.style.display = 'none';
            
            document.getElementById('rpt-title').value = cleanTitle;
            document.getElementById('rpt-char').value = defaultChar;
        });
    }
    // ==========================================    

    // Handle task creation and storage
    document.getElementById('rpt-save-btn').addEventListener('click', () => {
        const title = document.getElementById('rpt-title').value;
        const char = document.getElementById('rpt-char').value;
        const type = document.getElementById('rpt-type').value;
        const rawDate = document.getElementById('rpt-date').value;

        if (!rawDate) return alert('Пожалуйста, выбери дату!');

        // SMART TIME INJECTION:
        let finalDateStr = rawDate;
        if (type === 'deadline') {
            // Deadline till 23:59:59 on that day
            finalDateStr = `${rawDate}T23:59:59`;
        } else if (type === 'turn' || type === 'wait') {
            // Debt/Waiting tasks start counting from the current time (hours, minutes, seconds)
            const nowTimeStr = new Date().toTimeString().split(' ')[0]; // Extract "HH:MM:SS"
            finalDateStr = `${rawDate}T${nowTimeStr}`;
        }
        // Daily tasks remain as is (just YYYY-MM-DD), their time is not important

        // FETCH LATEST DATA RIGHT BEFORE SAVING TO PREVENT RACE CONDITIONS
        // This ensures concurrent tabs don't overwrite each other's saves
        chrome.storage.local.get(['rpgTasks'], (result) => {
            let latestTasks = result.rpgTasks || [];

            if (existingTask) {
                // Find and update existing task in the fresh array
                const taskIndex = latestTasks.findIndex(t => t.id === existingTask.id);
                if (taskIndex > -1) {
                    latestTasks[taskIndex].title = title;
                    latestTasks[taskIndex].tag = char;
                    latestTasks[taskIndex].type = type;
                    latestTasks[taskIndex].date = finalDateStr;
                }
            } else {
                // Create new task object
                const newTask = {
                    id: Date.now().toString(),
                    forumId: forum.id,
                    title: title,
                    url: currentUrl,
                    tag: char,
                    type: type,
                    date: finalDateStr,
                    completed: false,
                    archived: false
                };
                latestTasks.push(newTask);
                existingTask = newTask; // Update reference for UI feedback
            }

            // Persist data and provide visual feedback
            chrome.storage.local.set({ rpgTasks: latestTasks }, () => {
                btn.innerHTML = ICON_CHECK_FAB; // Show checkmark icon
                modal.classList.remove('rpt-active');

                // Reset button icon after 2 seconds
                setTimeout(() => {
                    btn.innerHTML = ICON_EDIT_FAB; // Show edit icon
                    btn.title = 'Редактировать задачу';
                    document.getElementById('rpt-modal-header').textContent = 'Редактировать задачу';
                    document.getElementById('rpt-save-btn').textContent = 'Сохранить изменения';
                }, 2000);
            });
        });
    });
}

})();
