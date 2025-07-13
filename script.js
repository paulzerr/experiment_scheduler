// script.js - Participant Scheduler for Supabase (Refactored)

// --- Supabase Configuration ---
let supabaseClient;
if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
} else {
    console.error("Supabase SDK not loaded. Make sure the Supabase JS SDK script is included before this script.");
}

// --- DOM Elements ---
const elements = {
    participantInfo: document.getElementById('participantInfo'),
    errorMessages: document.getElementById('errorMessages'),
    loadingStatus: document.getElementById('loadingStatus'),
    schedulerContent: document.getElementById('schedulerContent'),
    session1Calendar: document.getElementById('session1Calendar'),
    timeslotSection: document.getElementById('timeslotSection'),
    timeslotButtons: document.getElementById('timeslotButtons'),
    selectedDateDisplay: document.getElementById('selectedDateDisplay'),
    followUpSection: document.getElementById('followUpSection'),
    followUpCalendar: document.getElementById('followUpCalendar'),
    followUpCount: document.getElementById('followUpCount'),
    backupSection: document.getElementById('backupSection'),
    backupCalendar: document.getElementById('backupCalendar'),
    backupCount: document.getElementById('backupCount'),
    reviewButton: document.getElementById('reviewButton'),
    summarySection: document.getElementById('summarySection'),
    logOutput: document.getElementById('logOutput'),
    submitButton: document.getElementById('submitButton'),
    submissionStatus: document.getElementById('submissionStatus'),
    pdfStatus: document.getElementById('pdfStatus')
};

// --- State Variables ---
let participantInfo = null;
let sessionManager = new SessionManager(SCHEDULER_CONFIG);

// --- Initialization ---
document.addEventListener('DOMContentLoaded', initializeScheduler);

async function initializeScheduler() {
    showLoading('Loading availability...');
    try {
        participantInfo = await getParticipantInfo();
        elements.participantInfo.textContent = `Participant ID: ${participantInfo.participant_id}`;
        elements.participantInfo.classList.remove('hidden');

        await populateSession1Calendar();
        
        hideLoading();
        elements.schedulerContent.classList.remove('hidden');
    } catch (error) {
        console.error("Error initializing scheduler:", error);
        showError(error.message || "Failed to load availability. Please try refreshing the page.");
        hideLoading();
    }
}

async function getParticipantInfo() {
    const linkId = new URLSearchParams(window.location.search).get('uid');
    if (!linkId) throw new Error("Participant link ID not found in URL. Please use the link provided.");

    const { data, error } = await supabaseClient
        .from('schedules')
        .select('id, link_id, participant_id, schedule_from, submission_timestamp, session_dates')
        .eq('link_id', linkId)
        .maybeSingle();

    if (error) throw new Error('Could not verify participant information.');
    if (!data) throw new Error('This participation link is not valid.');
    if (data.session_dates) throw new Error('You have already submitted your schedule.');

    // Convert schedule_from to a Date object
    const scheduleFromDate = data.schedule_from ? DateManager.toUTCDate(data.schedule_from) : null;
    return { ...data, schedule_from: scheduleFromDate };
}

async function fetchAndUpdateAvailability() {
    const { data, error } = await supabaseClient
        .from('schedules')
        .select('session_dates, backup_dates, instruction_timeslot');

    if (error) throw new Error('Could not fetch schedule data.');

    const dateCountMap = new Map();
    const takenDateTimeSlots = new Set();

    data?.forEach(schedule => {
        const allDates = (schedule.session_dates || []).concat(schedule.backup_dates || []);
        
        allDates.forEach(dateStr => {
            if (!dateStr) return;
            const dateKey = DateManager.toYYYYMMDD(DateManager.toUTCDate(dateStr));
            if (dateKey) {
                const count = (dateCountMap.get(dateKey) || 0) + 1;
                dateCountMap.set(dateKey, count);
            }
        });

        if (schedule.instruction_timeslot && schedule.session_dates?.[0]) {
            const firstSessionDateKey = DateManager.toYYYYMMDD(DateManager.toUTCDate(schedule.session_dates[0]));
            if (firstSessionDateKey) {
                const normalizedTime = schedule.instruction_timeslot.substring(0, 5);
                takenDateTimeSlots.add(`${firstSessionDateKey}_${normalizedTime}`);
            }
        }
    });

    sessionManager.updateAvailability(dateCountMap, takenDateTimeSlots);
    return dateCountMap;
}

// --- Calendar Population ---
async function populateSession1Calendar() {
    elements.session1Calendar.innerHTML = '';
    
    const searchStartDate = participantInfo.schedule_from
        ? DateManager.toUTCDate(participantInfo.schedule_from)
        : DateManager.getNextWorkDay(new Date());

    if (!searchStartDate) {
        throw new Error("Could not determine a valid start date for the search.");
    }

    // We need the dateCountMap to find a valid start date
    const dateCountMap = await fetchAndUpdateAvailability();

    const experimentStartDate = DateManager.findExperimentStartDate(
        searchStartDate,
        dateCountMap,
        SCHEDULER_CONFIG
    );

    if (experimentStartDate) {
        const availableDates = [];
        let currentDate = new Date(experimentStartDate);
        
        // Find the next 7 valid, available weekdays starting from the found date
        while (availableDates.length < SCHEDULER_CONFIG.SESSION1_WINDOW_DAYS && availableDates.length < 14) {
            if (sessionManager.isDateAvailableForInstruction(currentDate)) {
                availableDates.push(new Date(currentDate));
            }
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }
        
        availableDates.forEach(date => {
            createDateButton(date, elements.session1Calendar, 'session1');
        });

    } else {
        throw new Error('No suitable block of dates could be found for the experiment. Please contact the administrator.');
    }
}

function populateTimeslotButtons() {
    elements.timeslotButtons.innerHTML = '';
    
    const selectedDate = sessionManager.selectedSessions[0] || null;

    SCHEDULER_CONFIG.TIME_SLOTS.forEach(timeSlot => {
        if (sessionManager.isTimeslotAvailable(timeSlot, selectedDate)) {
            const button = document.createElement('button');
            button.classList.add('timeslot-button');
            button.textContent = timeSlot;
            button.onclick = () => handleTimeslotSelection(timeSlot, button);
            elements.timeslotButtons.appendChild(button);
        }
    });

    if (selectedDate) {
        elements.selectedDateDisplay.textContent = DateManager.formatForDisplay(selectedDate);
    }
    
    elements.timeslotSection.classList.remove('hidden');
}

function populateFollowUpCalendar() {
    elements.followUpCalendar.innerHTML = '';
    updateFollowUpCount();

    if (sessionManager.selectedSessions.length === 0) return;

    const firstSessionDate = sessionManager.selectedSessions[0];
    const dates = DateManager.generateFollowUpDates(
        firstSessionDate,
        SCHEDULER_CONFIG.FOLLOW_UP_WINDOW_DAYS
    );

    dates.forEach(date => {
        // Don't show the first session date in the follow-up choices
        if (date.getTime() !== firstSessionDate.getTime()) {
            createDateButton(date, elements.followUpCalendar, 'followUp');
        }
    });
    
    elements.followUpSection.classList.remove('hidden');
    updateFollowUpSectionTitle();
}

function populateBackupCalendar() {
    elements.backupCalendar.innerHTML = '';
    sessionManager.selectedBackups = [];
    updateBackupCount();

    if (sessionManager.selectedSessions.length < SCHEDULER_CONFIG.TOTAL_SESSIONS) return;

    const dates = DateManager.generateBackupDates(sessionManager.selectedSessions, SCHEDULER_CONFIG.BACKUP_WINDOW_DAYS);
    
    dates.forEach(date => {
        createDateButton(date, elements.backupCalendar, 'backup');
    });
    
    elements.backupSection.classList.remove('hidden');
}

// --- Date Button Creation and Handling ---
function createDateButton(date, container, type) {
    const button = document.createElement('button');
    button.classList.add('date-button');
    // Store the date in a standard, recoverable format
    button.dataset.date = date.toISOString();

    const weekday = date.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' });
    const dayMonth = date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
    button.innerHTML = `${dayMonth}<span class="weekday">${weekday}</span>`;

    const isAvailable = sessionManager.isDateAvailable(date);
    const isSelected = sessionManager.isDateSelectedInSessions(date) || sessionManager.isDateSelectedInBackups(date);

    if (!isAvailable) {
        button.disabled = true;
        button.title = "Date unavailable (maximum concurrent sessions reached)";
    } else {
        button.onclick = () => handleDateSelection(date, type, button);
    }
    
    if (isSelected) {
        button.classList.toggle('selected', isSelected);
    }
    
    container.appendChild(button);
}

function handleDateSelection(date, type, button) {
    clearError();
    let result;

    switch (type) {
        case 'session1':
            result = sessionManager.selectFirstSession(date);
            elements.session1Calendar.querySelectorAll('.date-button').forEach(btn => btn.classList.remove('selected'));
            if (!result.deselected) {
                button.classList.add('selected');
            }
            if (result.reset) {
                resetSubsequentSteps();
                if (!result.deselected) {
                    populateTimeslotButtons();
                }
            }
            break;

        case 'followUp':
            result = sessionManager.selectFollowUpSession(date);
            if (result.success) {
                button.classList.toggle('selected', !result.deselected);
                updateFollowUpCount();
                updateFollowUpSectionTitle();

                if (sessionManager.selectedSessions.length === SCHEDULER_CONFIG.TOTAL_SESSIONS) {
                    populateBackupCalendar();
                } else {
                    // Hide if we drop below the required number
                    elements.backupSection.classList.add('hidden');
                    sessionManager.selectedBackups = [];
                    updateBackupCount();
                }
            } else {
                showError(result.error);
            }
            break;

        case 'backup':
            result = sessionManager.selectBackupSession(date);
             if (result.success) {
                button.classList.toggle('selected', !result.deselected);
                updateBackupCount();
            } else {
                showError(result.error);
            }
            break;
    }

    checkReviewButtonState();
}

function handleTimeslotSelection(timeSlot, button) {
    clearError();
    elements.timeslotButtons.querySelectorAll('.timeslot-button').forEach(btn => btn.classList.remove('selected'));
    button.classList.add('selected');
    sessionManager.setTimeslot(timeSlot);
    populateFollowUpCalendar();
}

// --- UI Updates ---
function updateFollowUpCount() {
    elements.followUpCount.textContent = sessionManager.getFollowUpCount();
}

function updateBackupCount() {
    elements.backupCount.textContent = sessionManager.selectedBackups.length;
}

function updateFollowUpSectionTitle() {
    // This function can be simplified since we now use updateFollowUpCount() for the counter
    // The title stays static and the count is updated via the span element
}

function checkReviewButtonState() {
    elements.reviewButton.disabled = !sessionManager.isReadyForReview();
    if (elements.reviewButton.disabled) {
        elements.summarySection.classList.add('hidden');
    }
}

function resetSubsequentSteps() {
    elements.timeslotSection.classList.add('hidden');
    elements.followUpSection.classList.add('hidden');
    elements.backupSection.classList.add('hidden');
    updateFollowUpCount();
    updateBackupCount();
}

// --- Review and Submission ---
elements.reviewButton.addEventListener('click', () => {
    const data = sessionManager.getSubmissionData();
    
    elements.logOutput.textContent = `Participant ID: ${participantInfo.participant_id}\n\n` +
        `Instruction Session Time Slot: ${data.instruction_timeslot}\n\n` +
        `Experiment Sessions (${data.session_dates.length}):\n` +
        data.session_dates.map((dateStr, index) => {
            const date = DateManager.toUTCDate(dateStr);
            const prefix = index === 0 ? `First (Instruction at ${data.instruction_timeslot})` : `Session ${index + 1}`;
            return `  - ${prefix}: ${DateManager.formatForDisplay(date)}`;
        }).join('\n') + `\n\n` +
        `Backup Sessions (${data.backup_dates.length}):\n` +
        data.backup_dates.map(dateStr => {
            const date = DateManager.toUTCDate(dateStr);
            return `  - ${DateManager.formatForDisplay(date)}`;
        }).join('\n');
    
    elements.summarySection.classList.remove('hidden');
    elements.submitButton.disabled = false;
    elements.submissionStatus.classList.add('hidden');
    elements.pdfStatus.classList.add('hidden');
});

elements.submitButton.addEventListener('click', async () => {
    setSubmissionStatus('Submitting...', 'pending');
    elements.submitButton.disabled = true;
    elements.reviewButton.disabled = true;

    const submissionData = {
        ...sessionManager.getSubmissionData(),
        submission_timestamp: new Date().toISOString()
    };

    try {
        const { error } = await supabaseClient
            .from('schedules')
            .update(submissionData)
            .eq('link_id', participantInfo.link_id);

        if (error) throw error;

        setSubmissionStatus('Schedule submitted successfully!', 'success');
        disableAllDateButtons();
        disableAllTimeslotButtons();
        generateAndDownloadPDF({
            ...submissionData,
            participant_id: participantInfo.link_id
        }, participantInfo.participant_id);
    } catch (err) {
        console.error('Submission error:', err);
        setSubmissionStatus('Submission failed. Please try again.', 'error');
        elements.submitButton.disabled = false;
        elements.reviewButton.disabled = false;
    }
});

// --- Utility Functions ---
function showLoading(message) {
    elements.loadingStatus.textContent = message;
    elements.loadingStatus.classList.remove('hidden');
    elements.schedulerContent.classList.add('hidden');
}

function hideLoading() {
    elements.loadingStatus.classList.add('hidden');
}

function showError(message, element = elements.errorMessages) {
    element.textContent = message;
    element.classList.remove('hidden');
}

function clearError(element = elements.errorMessages) {
    element.classList.add('hidden');
    element.textContent = '';
}

function setSubmissionStatus(message, type) {
    const element = elements.submissionStatus;
    element.textContent = message;
    element.className = `status-box ${type}`;
    element.classList.remove('hidden');
}

function disableAllDateButtons() {
    document.querySelectorAll('.date-button').forEach(button => button.disabled = true);
}

function disableAllTimeslotButtons() {
    document.querySelectorAll('.timeslot-button').forEach(button => button.disabled = true);
}
