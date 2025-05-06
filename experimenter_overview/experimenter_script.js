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

    // --- DOM Elements ---
    const overviewContentDiv = document.getElementById('overviewContent');
    const scheduleTableContainer = document.getElementById('scheduleTableContainer');
    // Calendar View Elements
    const calendarViewContainer = document.getElementById('calendarViewContainer');
    const calendarLoadingMsg = document.getElementById('calendarLoading');
    const calendarTitleSpan = document.getElementById('calendarTitle');
    const calendarDaysDiv = document.getElementById('calendarDays');
    const prevMonthBtn = document.getElementById('prevMonthBtn');
    const nextMonthBtn = document.getElementById('nextMonthBtn');


    // --- State for Calendar View ---
    let currentDisplayDate = new Date(); // For calendar month/year
    let allFetchedSchedules = []; // To store all schedules once fetched

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
        loadAllSchedulesAndRender(); // Load data once Firebase is ready
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        scheduleTableContainer.innerHTML = '<p class="error-message">Critical Error: Could not connect to database.</p>';
        calendarLoadingMsg.textContent = 'Critical Error: Could not connect to database.';
        calendarLoadingMsg.classList.add('error-message');
        return;
    }

    // --- Utility Functions ---
    function parseDate(dateString) { // Expects YYYY-MM-DD
        if (!dateString || typeof dateString !== 'string') return null;
        const parts = dateString.split('-');
        if (parts.length !== 3) return null;
        const [year, month, day] = parts.map(Number);
        if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
        return new Date(Date.UTC(year, month - 1, day)); // Use UTC for consistency
    }

    function formatDateForDisplay(dateObj, format = { weekday: 'short', month: 'short', day: '2-digit' }) {
        if (!dateObj || !(dateObj instanceof Date)) return 'N/A';
        try {
            return dateObj.toLocaleDateString('en-US', format);
        } catch (e) {
            return 'Invalid Date';
        }
    }

    // --- Main Data Loading and Rendering Function ---
    async function loadAllSchedulesAndRender() {
        if (!db) {
            scheduleTableContainer.innerHTML = '<p class="error-message">Database not initialized.</p>';
            calendarLoadingMsg.textContent = 'Database not initialized.';
            calendarLoadingMsg.classList.add('error-message');
            return;
        }

        scheduleTableContainer.innerHTML = '<p class="loading-message">Fetching schedules table...</p>';
        calendarLoadingMsg.textContent = 'Fetching schedules for calendar...';
        calendarLoadingMsg.classList.remove('error-message');
        calendarLoadingMsg.classList.add('loading-message');


        try {
            // Fetch all schedules, order by session1Date to make chronological sense in table
            const snapshot = await db.collection(FIRESTORE_COLLECTION).orderBy("session1Date", "asc").get();
            
            allFetchedSchedules = snapshot.docs.map(doc => {
                const data = doc.data();
                // Convert timestamp to Date object for easier handling
                const submittedAt = data.submittedAt && data.submittedAt.toDate ? data.submittedAt.toDate() : null;
                return {
                    id: doc.id, // Firestore document ID
                    participantUid: data.participantUid,
                    session1Date: data.session1Date, // string YYYY-MM-DD
                    followUpDates: data.followUpDates || [],
                    backupDates: data.backupDates || [],
                    submittedAt: submittedAt
                };
            });
            
            console.log(`Fetched ${allFetchedSchedules.length} schedules.`);

            renderSchedulesTable(allFetchedSchedules);
            renderCalendarView(currentDisplayDate.getUTCFullYear(), currentDisplayDate.getUTCMonth()); // Render current month

        } catch (error) {
            console.error("Error fetching schedules:", error);
            scheduleTableContainer.innerHTML = `<p class="error-message">Error loading schedules table: ${error.message}</p>`;
            calendarLoadingMsg.textContent = `Error loading calendar: ${error.message}`;
            calendarLoadingMsg.classList.add('error-message');

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

            const sortedFollowUps = [...followUps].sort(); // Lexical sort OK for YYYY-MM-DD
            const sortedBackups = [...backups].sort();

            const session1DateObj = parseDate(schedule.session1Date);
            const lastRegularDateStr = sortedFollowUps.length > 0 ? sortedFollowUps[sortedFollowUps.length - 1] : null;
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

        // Add event listeners for delete buttons
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', handleDeleteSchedule);
        });
    }

    // --- Calendar View Rendering ---
    function renderCalendarView(year, month) { // month is 0-indexed
        calendarLoadingMsg.style.display = 'none'; // Hide loading once rendering starts
        calendarDaysDiv.innerHTML = ''; // Clear previous days
        currentDisplayDate.setUTCFullYear(year, month, 1); // Set to first of the month for calculations

        calendarTitleSpan.textContent = `${currentDisplayDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;

        const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
        const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0));
        const firstDayOfWeek = firstDayOfMonth.getUTCDay(); // 0=Sun, 1=Mon, ...
        const totalDays = lastDayOfMonth.getUTCDate();

        // Add empty cells for days before the first of the month
        for (let i = 0; i < firstDayOfWeek; i++) {
            calendarDaysDiv.innerHTML += `<div class="calendar-day other-month"></div>`;
        }

        // Add cells for each day of the month
        for (let day = 1; day <= totalDays; day++) {
            const currentDate = new Date(Date.UTC(year, month, day));
            const currentDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayCell = document.createElement('div');
            dayCell.classList.add('calendar-day');
            dayCell.innerHTML = `<span>${day}</span>`;

            const today = new Date();
            if (currentDate.getUTCFullYear() === today.getUTCFullYear() &&
                currentDate.getUTCMonth() === today.getUTCMonth() &&
                currentDate.getUTCDate() === today.getUTCDate()) {
                dayCell.classList.add('is-today');
            }

            // Find events for this day
            const eventsOnThisDay = [];
            allFetchedSchedules.forEach(schedule => {
                if (schedule.session1Date === currentDateStr) {
                    eventsOnThisDay.push({ type: 'session1', uid: schedule.participantUid, class: 'event-session1' });
                }
                if (schedule.followUpDates.includes(currentDateStr)) {
                    const isLastFollowUp = schedule.followUpDates.sort().pop() === currentDateStr;
                    eventsOnThisDay.push({ type: isLastFollowUp ? 'last-regular' : 'follow-up', uid: schedule.participantUid, class: isLastFollowUp ? 'event-last-regular' : 'event-follow-up'});
                }
                if (schedule.backupDates.includes(currentDateStr)) {
                     const isLastBackup = schedule.backupDates.sort().pop() === currentDateStr;
                    eventsOnThisDay.push({ type: isLastBackup ? 'last-backup' : 'backup', uid: schedule.participantUid, class: isLastBackup ? 'event-last-backup' : 'event-backup'});
                }
            });

            if (eventsOnThisDay.length > 0) {
                const ul = document.createElement('ul');
                eventsOnThisDay.forEach(event => {
                    const li = document.createElement('li');
                    li.classList.add(event.class);
                    li.textContent = `${event.type === 'session1' ? 'S1' : event.type === 'follow-up' ? 'F' : event.type === 'backup' ? 'B' : event.type === 'last-regular' ? 'LR' : 'LB'}: ${event.uid.substring(0, 6)}..`; // Abbreviate UID
                    li.title = `${event.type.replace('-', ' ')} - ${event.uid}`;
                    ul.appendChild(li);
                });
                dayCell.appendChild(ul);
            }
            calendarDaysDiv.appendChild(dayCell);
        }
    }

    // Calendar Navigation
    prevMonthBtn.addEventListener('click', () => {
        currentDisplayDate.setUTCMonth(currentDisplayDate.getUTCMonth() - 1);
        renderCalendarView(currentDisplayDate.getUTCFullYear(), currentDisplayDate.getUTCMonth());
    });

    nextMonthBtn.addEventListener('click', () => {
        currentDisplayDate.setUTCMonth(currentDisplayDate.getUTCMonth() + 1);
        renderCalendarView(currentDisplayDate.getUTCFullYear(), currentDisplayDate.getUTCMonth());
    });


    // --- Delete Schedule Functionality ---
    async function handleDeleteSchedule(event) {
        const docId = event.target.dataset.docId;
        const uid = event.target.dataset.uid;

        if (!docId) {
            alert("Error: Document ID not found for deletion.");
            return;
        }

        if (confirm(`Are you sure you want to delete the schedule for participant UID: ${uid} (Doc ID: ${docId})? This cannot be undone.`)) {
            try {
                await db.collection(FIRESTORE_COLLECTION).doc(docId).delete();
                console.log("Document successfully deleted!");
                alert(`Schedule for ${uid} deleted successfully.`);
                loadAllSchedulesAndRender(); // Refresh the views
            } catch (error) {
                console.error("Error removing document: ", error);
                alert(`Error deleting schedule: ${error.message}`);
            }
        }
    }

    // Initial load is triggered after Firebase initialization
});
