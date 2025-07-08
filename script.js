// script.js - Participant Scheduler for Supabase

// --- Supabase Configuration ---
let supabaseClient;

if (window.supabase) { // Check if the Supabase global object from SDK is available
    supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
} else {
    console.error("Supabase SDK not loaded. Make sure the Supabase JS SDK script is included before this script.");
}


// --- DOM Elements ---
const participantInfoDiv = document.getElementById('participantInfo');
const errorMessagesDiv = document.getElementById('errorMessages');
const loadingStatusDiv = document.getElementById('loadingStatus');
const schedulerContentDiv = document.getElementById('schedulerContent');
const session1CalendarDiv = document.getElementById('session1Calendar');
const followUpSection = document.getElementById('followUpSection');
const followUpCalendarDiv = document.getElementById('followUpCalendar');
const followUpCountSpan = document.getElementById('followUpCount');
const backupSection = document.getElementById('backupSection');
const backupCalendarDiv = document.getElementById('backupCalendar');
const backupCountSpan = document.getElementById('backupCount');
const reviewButton = document.getElementById('reviewButton');
const summarySection = document.getElementById('summarySection');
const logOutputPre = document.getElementById('logOutput');
const submitButton = document.getElementById('submitButton');
const submissionStatusP = document.getElementById('submissionStatus');
const pdfStatusP = document.getElementById('pdfStatus');

// --- State Variables ---
let participantInfo = null; // Will hold { id, link_id, schedule_from }
let selectedSessions = []; // All sessions in a single array
let selectedBackups = [];
let allBookedDates = new Set(); // Use a Set for efficient lookup of booked dates (YYYY-MM-DD strings)
let availableSlots = 0; // Number of available slots for concurrent sessions

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initializeScheduler();
});

async function getParticipantInfo() {
    const params = new URLSearchParams(window.location.search);
    const linkId = params.get('pid');
    if (!linkId) {
        throw new Error("Participant link ID not found in URL. Please use the link provided.");
    }

    const { data, error } = await supabaseClient
        .from('schedules')
        .select('id, link_id, schedule_from, submission_timestamp')
        .eq('link_id', linkId)
        .maybeSingle();

    if (error) {
        console.error('Error fetching participant data:', error);
        throw new Error('Could not verify participant information.');
    }

    if (!data) {
        throw new Error('This participation link is not valid. Please contact the experimenters.');
    }
    
    if (data.submission_timestamp) {
        throw new Error('You have already submitted your schedule. Please contact experimenters if you need to make changes.');
    }

    return {
        id: data.id,
        link_id: data.link_id,
        schedule_from: data.schedule_from // YYYY-MM-DD
    };
}

async function initializeScheduler() {
    loadingStatusDiv.textContent = 'Loading availability...';
    loadingStatusDiv.classList.remove('hidden');
    schedulerContentDiv.classList.add('hidden');

    try {
        participantInfo = await getParticipantInfo();
        
        participantInfoDiv.textContent = `Participant ID: ${participantInfo.link_id}`;
        participantInfoDiv.classList.remove('hidden');

        await fetchBookedDates(); // Fetch dates booked by other participants
        populateSession1Calendar();
        schedulerContentDiv.classList.remove('hidden');
        loadingStatusDiv.classList.add('hidden');
    } catch (error) {
        console.error("Error initializing scheduler:", error);
        showError(error.message || "Failed to load availability. Please try refreshing the page or contact the experimenters.");
        loadingStatusDiv.classList.add('hidden');
    }
}

// --- Data Fetching (Supabase) ---
async function fetchBookedDates() {
    allBookedDates.clear();
    
    // Fetch all booked dates to calculate availability
    const { data, error } = await supabaseClient
        .from('schedules')
        .select('session_dates, backup_dates');

    if (error) {
        console.error('Error fetching booked dates:', error);
        throw new Error('Could not fetch schedule data from Supabase.');
    }

    // Count dates to determine concurrent sessions
    const dateCount = new Map(); // Map to count sessions per date
    
    if (data) {
        data.forEach(schedule => {
            // Count regular sessions
            if (schedule.session_dates && Array.isArray(schedule.session_dates)) {
                schedule.session_dates.forEach(d => {
                    const normalizedDate = normalizeDateToYYYYMMDD(d);
                    const currentCount = dateCount.get(normalizedDate) || 0;
                    dateCount.set(normalizedDate, currentCount + 1);
                    
                    // If date has reached max concurrent sessions, mark as booked
                    if (currentCount + 1 >= SCHEDULER_CONFIG.MAX_CONCURRENT_SESSIONS) {
                        allBookedDates.add(normalizedDate);
                    }
                });
            }
            
            // Add backup dates to booked dates (these are not counted for concurrency)
            if (schedule.backup_dates && Array.isArray(schedule.backup_dates)) {
                schedule.backup_dates.forEach(d => {
                    const normalizedDate = normalizeDateToYYYYMMDD(d);
                    const currentCount = dateCount.get(normalizedDate) || 0;
                    dateCount.set(normalizedDate, currentCount + 1);
                    
                    // If date has reached max concurrent sessions, mark as booked
                    if (currentCount + 1 >= SCHEDULER_CONFIG.MAX_CONCURRENT_SESSIONS) {
                        allBookedDates.add(normalizedDate);
                    }
                });
            }
        });
    }
    
    // Store the date count map for later use
    window.dateCountMap = dateCount;
}

// --- Calendar Population & Logic ---
function populateSession1Calendar() {
    session1CalendarDiv.innerHTML = ''; // Clear previous
    
    // Start date is either the participant's specified start date or tomorrow
    let startDate;
    if (participantInfo.schedule_from) {
        startDate = new Date(participantInfo.schedule_from + "T00:00:00");
    } else {
        startDate = getNextWorkDay(new Date());
    }
    
    startDate.setHours(0, 0, 0, 0); // Normalize to start of day

    for (let i = 0; i < SCHEDULER_CONFIG.SESSION1_WINDOW_DAYS; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        
        // Check if this date has available slots
        const dateStr = normalizeDateToYYYYMMDD(date);
        const currentCount = window.dateCountMap?.get(dateStr) || 0;
        const isAvailable = currentCount < SCHEDULER_CONFIG.MAX_CONCURRENT_SESSIONS;
        
        createDateButton(date, session1CalendarDiv, 'session1', isAvailable);
    }
}

function populateFollowUpCalendar() {
    followUpCalendarDiv.innerHTML = '';
    // Don't reset selectedSessions here, as we're adding to it
    updateFollowUpCount();

    if (selectedSessions.length === 0) return;

    const firstSessionDateObj = new Date(selectedSessions[0] + "T00:00:00"); // Ensure parsed as local
    for (let i = 1; i <= SCHEDULER_CONFIG.FOLLOW_UP_WINDOW_DAYS; i++) {
        const date = new Date(firstSessionDateObj);
        date.setDate(firstSessionDateObj.getDate() + i);
        
        // Check if this date has available slots
        const dateStr = normalizeDateToYYYYMMDD(date);
        const currentCount = window.dateCountMap?.get(dateStr) || 0;
        const isAvailable = currentCount < SCHEDULER_CONFIG.MAX_CONCURRENT_SESSIONS;
        
        // Ensure not already selected
        if (!selectedSessions.includes(dateStr)) {
            createDateButton(date, followUpCalendarDiv, 'followUp', isAvailable);
        }
    }
    followUpSection.classList.remove('hidden');
    
    // Update section title to show remaining sessions
    const remainingSessions = SCHEDULER_CONFIG.TOTAL_SESSIONS - selectedSessions.length;
    document.querySelector('#followUpSection h2').textContent = `Step 2: Select ${remainingSessions} More Sessions`;
    document.querySelector('#followUpSection p strong').textContent = remainingSessions.toString();
}

function populateBackupCalendar() {
    backupCalendarDiv.innerHTML = '';
    selectedBackups = []; // Reset when repopulating
    updateBackupCount();

    if (selectedSessions.length < SCHEDULER_CONFIG.TOTAL_SESSIONS) return;

    // Sort the selected sessions by date
    const sortedSessions = [...selectedSessions].sort();
    const lastSessionDateStr = sortedSessions[sortedSessions.length - 1]; // Get last date string
    if (!lastSessionDateStr) return;
    
    const lastSessionDateObj = new Date(lastSessionDateStr + "T00:00:00"); // Ensure parsed as local

    // Start backup dates from the day after the last session
    for (let i = 1; i <= SCHEDULER_CONFIG.BACKUP_WINDOW_DAYS; i++) {
        const date = new Date(lastSessionDateObj);
        date.setDate(lastSessionDateObj.getDate() + i);
        
        // Check if this date has available slots
        const dateStr = normalizeDateToYYYYMMDD(date);
        const currentCount = window.dateCountMap?.get(dateStr) || 0;
        const isAvailable = currentCount < SCHEDULER_CONFIG.MAX_CONCURRENT_SESSIONS;
        
        // Make sure the backup date isn't already selected as a regular session
        if (!selectedSessions.includes(dateStr)) {
            createDateButton(date, backupCalendarDiv, 'backup', isAvailable);
        }
    }
    backupSection.classList.remove('hidden');
}

// Helper function to get the next work day (Mon-Fri)
function getNextWorkDay(date) {
    const nextDay = new Date(date);
    nextDay.setDate(date.getDate() + 1); // Start with tomorrow
    
    // If it's a weekend, move to Monday
    const dayOfWeek = nextDay.getDay(); // 0 = Sunday, 6 = Saturday
    if (dayOfWeek === 0) { // Sunday
        nextDay.setDate(nextDay.getDate() + 1);
    } else if (dayOfWeek === 6) { // Saturday
        nextDay.setDate(nextDay.getDate() + 2);
    }
    
    return nextDay;
}

function createDateButton(dateObj, container, type, isAvailable = true) {
    const dateString = normalizeDateToYYYYMMDD(dateObj); // YYYY-MM-DD
    const button = document.createElement('button');
    button.classList.add('date-button');
    button.dataset.date = dateString;

    const weekday = dateObj.toLocaleDateString(undefined, { weekday: 'short' });
    const dayMonth = dateObj.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    button.innerHTML = `${dayMonth}<span class="weekday">${weekday}</span>`;

    const isGloballyBooked = allBookedDates.has(dateString);
    let isLocallySelectedInOtherCategory = false;

    // Check if already selected in another category
    if (type === 'followUp' && selectedSessions.includes(dateString)) {
        isLocallySelectedInOtherCategory = true;
    } else if (type === 'backup' && selectedSessions.includes(dateString)) {
        isLocallySelectedInOtherCategory = true;
    }

    if (isGloballyBooked || isLocallySelectedInOtherCategory || !isAvailable) {
        button.disabled = true;
        if (isGloballyBooked || !isAvailable) {
            button.title = "Date unavailable (maximum concurrent sessions reached)";
        } else {
            button.title = "Already selected for another session type";
        }
    } else {
        button.onclick = () => handleDateSelection(dateString, type, button);
    }

    // Check if selected for current type
    if ((type === 'session1' && selectedSessions.length > 0 && selectedSessions[0] === dateString) ||
        (type === 'followUp' && selectedSessions.includes(dateString)) ||
        (type === 'backup' && selectedBackups.includes(dateString))) {
        button.classList.add('selected');
    }
    container.appendChild(button);
}

function handleDateSelection(dateString, type, button) {
    clearError();
    switch (type) {
        case 'session1':
            // For session1, we're selecting the first session
            const previouslySelectedFirst = selectedSessions.length > 0 ? selectedSessions[0] : null;
            
            if (selectedSessions.length > 0 && selectedSessions[0] === dateString) { // Deselect
                selectedSessions = [];
                button.classList.remove('selected');
            } else { // Select
                if (selectedSessions.length > 0) { // Deselect previous button
                    const prevButton = session1CalendarDiv.querySelector(`.date-button[data-date="${selectedSessions[0]}"]`);
                    if (prevButton) prevButton.classList.remove('selected');
                    selectedSessions = [];
                }
                selectedSessions.push(dateString);
                button.classList.add('selected');
            }

            // If first session changed or deselected, reset subsequent steps
            if ((selectedSessions.length === 0) || (previouslySelectedFirst !== selectedSessions[0])) {
                // Keep only the first session if it exists
                if (selectedSessions.length > 0) {
                    selectedSessions = [selectedSessions[0]];
                } else {
                    selectedSessions = [];
                }
                selectedBackups = [];
                followUpSection.classList.add('hidden');
                backupSection.classList.add('hidden');
                updateFollowUpCount();
                updateBackupCount();
                if (selectedSessions.length > 0) { // Only populate if a new first session is selected
                    populateFollowUpCalendar();
                }
            }
            break;
            
        case 'followUp':
            const sessionIndex = selectedSessions.indexOf(dateString);
            if (sessionIndex > -1) { // Deselect
                selectedSessions.splice(sessionIndex, 1);
                button.classList.remove('selected');
            } else { // Select
                if (selectedSessions.length < SCHEDULER_CONFIG.TOTAL_SESSIONS) {
                    selectedSessions.push(dateString);
                    button.classList.add('selected');
                } else {
                    showError(`You can only select ${SCHEDULER_CONFIG.TOTAL_SESSIONS} total sessions.`);
                }
            }
            updateFollowUpCount();
            
            // Update the section title to show remaining sessions
            const remainingSessions = SCHEDULER_CONFIG.TOTAL_SESSIONS - selectedSessions.length;
            document.querySelector('#followUpSection h2').textContent = `Step 2: Select ${remainingSessions} More Sessions`;
            document.querySelector('#followUpSection p strong').textContent = remainingSessions.toString();
            
            if (selectedSessions.length === SCHEDULER_CONFIG.TOTAL_SESSIONS) {
                populateBackupCalendar();
            } else {
                selectedBackups = []; // Clear backups if session count changes below max
                backupSection.classList.add('hidden');
                updateBackupCount();
            }
            break;
            
        case 'backup':
            const backupIndex = selectedBackups.indexOf(dateString);
            if (backupIndex > -1) { // Deselect
                selectedBackups.splice(backupIndex, 1);
                button.classList.remove('selected');
            } else { // Select
                if (selectedBackups.length < SCHEDULER_CONFIG.NUM_BACKUP_SESSIONS) {
                    selectedBackups.push(dateString);
                    button.classList.add('selected');
                } else {
                    showError(`You can only select ${SCHEDULER_CONFIG.NUM_BACKUP_SESSIONS} backup sessions.`);
                }
            }
            updateBackupCount();
            break;
    }
    checkReviewButtonState();
}

function updateFollowUpCount() {
    // Show how many sessions are selected out of total required
    const totalRequired = SCHEDULER_CONFIG.TOTAL_SESSIONS;
    const selected = selectedSessions.length;
    const remaining = Math.max(0, totalRequired - selected);
    
    followUpCountSpan.textContent = selected > 1 ? selected - 1 : 0; // Don't count first session
}

function updateBackupCount() {
    backupCountSpan.textContent = selectedBackups.length;
}

function checkReviewButtonState() {
    if (selectedSessions.length === SCHEDULER_CONFIG.TOTAL_SESSIONS &&
        selectedBackups.length === SCHEDULER_CONFIG.NUM_BACKUP_SESSIONS) {
        reviewButton.disabled = false;
    } else {
        reviewButton.disabled = true;
        summarySection.classList.add('hidden');
    }
}

// --- Review and Submission ---
reviewButton.addEventListener('click', () => {
    selectedSessions.sort(); // Ensure sorted for display
    selectedBackups.sort();   // Ensure sorted for display

    logOutputPre.textContent = `Participant ID: ${participantInfo.link_id}\n\n` +
        `Experiment Sessions (${selectedSessions.length}):\n` +
        selectedSessions.map(d => `  - ${formatDateForDisplay(d)}`).join('\n') + `\n\n` +
        `Backup Sessions (${selectedBackups.length}):\n` +
        selectedBackups.map(d => `  - ${formatDateForDisplay(d)}`).join('\n');
    summarySection.classList.remove('hidden');
    submitButton.disabled = false;
    submissionStatusP.classList.add('hidden');
    pdfStatusP.classList.add('hidden');
});

submitButton.addEventListener('click', async () => {
    submissionStatusP.textContent = 'Submitting...';
    submissionStatusP.className = 'status-box pending';
    submissionStatusP.classList.remove('hidden');
    submitButton.disabled = true;
    reviewButton.disabled = true;

    // Ensure dates are sorted before submission if order matters in DB (though usually not for arrays)
    selectedSessions.sort();
    selectedBackups.sort();

    const scheduleData = {
        // The participant_id in the database is the link_id
        participant_id: participantInfo.link_id,
        session_dates: selectedSessions, // Array of YYYY-MM-DD strings
        backup_dates: selectedBackups, // Array of YYYY-MM-DD strings
        submission_timestamp: new Date().toISOString() // UTC timestamp
    };

    try {
        // The logic to check for existing submissions is now in getParticipantInfo.
        // We now use an UPDATE operation instead of INSERT.
        const { data, error } = await supabaseClient
            .from('schedules')
            .update({
                session_dates: scheduleData.session_dates,
                backup_dates: scheduleData.backup_dates,
                submission_timestamp: scheduleData.submission_timestamp
            })
            .eq('link_id', participantInfo.link_id)
            .select();

        if (error) {
            console.error('Error submitting schedule to Supabase:', error);
            let userMessage = "Submission failed. Please try again.";
            // Example: if you have a unique constraint on a combination of dates that gets violated
            if (error.message.includes("unique constraint")) {
                 userMessage = "Submission failed due to a data conflict. This might mean a date became unavailable. Please refresh and try again.";
                 await fetchBookedDates(); // Re-fetch latest availability
                 resetSelectionsAndRefreshCalendars();
            }
            showError(userMessage, submissionStatusP);
            submitButton.disabled = false;
            reviewButton.disabled = false;
        } else {
            console.log('Schedule submitted successfully to Supabase:', data);
            submissionStatusP.textContent = 'Schedule submitted successfully!';
            submissionStatusP.className = 'status-box success';
            disableAllDateButtons();
            generateAndDownloadPDF(scheduleData);
        }
    } catch (err) {
        console.error('Unexpected error during submission process:', err);
        showError('An unexpected error occurred during submission. Please try again.', submissionStatusP);
        submitButton.disabled = false;
        reviewButton.disabled = false;
    }
});

function resetSelectionsAndRefreshCalendars() {
    selectedSessions = [];
    selectedBackups = [];

    // Clear current calendar buttons
    session1CalendarDiv.innerHTML = '';
    followUpCalendarDiv.innerHTML = '';
    backupCalendarDiv.innerHTML = '';

    populateSession1Calendar(); // This will re-render with current allBookedDates
    followUpSection.classList.add('hidden');
    backupSection.classList.add('hidden');
    updateFollowUpCount();
    updateBackupCount();
    checkReviewButtonState();
    summarySection.classList.add('hidden');
}

function disableAllDateButtons() {
    document.querySelectorAll('.date-button').forEach(button => {
        button.disabled = true;
    });
}

// --- PDF Generation (jsPDF) ---
function generateAndDownloadPDF(scheduleData) {
    pdfStatusP.textContent = 'Generating PDF...';
    pdfStatusP.className = 'status-box pending';
    pdfStatusP.classList.remove('hidden');

    try {
        const { jsPDF } = window.jspdf;
        if (!jsPDF) {
            throw new Error("jsPDF library not found.");
        }
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text("Experiment Schedule Summary", 14, 22);
        doc.setFontSize(12);
        doc.text(`Participant ID: ${participantInfo.link_id}`, 14, 32);

        let yPos = 45;
        doc.setFontSize(11);
        
        doc.text(`Experiment Sessions (${scheduleData.session_dates.length}):`, 14, yPos);
        yPos += 6;
        scheduleData.session_dates.forEach((date, index) => {
            if (yPos > 270) { doc.addPage(); yPos = 20; }
            const prefix = index === 0 ? "First" : `Session ${index + 1}`;
            doc.text(`  - ${prefix}: ${formatDateForDisplay(date)}`, 20, yPos);
            yPos += 6;
        });

        yPos += 4;
        doc.text(`Backup Sessions (${scheduleData.backup_dates.length}):`, 14, yPos);
        yPos += 6;
        scheduleData.backup_dates.forEach((date, index) => {
            if (yPos > 270) { doc.addPage(); yPos = 20; }
            doc.text(`  - Backup ${index + 1}: ${formatDateForDisplay(date)}`, 20, yPos);
            yPos += 6;
        });

        yPos = Math.max(yPos, 250); // Ensure it's near bottom or on new page
        if (yPos > 270) { doc.addPage(); yPos = 20;}
        doc.text("Please keep this PDF for your records.", 14, yPos);
        doc.text("Contact the experimenters if you have any questions or need to make changes.", 14, yPos + 6);

        doc.save(`Experiment_Schedule_${scheduleData.participant_id}.pdf`);
        pdfStatusP.textContent = 'PDF downloaded successfully!';
        pdfStatusP.className = 'status-box success';
    } catch (error) {
        console.error("PDF Generation Error:", error);
        pdfStatusP.textContent = `PDF generation failed: ${error.message}`;
        pdfStatusP.className = 'status-box error';
    }
}

// --- Utility Functions ---
function normalizeDateToYYYYMMDD(dateInput) {
    // Input can be a Date object or a string (YYYY-MM-DD or ISO with time)
    if (!dateInput) return null;
    try {
        const d = (typeof dateInput === 'string') ? new Date(dateInput.split('T')[0] + 'T00:00:00Z') : new Date(dateInput.valueOf());
        // Ensure we use UTC methods to avoid timezone shifts when creating the YYYY-MM-DD string
        const year = d.getUTCFullYear();
        const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
        const day = d.getUTCDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) {
        console.warn("Could not normalize date:", dateInput, e);
        return typeof dateInput === 'string' ? dateInput.split('T')[0] : null; // Fallback
    }
}


function formatDateForDisplay(dateStringYYYYMMDD) {
    if (!dateStringYYYYMMDD) return 'N/A';
    // Parse YYYY-MM-DD as local time for display purposes.
    // Appending T00:00:00 tells JS to parse it in the local timezone.
    const date = new Date(dateStringYYYYMMDD + 'T00:00:00');
    return date.toLocaleDateString(undefined, {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
}

function showError(message, element = errorMessagesDiv) {
    element.textContent = message;
    element.classList.remove('hidden');
    if (element === errorMessagesDiv) {
        element.className = 'error-box';
    } else {
        element.className = 'status-box error';
    }
}

function clearError(element = errorMessagesDiv) {
    element.classList.add('hidden');
    element.textContent = '';
}
// --- End of script.js ---
