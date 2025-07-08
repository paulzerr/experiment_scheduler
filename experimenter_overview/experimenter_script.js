// experimenter_script.js - Experimenter Overview for Supabase

// --- Supabase Configuration ---
// Config is loaded from the parent directory via HTML script tag

// Initialize Supabase when document is ready
document.addEventListener('DOMContentLoaded', () => {
    // Check if SUPABASE_CONFIG is available from the parent config.js
    if (!window.SUPABASE_CONFIG) {
        console.error("SUPABASE_CONFIG not found. Using fallback values.");
        window.SUPABASE_CONFIG = {
            URL: 'https://xiupbovpolvimeayboig.supabase.co',
            ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpdXBib3Zwb2x2aW1lYXlib2lnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE1MTQ5ODMsImV4cCI6MjA1NzA5MDk4M30.r-b6VnDBSB6D_LYj0CF1fdiQ66eJVGzakGguSV7619U'
        };
    }
    
    initializeSupabase();
});

let supabaseClient;

function initializeSupabase() {
    if (window.supabase) { // Check if the Supabase global object from SDK is available
        supabaseClient = window.supabase.createClient(window.SUPABASE_CONFIG.URL, window.SUPABASE_CONFIG.ANON_KEY);
        initApp();
    } else {
        console.error("Supabase SDK not loaded. Make sure the Supabase JS SDK script is included before this script.");
    }
}
// --- DOM Elements ---
const scheduleTableContainer = document.getElementById('scheduleTableContainer');
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
    try {
        const schedulesChannel = supabaseClient.channel('schedules-db-changes')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'schedules' },
            (payload) => {
              console.log('Supabase change received!', payload);
              // Re-fetch all data and re-render everything to ensure consistency
              loadDataAndRenderViews();
            }
          )
          .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
              console.log('Successfully subscribed to Supabase real-time updates for schedules table.');
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || err) {
              console.error('Supabase real-time subscription error:', status, err || '');
              calendarLoadingMessage.textContent = 'Real-time updates might be unavailable.';
              calendarLoadingMessage.classList.remove('hidden');
              calendarLoadingMessage.classList.remove('error-message'); // Make it a warning or info
            }
          });
    } catch (e) {
        console.error("Error setting up real-time subscription:", e);
    }

    // Optional: Cleanup subscription on page unload (more relevant for SPAs)
    // window.addEventListener('beforeunload', () => {
    //     if (schedulesChannel) {
    //         supabase.removeChannel(schedulesChannel);
    //     }
    // });
}

// --- Data Fetching and Main Rendering Logic ---
async function loadDataAndRenderViews() {
    scheduleTableContainer.innerHTML = '<p class="loading-message">Loading schedules table...</p>';
    calendarLoadingMessage.textContent = 'Loading calendar data...';
    calendarLoadingMessage.classList.remove('hidden');
    calendarLoadingMessage.classList.remove('error-message');


    try {
        const { data, error } = await supabaseClient
            .from('schedules')
            .select('*')
            .order('submission_timestamp', { ascending: false });

        if (error) {
            console.error('Error fetching schedules from Supabase:', error);
            const errorMsg = `Error loading schedules: ${error.message}`;
            scheduleTableContainer.innerHTML = `<p class="error-message">${errorMsg}</p>`;
            calendarLoadingMessage.textContent = errorMsg;
            calendarLoadingMessage.classList.add('error-message');
            return;
        }

        allSchedulesData = data || [];

        renderTableView(allSchedulesData);
        renderCalendarView(); // Uses allSchedulesData

        calendarLoadingMessage.classList.add('hidden');

    } catch (err) {
        console.error('Unexpected error in loadDataAndRenderViews:', err);
        const errorMsg = `An unexpected error occurred: ${err.message}`;
        scheduleTableContainer.innerHTML = `<p class="error-message">${errorMsg}</p>`;
        calendarLoadingMessage.textContent = errorMsg;
        calendarLoadingMessage.classList.add('error-message');
    }
}

// --- Table View Rendering ---
function renderTableView(schedules) {
    if (schedules.length === 0) {
        scheduleTableContainer.innerHTML = '<p class="no-schedules-message">No schedules submitted yet.</p>';
        return;
    }

    // Determine max number of follow-ups/backups for table headers, if dynamic
    // const maxFollowUps = Math.max(0, ...schedules.map(s => s.follow_up_dates?.length || 0));
    // const maxBackups = Math.max(0, ...schedules.map(s => s.backup_dates?.length || 0));

    // First, create a summary table showing first, last, and last backup sessions
    let summaryTableHTML = `
        <h3>Key Sessions Summary</h3>
        <table class="summary-table">
            <thead>
                <tr>
                    <th>Participant ID</th>
                    <th>First Session</th>
                    <th>Last Session</th>
                    <th>Last Backup</th>
                </tr>
            </thead>
            <tbody>
    `;

    schedules.forEach(schedule => {
        const participantId = schedule.participant_id || 'N/A';
        const firstSession = schedule.session_dates && schedule.session_dates.length > 0
            ? formatDateForTableDisplay(schedule.session_dates[0])
            : 'N/A';
        
        const lastSession = schedule.session_dates && schedule.session_dates.length > 0
            ? formatDateForTableDisplay(schedule.session_dates[schedule.session_dates.length - 1])
            : 'N/A';
            
        const lastBackup = schedule.backup_dates && schedule.backup_dates.length > 0
            ? formatDateForTableDisplay(schedule.backup_dates[schedule.backup_dates.length - 1])
            : 'N/A';
            
        summaryTableHTML += `
            <tr>
                <td class="uid-column">${participantId}</td>
                <td class="first-session">${firstSession}</td>
                <td class="last-session">${lastSession}</td>
                <td class="last-backup">${lastBackup}</td>
            </tr>
        `;
    });
    
    summaryTableHTML += `</tbody></table>`;
    
    // Main detailed table
    let tableHTML = `
        <h3>All Sessions</h3>
        <table>
            <thead>
                <tr>
                    <th>Participant ID</th>
                    <th>All Sessions</th>
                    <th>Backup Sessions</th>
                </tr>
            </thead>
            <tbody>
    `;

    schedules.forEach(schedule => {
        tableHTML += `
            <tr>
                <td class="uid-column">${schedule.participant_id || 'N/A'}</td>
                <td class="sessions-cell">
                    ${schedule.session_dates && schedule.session_dates.length > 0
                        ? schedule.session_dates.map((d, i, arr) => {
                            let className = '';
                            if (i === 0) className = 'first-session';
                            else if (i === arr.length - 1) className = 'last-session';
                            
                            return `<div class="${className}">${formatDateForTableDisplay(d)}</div>`;
                          }).join('')
                        : 'None'}
                </td>
                <td class="backup-cell">
                    ${schedule.backup_dates && schedule.backup_dates.length > 0
                        ? schedule.backup_dates.map((d, i, arr) => {
                            const className = i === arr.length - 1 ? 'last-backup' : 'backup';
                            return `<div class="${className}">${formatDateForTableDisplay(d)}</div>`;
                          }).join('')
                        : 'None'}
                </td>
            </tr>
        `;
    });

    tableHTML += `</tbody></table>`;
    scheduleTableContainer.innerHTML = summaryTableHTML + '<hr>' + tableHTML;
}


// --- Calendar View Rendering ---
function renderCalendarView() {
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

    const todayObj = new Date();
    todayObj.setHours(0,0,0,0); // Normalize today for comparison

    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.classList.add('calendar-day');
        dayCell.textContent = day;

        const currentDateObj = new Date(currentYear, currentMonth, day);
        currentDateObj.setHours(0,0,0,0);
        const currentDateStringYYYYMMDD = normalizeDateToYYYYMMDD(currentDateObj);

        if (currentDateObj.getTime() === todayObj.getTime()) {
            dayCell.classList.add('is-today');
        }

        const eventsList = document.createElement('ul');
        // Generate a color map for participants
        const participantColors = {};
        allSchedulesData.forEach((schedule, index) => {
            const participant = schedule.participant_id || 'Unknown';
            if (!participantColors[participant]) {
                // Assign a color from a predefined list or generate one
                const colorIndex = Object.keys(participantColors).length % 10; // Cycle through 10 colors
                const hue = (colorIndex * 36) % 360; // Spread colors around the color wheel
                participantColors[participant] = `hsl(${hue}, 70%, 80%)`; // Light pastel colors
            }
        });
        
        allSchedulesData.forEach(schedule => {
            const participant = schedule.participant_id || 'Unknown';
            const participantColor = participantColors[participant] || '#e0e0e0';

            // First session (if exists)
            if (schedule.session_dates && schedule.session_dates.length > 0) {
                if (normalizeDateToYYYYMMDD(schedule.session_dates[0]) === currentDateStringYYYYMMDD) {
                    addEventToList(
                        eventsList,
                        `>> ${participant} <<`,
                        'event-first-session',
                        `Participant ${participant} - First Session`,
                        participantColor
                    );
                }
                
                // Middle sessions (all sessions except first and last)
                if (schedule.session_dates.length > 2) {
                    schedule.session_dates.slice(1, -1).forEach((sessionDate, index) => {
                        if (normalizeDateToYYYYMMDD(sessionDate) === currentDateStringYYYYMMDD) {
                            addEventToList(
                                eventsList,
                                participant,
                                'event-session',
                                `Participant ${participant} - Session ${index+2}`,
                                participantColor
                            );
                        }
                    });
                }
                
                // Last regular session
                if (schedule.session_dates.length > 1) {
                    const lastSessionDate = schedule.session_dates[schedule.session_dates.length - 1];
                    if (normalizeDateToYYYYMMDD(lastSessionDate) === currentDateStringYYYYMMDD) {
                        addEventToList(
                            eventsList,
                            `<< ${participant} >>`,
                            'event-last-session',
                            `Participant ${participant} - Last Session`,
                            participantColor
                        );
                    }
                }
            }
            
            // Backup sessions
            if (schedule.backup_dates && schedule.backup_dates.length > 0) {
                // Regular backup sessions (all except last)
                schedule.backup_dates.slice(0, -1).forEach((bDate) => {
                    if (normalizeDateToYYYYMMDD(bDate) === currentDateStringYYYYMMDD) {
                        addEventToList(
                            eventsList,
                            `[[ ${participant} ]]`,
                            'event-backup',
                            `Participant ${participant} - Backup`,
                            participantColor
                        );
                    }
                });
                
                // Last backup session
                const lastBackupDate = schedule.backup_dates[schedule.backup_dates.length - 1];
                if (normalizeDateToYYYYMMDD(lastBackupDate) === currentDateStringYYYYMMDD) {
                    addEventToList(
                        eventsList,
                        `[[ << ${participant} >> ]]`,
                        'event-last-backup',
                        `Participant ${participant} - Last Backup`,
                        participantColor
                    );
                }
            }
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

// --- Utility Functions ---
function normalizeDateToYYYYMMDD(dateInput) {
    // Input can be a Date object or a string (YYYY-MM-DD or ISO with time)
    if (!dateInput) return null;
    try {
        // Handle if dateInput is already YYYY-MM-DD string
        if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
            return dateInput;
        }
        // For Date objects or other string formats, convert to UTC date parts
        const d = new Date(dateInput);
        const year = d.getUTCFullYear();
        const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
        const day = d.getUTCDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) {
        console.warn("Could not normalize date for calendar/table:", dateInput, e);
        return typeof dateInput === 'string' ? dateInput.split('T')[0] : null; // Fallback
    }
}

function formatDateForTableDisplay(dateStringYYYYMMDD) {
    if (!dateStringYYYYMMDD) return 'N/A';
    // Assuming dateString is YYYY-MM-DD
    const date = new Date(dateStringYYYYMMDD + 'T00:00:00'); // Treat as local date for display
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// --- End of experimenter_script.js ---
