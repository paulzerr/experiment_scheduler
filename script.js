document.addEventListener('DOMContentLoaded', () => {
    // NO CLIENT-SIDE PASSWORD HERE - Use Netlify's built-in password protection for the /experimenter/ path

    // --- Firebase Configuration (Same as participant script.js) ---
    // IMPORTANT: Replace with your actual Firebase config
    const firebaseConfig = {
      apiKey: "YOUR_API_KEY",
      authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
      projectId: "YOUR_PROJECT_ID",
      storageBucket: "YOUR_PROJECT_ID.firebasestorage.app", // Or .appspot.com - check your config!
      messagingSenderId: "YOUR_SENDER_ID",
      appId: "YOUR_APP_ID"
      // measurementId: "G-XXXXXXXXXX" // Optional
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
    let currentDisplayDate = new Date(); // For calendar month/year
    let allFetchedSchedules = [];
    let participantColors = {}; // Stores UID -> color mapping
    let distinctColorPalette = []; // Will be populated with distinct colors

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
        distinctColorPalette = generateDistinctColors(MAX_DISTINCT_COLORS); // Generate palette once
        loadAllSchedulesAndRender();
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
        if (!dateObj || !(dateObj instanceof Date) || isNaN(dateObj.getTime())) return 'N/A'; // Check for invalid Date
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
        const saturation = 0.7; // Keep saturation fairly high for visibility
        const lightness = 0.75; // Keep lightness in a pastelly range
        for (let i = 0; i < count; i++) {
            const hue = (i * (360 / count)) % 360;
            colors.push(`hsl(${hue}, ${saturation * 100}%, ${lightness * 100}%)`);
        }
        return colors;
    }

    let colorAssignmentIndex = 0;
    function getParticipantColor(uid) {
        if (!participantColors[uid]) {
            participantColors[uid] = distinctColorPalette[colorAssignmentIndex % distinctColorPalette.length];
            colorAssignmentIndex++;
        }
        return participantColors[uid];
    }

    function resetParticipantColorAssignments() { // Call if you want to re-assign colors on full data reload
        participantColors = {};
        colorAssignmentIndex = 0;
    }

    function adjustHslColor(hslString, lightnessFactor) {
        // hslString is like "hsl(120, 70%, 75%)"
        // lightnessFactor is e.g. 0.8 for 80% of original, 1.2 for 120%
        try {
            const parts = hslString.match(/hsl\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)/);
            if (!parts) return hslString; // Return original if parse fails
            let hue = parseInt(parts[1]);
            let saturation = parseFloat(parts[2]);
            let lightness = parseFloat(parts[3]);

            lightness = Math.min(100, Math.max(0, lightness * lightnessFactor)); // Adjust lightness

            return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        } catch (e) {
            return hslString; // Safety net
        }
    }

    function isHslColorLight(hslString) {
        try {
            const parts = hslString.match(/hsl\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)/);
            if (!parts) return true; // Default to light if parse fails
            let lightness = parseFloat(parts[3]);
            return lightness > 60; // Threshold for considering a HSL color "light" enough for dark text
        } catch (e) {
            return true;
        }
    }


    // --- Main Data Loading and Rendering Function ---
    async function loadAllSchedulesAndRender() {
        resetParticipantColorAssignments(); // Reset color assignments for fresh render

        if (!db) {
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
            const lastRegularDateStr = sortedFollowUps.length > 0 ? sortedFollowUps[sortedFollowUps.length - 1] : schedule.session1Date; // Fallback to session1 if no followups
            const lastRegularDateObj = parseDate(lastRegularDateStr);
            const lastBackupDateStr = sortedBackups.length > 0 ? sortedBackups[sortedBackups.length - 1] : null;
            const lastBackupDateObj = parseDate(lastBackupDateStr);

            // Get participant's assigned color for table row indication (optional)
            // const pColor = getParticipantColor(schedule.participantUid);
            // style="border-left: 5px solid ${pColor};" on <tr> or first <td>

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
    function renderCalendarView(year, month) { // month is 0-indexed
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
                const pColor = getParticipantColor(schedule.participantUid); // Get color for this participant
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
                        eventsOnThisDay.push({ type: 'LB', uid: schedule.participantUid, color: adjustHslColor(pColor, 0.85) }); // Darker for backup
                    } else {
                        eventsOnThisDay.push({ type: 'B', uid: schedule.participantUid, color: adjustHslColor(pColor, 0.85) }); // Darker for backup
                    }
                }
            });

            if (eventsOnThisDay.length > 0) {
                const ul = document.createElement('ul');
                eventsOnThisDay.forEach(event => {
                    const li = document.createElement('li');
                    li.style.backgroundColor = event.color;
                    li.style.color = isHslColorLight(event.color) ? '#333' : '#fff'; // Adjust text color for readability
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
                loadAllSchedulesAndRender(); // Refresh views
            } catch (error) {
                console.error("Error removing document: ", error);
                alert(`Error deleting schedule: ${error.message}`);
            }
        }
    }
});
