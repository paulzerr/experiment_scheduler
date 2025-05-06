document.addEventListener('DOMContentLoaded', () => {
    // NO CLIENT-SIDE PASSWORD HERE - Use Netlify's built-in password protection for the /experimenter/ path

    // --- Firebase Configuration ---
    const firebaseConfig = {
        apiKey: "AIzaSyA2wAZ65IDnHC4GzQh1dR9BVkgp_5Ooz6E",
        authDomain: "scheduler-47c5c.firebaseapp.com",
        projectId: "scheduler-47c5c",
        storageBucket: "scheduler-47c5c.firebasestorage.app",
        messagingSenderId: "114842587009",
        appId: "1:114842587009:web:ec49cc7039f6a833746280",
        measurementId: "G-L8BPGHKVQJ"
    };
    const FIRESTORE_COLLECTION = "schedules";
    const MAX_DISTINCT_COLORS = 30;

    // --- DOM Elements ---
    const overviewContentDiv = document.getElementById('overviewContent');
    const scheduleTableContainer = document.getElementById('scheduleTableContainer');
    const calendarViewContainer = document.getElementById('calendarViewContainer');
    const calendarLoadingMsg = document.getElementById('calendarLoading');
    const calendarTitleSpan = document.getElementById('calendarTitle');
    const calendarDaysDiv = document.getElementById('calendarDays');
    const prevMonthBtn = document.getElementById('prevMonthBtn');
    const nextMonthBtn = document.getElementById('nextMonthBtn');

    // --- State for Calendar View & Colors ---
    let currentDisplayDate = new Date();
    let allFetchedSchedules = [];
    // **FIX:** Initialize these here before any function can be called that uses them.
    let participantColors = {};
    let colorAssignmentIndex = 0;
    let distinctColorPalette = []; // Will be populated after Firebase init

    // --- Initialize Firebase ---
    let db;
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        } else {
            firebase.app();
        }
        db = firebase.firestore();
        console.log("Firebase initialized for experimenter view.");
        distinctColorPalette = generateDistinctColors(MAX_DISTINCT_COLORS);
        loadAllSchedulesAndRender(); // Now safe to call
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        if (scheduleTableContainer) scheduleTableContainer.innerHTML = '<p class="error-message">Critical Error: Could not connect to database.</p>';
        if (calendarLoadingMsg) {
            calendarLoadingMsg.textContent = 'Critical Error: Could not connect to database.';
            calendarLoadingMsg.classList.add('error-message');
        }
        return;
    }

    // --- Utility Functions ---
    function parseDate(dateString) {
        if (!dateString || typeof dateString !== 'string') return null;
        const parts = dateString.split('-');
        if (parts.length !== 3) return null;
        const [year, month, day] = parts.map(Number);
        if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
        return new Date(Date.UTC(year, month - 1, day));
    }

    function formatDateForDisplay(dateObj, format = { weekday: 'short', month: 'short', day: '2-digit' }) {
        if (!dateObj || !(dateObj instanceof Date) || isNaN(dateObj.getTime())) return 'N/A';
        try {
            return dateObj.toLocaleDateString('en-US', format);
        } catch (e) {
            console.warn("Error formatting date:", dateObj, e);
            return 'Invalid Date';
        }
    }

    // --- Color Generation & Management ---
    function generateDistinctColors(count) {
        const colors = [];
        const saturation = 0.7;
        const lightness = 0.75;
        for (let i = 0; i < count; i++) {
            const hue = (i * (360 / count)) % 360;
            colors.push(`hsl(${hue}, ${saturation * 100}%, ${lightness * 100}%)`);
        }
        return colors;
    }

    // **REMOVED from here, initialized globally above:**
    // let colorAssignmentIndex = 0;
    function getParticipantColor(uid) {
        if (!participantColors[uid]) {
            if (distinctColorPalette.length === 0) { // Safety check if palette wasn't generated
                console.warn("Distinct color palette is empty. Defaulting color.");
                participantColors[uid] = 'hsl(0, 0%, 80%)'; // A default gray
            } else {
                participantColors[uid] = distinctColorPalette[colorAssignmentIndex % distinctColorPalette.length];
            }
            colorAssignmentIndex++;
        }
        return participantColors[uid];
    }

    function resetParticipantColorAssignments() {
        participantColors = {}; // Re-assigns the global variable
        colorAssignmentIndex = 0; // Re-assigns the global variable
    }

    function adjustHslColor(hslString, lightnessFactor) {
        try {
            const parts = hslString.match(/hsl\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)/);
            if (!parts) return hslString;
            let hue = parseInt(parts[1]);
            let saturation = parseFloat(parts[2]);
            let lightness = parseFloat(parts[3]);
            lightness = Math.min(100, Math.max(0, lightness * lightnessFactor));
            return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        } catch (e) {
            return hslString;
        }
    }

    function isHslColorLight(hslString) {
        try {
            const parts = hslString.match(/hsl\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)/);
            if (!parts) return true;
            let lightness = parseFloat(parts[3]);
            return lightness > 60;
        } catch (e) {
            return true;
        }
    }

    // --- Main Data Loading and Rendering Function ---
    async function loadAllSchedulesAndRender() {
        resetParticipantColorAssignments(); // This is now safe

        if (!db) {
            // ... (error handling as before)
            if (scheduleTableContainer) scheduleTableContainer.innerHTML = '<p class="error-message">Database not initialized.</p>';
            if (calendarLoadingMsg) {
                calendarLoadingMsg.textContent = 'Database not initialized.';
                calendarLoadingMsg.classList.add('error-message');
            }
            return;
        }

        if (scheduleTableContainer) scheduleTableContainer.innerHTML = '<p class="loading-message">Fetching schedules table...</p>';
        if (calendarLoadingMsg) {
            calendarLoadingMsg.textContent = 'Fetching schedules for calendar...';
            calendarLoadingMsg.classList.remove('error-message');
            calendarLoadingMsg.classList.add('loading-message');
        }


        try {
            const snapshot = await db.collection(FIRESTORE_COLLECTION).orderBy("session1Date", "asc").get();
            allFetchedSchedules = snapshot.docs.map(doc => {
                const data = doc.data();
                const submittedAt = data.submittedAt && data.submittedAt.toDate ? data.submittedAt.toDate() : null;
                return {
                    id: doc.id,
                    participantUid: data.participantUid,
                    session1Date: data.session1Date,
                    followUpDates: data.followUpDates || [],
                    backupDates: data.backupDates || [],
                    submittedAt: submittedAt
                };
            });

            console.log(`Fetched ${allFetchedSchedules.length} schedules.`);
            if (scheduleTableContainer) renderSchedulesTable(allFetchedSchedules);
            if (calendarDaysDiv) renderCalendarView(currentDisplayDate.getUTCFullYear(), currentDisplayDate.getUTCMonth());

        } catch (error) {
            console.error("Error fetching schedules:", error);
            if (scheduleTableContainer) scheduleTableContainer.innerHTML = `<p class="error-message">Error loading schedules table: ${error.message}</p>`;
            if (calendarLoadingMsg) {
                calendarLoadingMsg.textContent = `Error loading calendar: ${error.message}`;
                calendarLoadingMsg.classList.add('error-message');
            }
        }
    }

    // --- Table View Rendering ---
    function renderSchedulesTable(schedules) {
        // ... (same as previous version) ...
        if (schedules.length === 0) {
            scheduleTableContainer.innerHTML = '<p class="no-schedules-message">No schedules found.</p>';
            return;
        }

        let tableHTML = `<table>
            <thead>
                <tr>
                    <th>Participant UID</th>
                    <th>Submitted At</th>
                    <th>Session 1</th>
                    <th>Last Regular Follow-up</th>
                    <th>Last Backup</th>
                    <th>Follow-ups (#)</th>
                    <th>Backups (#)</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>`;

        schedules.forEach(schedule => {
            const submittedAtDisplay = schedule.submittedAt ? formatDateForDisplay(schedule.submittedAt, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';

            const followUps = schedule.followUpDates || [];
            const backups = schedule.backupDates || [];

            const sortedFollowUps = [...followUps].sort();
            const sortedBackups = [...backups].sort();

            const session1DateObj = parseDate(schedule.session1Date);
            const lastRegularDateStr = sortedFollowUps.length > 0 ? sortedFollowUps[sortedFollowUps.length - 1] : schedule.session1Date;
            const lastRegularDateObj = parseDate(lastRegularDateStr);
            const lastBackupDateStr = sortedBackups.length > 0 ? sortedBackups[sortedBackups.length - 1] : null;
            const lastBackupDateObj = parseDate(lastBackupDateStr);

            tableHTML += `<tr>
                <td class="uid-column">${schedule.participantUid}</td>
                <td class="timestamp-column">${submittedAtDisplay}</td>
                <td class="session1">${formatDateForDisplay(session1DateObj)} (${schedule.session1Date || 'N/A'})</td>
                <td class="last-regular">${formatDateForDisplay(lastRegularDateObj)} (${lastRegularDateStr || 'N/A'})</td>
                <td class="last-backup">${formatDateForDisplay(lastBackupDateObj)} (${lastBackupDateStr || 'N/A'})</td>
                <td>${followUps.length}</td>
                <td>${backups.length}</td>
                <td class="action-buttons">
                    <button class="delete-btn" data-doc-id="${schedule.id}" data-uid="${schedule.participantUid}">Delete</button>
                </td>
            </tr>`;
        });

        tableHTML += '</tbody></table>';
        scheduleTableContainer.innerHTML = tableHTML;

        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', handleDeleteSchedule);
        });
    }

    // --- Calendar View Rendering ---
    function renderCalendarView(year, month) {
        // ... (same as previous version, uses the globally initialized colorAssignmentIndex and participantColors) ...
        if (calendarLoadingMsg) calendarLoadingMsg.style.display = 'none';
        if (!calendarDaysDiv) return;
        calendarDaysDiv.innerHTML = '';
        currentDisplayDate.setUTCFullYear(year, month, 1);

        if (calendarTitleSpan) calendarTitleSpan.textContent = `${currentDisplayDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone:'UTC' })}`;

        const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
        const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0));
        const firstDayOfWeek = firstDayOfMonth.getUTCDay();
        const totalDaysInMonth = lastDayOfMonth.getUTCDate();

        for (let i = 0; i < firstDayOfWeek; i++) {
            calendarDaysDiv.innerHTML += `<div class="calendar-day other-month"></div>`;
        }

        for (let day = 1; day <= totalDaysInMonth; day++) {
            const currentDateObj = new Date(Date.UTC(year, month, day));
            const currentDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayCell = document.createElement('div');
            dayCell.classList.add('calendar-day');
            dayCell.innerHTML = `<span>${day}</span>`;

            const today = new Date();
            if (currentDateObj.getUTCFullYear() === today.getUTCFullYear() &&
                currentDateObj.getUTCMonth() === today.getUTCMonth() &&
                currentDateObj.getUTCDate() === today.getUTCDate()) {
                dayCell.classList.add('is-today');
            }

            const eventsOnThisDay = [];
            allFetchedSchedules.forEach(schedule => {
                const pColor = getParticipantColor(schedule.participantUid);
                const scheduleFollowUps = schedule.followUpDates || [];
                const scheduleBackups = schedule.backupDates || [];
                const sortedScheduleFollowUps = [...scheduleFollowUps].sort();
                const sortedScheduleBackups = [...scheduleBackups].sort();
                const lastFollowUpInSchedule = sortedScheduleFollowUps.length > 0 ? sortedScheduleFollowUps[sortedScheduleFollowUps.length - 1] : null;
                const lastBackupInSchedule = sortedScheduleBackups.length > 0 ? sortedScheduleBackups[sortedScheduleBackups.length - 1] : null;

                if (schedule.session1Date === currentDateStr) {
                    eventsOnThisDay.push({ type: 'S1', uid: schedule.participantUid, color: pColor });
                }
                if (scheduleFollowUps.includes(currentDateStr)) {
                    if (currentDateStr === lastFollowUpInSchedule) {
                        eventsOnThisDay.push({ type: 'LR', uid: schedule.participantUid, color: pColor });
                    } else {
                        eventsOnThisDay.push({ type: 'F', uid: schedule.participantUid, color: pColor });
                    }
                }
                if (scheduleBackups.includes(currentDateStr)) {
                    if (currentDateStr === lastBackupInSchedule) {
                        eventsOnThisDay.push({ type: 'LB', uid: schedule.participantUid, color: adjustHslColor(pColor, 0.85) });
                    } else {
                        eventsOnThisDay.push({ type: 'B', uid: schedule.participantUid, color: adjustHslColor(pColor, 0.85) });
                    }
                }
            });

            if (eventsOnThisDay.length > 0) {
                const ul = document.createElement('ul');
                eventsOnThisDay.forEach(event => {
                    const li = document.createElement('li');
                    li.style.backgroundColor = event.color;
                    li.style.color = isHslColorLight(event.color) ? '#333' : '#fff';
                    li.textContent = `${event.type}: ${event.uid.substring(0, 6)}..`;
                    let fullType = event.type;
                    if(event.type === 'S1') fullType = 'Session 1';
                    else if(event.type === 'F') fullType = 'Follow-up';
                    else if(event.type === 'B') fullType = 'Backup';
                    else if(event.type === 'LR') fullType = 'Last Regular';
                    else if(event.type === 'LB') fullType = 'Last Backup';
                    li.title = `${fullType} - ${event.uid}`;
                    ul.appendChild(li);
                });
                dayCell.appendChild(ul);
            }
            calendarDaysDiv.appendChild(dayCell);
        }
    }

    // Calendar Navigation
    if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', () => {
            currentDisplayDate.setUTCMonth(currentDisplayDate.getUTCMonth() - 1);
            renderCalendarView(currentDisplayDate.getUTCFullYear(), currentDisplayDate.getUTCMonth());
        });
    }
    if (nextMonthBtn) {
        nextMonthBtn.addEventListener('click', () => {
            currentDisplayDate.setUTCMonth(currentDisplayDate.getUTCMonth() + 1);
            renderCalendarView(currentDisplayDate.getUTCFullYear(), currentDisplayDate.getUTCMonth());
        });
    }

    // --- Delete Schedule Functionality ---
    async function handleDeleteSchedule(event) {
        const docId = event.target.dataset.docId;
        const uid = event.target.dataset.uid;
        if (!docId) { alert("Error: Document ID not found."); return; }
        if (confirm(`Are you sure you want to delete the schedule for UID: ${uid}? This cannot be undone.`)) {
            try {
                await db.collection(FIRESTORE_COLLECTION).doc(docId).delete();
                console.log("Document successfully deleted!");
                alert(`Schedule for ${uid} deleted.`);
                loadAllSchedulesAndRender();
            } catch (error) {
                console.error("Error removing document: ", error);
                alert(`Error deleting schedule: ${error.message}`);
            }
        }
    }
});
