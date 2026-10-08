/**
 * RP Task Tracker - Content Script
 * Injected into active web pages. Responsible for parsing page data,
 * injecting the floating action button (FAB), and handling task creation/editing directly from the forum.
 */

// --- SVG Icons ---
// --- SVG Icons ---
const ICON_EDIT_FAB = `<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
const ICON_ADD_FAB = `<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
const ICON_CHECK_FAB = `<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

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
    btn.title = existingTask ? 'Редактировать долг' : 'Добавить в трекер долгов';
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
    
    const modalHeader = existingTask ? 'Редактировать долг' : `Новый долг: ${forum.name}`;
    const btnText = existingTask ? 'Сохранить изменения' : 'Сохранить';

    // Build Modal HTML
    modal.innerHTML = `
        <span class="rpt-close" id="rpt-close-btn">&times;</span>
        <h4 id="rpt-modal-header" style="margin: 0; color: #64ffda; font-size: 16px; padding-bottom: 10px;">${modalHeader}</h4>${existingTask ? `<div id="rpt-add-new-instead" style="font-size: 11px; color: #888; cursor: pointer; text-decoration: underline; margin-bottom: 10px;">+ Или добавить как новый долг?</div>` : ''}
        
        <label style="font-size: 12px; color: #888;">Название темы</label>
        <input type="text" id="rpt-title" value="${titleValue}">
        
        <label style="font-size: 12px; color: #888;">Персонаж</label>
        <input type="text" id="rpt-char" value="${charValue}">
        
        <label style="font-size: 12px; color: #888;">Тип задачи</label>
        <select id="rpt-type">
            <option value="wait" ${typeValue === 'wait' ? 'selected' : ''}>Жду ответа</option>
            <option value="deadline" ${typeValue === 'deadline' ? 'selected' : ''}>Дедлайн</option>
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
            
            document.getElementById('rpt-modal-header').textContent = `Новый долг: ${forum.name}`;
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
        const date = document.getElementById('rpt-date').value;

        if (!date) return alert('Укажи дату!');

        if (existingTask) {
            // Update existing task
            existingTask.title = title;
            existingTask.tag = char;
            existingTask.type = type;
            existingTask.date = date;
        } else {
            // Create new task object
            const newTask = {
                id: Date.now().toString(),
                forumId: forum.id,
                title: title,
                url: currentUrl,
                tag: char,
                type: type,
                date: date,
                completed: false,
                archived: false
            };
            tasks.push(newTask);
            existingTask = newTask; // Update reference for UI feedback
        }

        // Persist data and provide visual feedback
        chrome.storage.local.set({ rpgTasks: tasks }, () => {
            btn.innerHTML = ICON_CHECK_FAB; // Show checkmark icon
            modal.classList.remove('rpt-active');

            // Reset button icon after 2 seconds
            setTimeout(() => {
                btn.innerHTML = ICON_EDIT_FAB; // Show edit icon
                btn.title = 'Редактировать этот долг';
                document.getElementById('rpt-modal-header').textContent = 'Редактировать долг';
                document.getElementById('rpt-save-btn').textContent = 'Сохранить изменения';
            }, 2000);
        });
    });
}
