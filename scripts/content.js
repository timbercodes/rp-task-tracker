/**
 * RP Task Tracker - Content Script
 * Injected into active web pages. Responsible for parsing page data,
 * injecting the floating action button (FAB), and handling task creation directly from the forum.
 */

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
    // --- Create Floating Button ---
    const btn = document.createElement('button');
    btn.id = 'rpt-floating-btn';
    btn.innerHTML = '📝';
    btn.title = 'Добавить в трекер долгов';
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

    // Build Modal HTML
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

    // --- Event Listeners ---
    
    // Toggle modal visibility
    btn.addEventListener('click', () => modal.classList.toggle('rpt-active'));

    // Close modal via 'X' button
    document.getElementById('rpt-close-btn').addEventListener('click', () => modal.classList.remove('rpt-active'));

    // Handle task creation and storage
    document.getElementById('rpt-save-btn').addEventListener('click', () => {
        const title = document.getElementById('rpt-title').value;
        const char = document.getElementById('rpt-char').value;
        const type = document.getElementById('rpt-type').value;
        const date = document.getElementById('rpt-date').value;
        const url = window.location.href; // Capture exact page URL

        if (!date) return alert('Укажи дату!');

        const newTask = {
            id: Date.now().toString(),
            forumId: forum.id,
            title: title,
            url: url,
            tag: char,
            type: type,
            date: date,
            completed: false,
            archived: false
        };

        tasks.push(newTask);
        
        // Persist data and provide visual feedback
        chrome.storage.local.set({ rpgTasks: tasks }, () => {
            btn.innerHTML = '✅';
            modal.classList.remove('rpt-active');

            // Reset button icon after 2 seconds
            setTimeout(() => btn.innerHTML = '📝', 2000);
        });
    });
}
