// experimenter_script.js - Experimenter Overview for Supabase

// Initialize Supabase when document is ready
document.addEventListener('DOMContentLoaded', initializeSupabase);

let supabaseClient;

function initializeSupabase() {
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
        initApp();
    } else {
        console.error("Supabase SDK not loaded. Make sure the Supabase JS SDK script is included before this script.");
    }
}
// --- DOM Elements ---
const scheduleTableContainer = document.getElementById('scheduleTableContainer');
const pastScheduleTableContainer = document.getElementById('pastScheduleTableContainer');
const calendarLoadingMessage = document.getElementById('calendarLoading');
const calendarTitleSpan = document.getElementById('calendarTitle');
const calendarDaysContainer = document.getElementById('calendarDays');
const prevMonthBtn = document.getElementById('prevMonthBtn');
const nextMonthBtn = document.getElementById('nextMonthBtn');

// --- State ---
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-indexed (0 for Jan, 11 for Dec)
let allSchedulesData = []; // To store fetched schedules for calendar view

// --- Initialization ---
function initApp() {
    loadDataAndRenderViews(); // Initial load for both table and calendar

    prevMonthBtn.addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        renderCalendarView(); // Only re-render calendar, table data is already fetched
    });

    nextMonthBtn.addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        renderCalendarView(); // Only re-render calendar
    });

    // Supabase Realtime subscription for automatic updates
    const schedulesChannel = supabaseClient.channel('schedules-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedules' },
        () => loadDataAndRenderViews()
      )
      .subscribe((status, err) => {
        if (err) {
            console.error('Supabase real-time subscription error:', err);
        }
      });

}

// --- Data Fetching and Main Rendering Logic ---
async function loadDataAndRenderViews() {
    const { data, error } = await supabaseClient
        .from('schedules')
        .select('*')
        .order('submission_timestamp', { ascending: false });

    if (error) {
        console.error('Error fetching schedules:', error);
        scheduleTableContainer.innerHTML = `<p class="error-message">Error loading schedules: ${error.message}</p>`;
        return;
    }

    const sortedData = data || [];
    // Sort by the first session date
    sortedData.sort((a, b) => {
        const dateA = a.session_dates?.[0] ? new Date(a.session_dates[0]) : 0;
        const dateB = b.session_dates?.[0] ? new Date(b.session_dates[0]) : 0;
        if (!dateA) return 1; // Push schedules without dates to the end
        if (!dateB) return -1;
        return dateA - dateB;
    });

    allSchedulesData = sortedData.filter(schedule =>
        !OVERVIEW_CONFIG.EXCLUDED_PPTS.has(schedule.participant_id)
    );
    renderTableView(allSchedulesData); // Use the filtered data
    renderCalendarView();
}

// --- Table View Rendering ---
function renderTableView(schedules) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingSchedules = [];
    const pastSchedules = [];

    schedules.forEach(schedule => {
        const allSessionDates = (schedule.session_dates || []).concat(schedule.backup_dates || []);
        if (allSessionDates.length === 0) {
            upcomingSchedules.push(schedule); // Assume upcoming if no dates
            return;
        }

        const lastDate = new Date(Math.max.apply(null, allSessionDates.map(d => new Date(d))));
        if (lastDate < today) {
            pastSchedules.push(schedule);
        } else {
            upcomingSchedules.push(schedule);
        }
    });

    renderTableSection(scheduleTableContainer, upcomingSchedules, today, "No upcoming schedules.");
    renderTableSection(pastScheduleTableContainer, pastSchedules, today, "No past schedules.");
}

function renderTableSection(container, schedules, today, noSchedulesMessage) {
    if (schedules.length === 0) {
        container.innerHTML = `<p class="no-schedules-message">${noSchedulesMessage}</p>`;
        return;
    }

    // Sort schedules within the section by first session date
    schedules.sort((a, b) => {
        const dateA = a.session_dates?.[0] ? new Date(a.session_dates[0]) : 0;
        const dateB = b.session_dates?.[0] ? new Date(b.session_dates[0]) : 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA - dateB;
    });

    let summaryTableHTML = `
        <h3>Key Sessions Summary</h3>
        <table class="summary-table">
            <thead>
                <tr>
                    <th>Participant ID</th>
                    <th>Instruction Timeslot</th>
                    <th>First Session</th>
                    <th>Last Session</th>
                    <th>Last Backup</th>
                </tr>
            </thead>
            <tbody>
    `;

    schedules.forEach(schedule => {
        const isDroppedOut = OVERVIEW_CONFIG.EXCLUDED_PPTS.has(schedule.participant_id);
        const participantId = `${schedule.participant_id || 'N/A'}${isDroppedOut ? ' (dropped out)' : ''}`;
        
        const firstSessionDateStr = schedule.session_dates?.[0];
        const firstSessionDate = firstSessionDateStr ? new Date(firstSessionDateStr) : null;
        const lastBackupDateStr = schedule.backup_dates?.[schedule.backup_dates.length - 1];
        const lastBackupDate = lastBackupDateStr ? new Date(lastBackupDateStr) : null;

        let rowClass = '';
        if (isDroppedOut || (lastBackupDate && lastBackupDate < today)) {
            rowClass = 'past-session';
        }

        const firstSessionClass = firstSessionDate && firstSessionDate < today ? 'past-date' : '';
        const lastSessionDate = schedule.session_dates?.length > 0 ? new Date(schedule.session_dates[schedule.session_dates.length - 1]) : null;
        const lastSessionClass = lastSessionDate && lastSessionDate < today ? 'past-date' : '';
        const lastBackupClass = lastBackupDate && lastBackupDate < today ? 'past-date' : '';
        const instructionClass = firstSessionDate && firstSessionDate < today ? 'past-date' : '';

        summaryTableHTML += `
            <tr class="${rowClass}">
                <td class="uid-column">${participantId}</td>
                <td class="instruction-timeslot ${instructionClass}">${schedule.instruction_timeslot || 'N/A'}</td>
                <td class="first-session ${firstSessionClass}">${firstSessionDate ? DateManager.formatForDisplay(firstSessionDate) : 'N/A'}</td>
                <td class="last-session ${lastSessionClass}">${lastSessionDate ? DateManager.formatForDisplay(lastSessionDate) : 'N/A'}</td>
                <td class="last-backup ${lastBackupClass}">${lastBackupDate ? DateManager.formatForDisplay(lastBackupDate) : 'N/A'}</td>
            </tr>
        `;
    });
    summaryTableHTML += `</tbody></table>`;

    let detailTableHTML = `
        <h3>Session list</h3>
        <table>
            <thead>
                <tr>
                    <th>Participant ID</th>
                    <th>Past Sessions</th>
                    <th>Backup Sessions</th>
                </tr>
            </thead>
            <tbody>
    `;
    schedules.forEach(schedule => {
        const isDroppedOut = OVERVIEW_CONFIG.EXCLUDED_PPTS.has(schedule.participant_id);
        const participantId = `${schedule.participant_id || 'N/A'}${isDroppedOut ? ' (dropped out)' : ''}`;
        
        const lastBackupDateStr = schedule.backup_dates?.[schedule.backup_dates.length - 1];
        const lastBackupDate = lastBackupDateStr ? new Date(lastBackupDateStr) : null;
        let rowClass = '';
        if (isDroppedOut || (lastBackupDate && lastBackupDate < today)) {
            rowClass = 'past-session';
        }

        detailTableHTML += `
            <tr class="${rowClass}">
                <td class="uid-column">${participantId}</td>
                <td class="sessions-cell">
                    ${schedule.session_dates?.map((d, i, arr) => {
                        let className = '';
                        if (i === 0) className = 'first-session';
                        else if (i === arr.length - 1) className = 'last-session';
                        return `<div class="${className}">${DateManager.formatForDisplay(new Date(d))}</div>`;
                    }).join('') || 'None'}
                </td>
                <td class="backup-cell">
                    ${schedule.backup_dates?.map((d, i, arr) => {
                        const className = i === arr.length - 1 ? 'last-backup' : 'backup';
                        return `<div class="${className}">${DateManager.formatForDisplay(new Date(d))}</div>`;
                    }).join('') || 'None'}
                </td>
            </tr>
        `;
    });
    detailTableHTML += `</tbody></table>`;

    container.innerHTML = summaryTableHTML + '<hr>' + detailTableHTML;
}


// --- Calendar View Rendering ---
function renderCalendarView() {
    calendarLoadingMessage.style.display = 'none'; // Hide loading message
    calendarDaysContainer.innerHTML = ''; // Clear previous days

    const monthNames = ["January", "February", "March", "April", "May", "June",
                        "July", "August", "September", "October", "November", "December"];
    calendarTitleSpan.textContent = `${monthNames[currentMonth]} ${currentYear}`;

    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 (Sun) to 6 (Sat)

    // Add empty cells for days before the first of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
        const prevMonthDayCell = document.createElement('div');
        prevMonthDayCell.classList.add('calendar-day', 'other-month');
        calendarDaysContainer.appendChild(prevMonthDayCell);
    }

    const today = DateManager.toUTCDate(new Date());

    // Pre-calculate participant colors
    const participantColors = {};
    allSchedulesData.forEach(schedule => {
        const participant = schedule.participant_id || 'Unknown';
        if (!participantColors[participant]) {
            const colorIndex = Object.keys(participantColors).length % 10;
            const hue = (colorIndex * 36) % 360;
            participantColors[participant] = `hsl(${hue}, 70%, 80%)`;
        }
    });

    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.classList.add('calendar-day');
        dayCell.textContent = day;

        const currentDate = DateManager.toUTCDate(new Date(currentYear, currentMonth, day));
        if (currentDate.getTime() === today.getTime()) {
            dayCell.classList.add('is-today');
        }

        const eventsList = document.createElement('ul');

        allSchedulesData.forEach(schedule => {
            const participant = schedule.participant_id || 'Unknown';
            const participantColor = participantColors[participant];

            const checkAndAddEvent = (dateStr, type, text) => {
                if (!dateStr) return;
                const eventDate = DateManager.toUTCDate(dateStr);
                if (eventDate && eventDate.getTime() === currentDate.getTime()) {
                    let cssClass = 'event-session';
                    let title = `Participant ${participant} - Session`;
                    if (type === 'first') {
                        cssClass = 'event-first-session';
                        title = `Participant ${participant} - First Session`;
                    } else if (type === 'last') {
                        cssClass = 'event-last-session';
                        title = `Participant ${participant} - Last Session`;
                    } else if (type === 'backup') {
                        cssClass = 'event-backup';
                        title = `Participant ${participant} - Backup`;
                    } else if (type === 'last-backup') {
                        cssClass = 'event-last-backup';
                        title = `Participant ${participant} - Last Backup`;
                    }
                    addEventToList(eventsList, text, cssClass, title, participantColor);
                }
            };
            
            // Main sessions
            (schedule.session_dates || []).forEach((dateStr, index, arr) => {
                let type = 'middle';
                let text = participant;
                if (index === 0) {
                    type = 'first';
                    text = `>> ${participant} INTAKE <<`;
                } else if (index === arr.length - 1) {
                    type = 'last';
                    text = `< ${participant} >`;
                }
                checkAndAddEvent(dateStr, type, text);
            });

            // Backup sessions
            (schedule.backup_dates || []).forEach((dateStr, index, arr) => {
                let type = 'backup';
                let text = `[[ ${participant} ]]`;
                 if (index === arr.length - 1) {
                    type = 'last-backup';
                    text = `[[ < ${participant} > ]]`;
                }
                checkAndAddEvent(dateStr, type, text);
            });
        });

        if (eventsList.hasChildNodes()) {
            dayCell.appendChild(eventsList);
        }
        calendarDaysContainer.appendChild(dayCell);
    }

    // Add empty cells for grid completion
    const totalCellsRendered = startingDayOfWeek + daysInMonth;
    const cellsInGrid = Math.ceil(totalCellsRendered / 7) * 7; // Ensure full weeks displayed (e.g. 35 or 42)
     for (let i = totalCellsRendered; i < cellsInGrid; i++) {
        const nextMonthDayCell = document.createElement('div');
        nextMonthDayCell.classList.add('calendar-day', 'other-month');
        calendarDaysContainer.appendChild(nextMonthDayCell);
    }
}

function addEventToList(ulElement, text, cssClass, title, backgroundColor) {
    const li = document.createElement('li');
    li.classList.add(cssClass);
    li.textContent = text;
    li.title = title;
    
    // Apply participant-specific color
    if (backgroundColor) {
        li.style.backgroundColor = backgroundColor;
    }
    
    ulElement.appendChild(li);
}

// --- End of experimenter_script.js ---
