// script.js - Participant Scheduler for Supabase (Refactored)

const EXCESSIVE_LOG_MARKER_SCRIPT = '[EXCESSIVE_TRACE]';
function excessiveLogScript(message, payload) {
    if (payload === undefined) {
        console.log(EXCESSIVE_LOG_MARKER_SCRIPT, message);
    } else {
        console.log(EXCESSIVE_LOG_MARKER_SCRIPT, message, payload);
    }
}

function serializeScriptDate(date) {
    if (!date) return null;
    if (!(date instanceof Date)) return { nonDateValue: date };
    return {
        iso: isNaN(date.getTime()) ? 'Invalid Date' : date.toISOString(),
        time: date.getTime()
    };
}

function serializeScriptDateArray(dates) {
    if (!Array.isArray(dates)) return dates;
    return dates.map(d => serializeScriptDate(d));
}

// --- Supabase Configuration ---
let supabaseClient;
if (window.supabase) {
    excessiveLogScript('Supabase SDK detected on window. Creating client', {
        url: SUPABASE_CONFIG.URL
    });
    supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
    excessiveLogScript('Supabase client created successfully');
} else {
    excessiveLogScript('Supabase SDK missing on window. Scheduler cannot initialize API client');
    console.error("Supabase SDK not loaded. Make sure the Supabase JS SDK script is included before this script.");
}

// --- DOM Elements ---
excessiveLogScript('Resolving DOM elements by ID');
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
    reviewButton: document.getElementById('reviewButton'),
    summarySection: document.getElementById('summarySection'),
    logOutput: document.getElementById('logOutput'),
    submitButton: document.getElementById('submitButton'),
    submissionStatus: document.getElementById('submissionStatus'),
    pdfStatus: document.getElementById('pdfStatus'),
    downloadPdfButton: document.getElementById('downloadPdfButton')
};
excessiveLogScript('DOM element resolution completed', Object.fromEntries(
    Object.entries(elements).map(([key, value]) => [key, Boolean(value)])
));

// --- State Variables ---
let participantInfo = null;
let sessionManager = new SessionManager(SCHEDULER_CONFIG);
let availabilityInterval = null; // To hold the interval ID
excessiveLogScript('Initial runtime state created', {
    participantInfo,
    availabilityInterval,
    schedulerConfig: SCHEDULER_CONFIG
});

// --- Initialization ---
excessiveLogScript('Registering DOMContentLoaded listener for initializeScheduler');
document.addEventListener('DOMContentLoaded', initializeScheduler);

async function initializeScheduler() {
    excessiveLogScript('initializeScheduler started');
    showLoading('Loading availability...');
    try {
        excessiveLogScript('initializeScheduler requesting participant info from URL/Supabase');
        participantInfo = await getParticipantInfo();
        excessiveLogScript('initializeScheduler received participant info', participantInfo);
        elements.participantInfo.textContent = `Participant ID: ${participantInfo.participant_id}`;
        elements.participantInfo.classList.remove('hidden');
        excessiveLogScript('initializeScheduler updated participant info banner', {
            textContent: elements.participantInfo.textContent,
            classList: elements.participantInfo.className
        });

        excessiveLogScript('initializeScheduler populating first-session calendar');
        await populateSession1Calendar();
        excessiveLogScript('initializeScheduler first-session calendar populated');
        
        hideLoading();
        elements.schedulerContent.classList.remove('hidden');
        excessiveLogScript('initializeScheduler revealed scheduler content', {
            schedulerClassList: elements.schedulerContent.className
        });
        startAvailabilityPolling();
        excessiveLogScript('initializeScheduler completed successfully');
    } catch (error) {
        excessiveLogScript('initializeScheduler caught error', {
            message: error?.message,
            stack: error?.stack
        });
        console.error("Error initializing scheduler:", error);
        showError(error.message || "Failed to load availability. Please try refreshing the page.");
        hideLoading();
    }
}

async function getParticipantInfo() {
    excessiveLogScript('getParticipantInfo called', {
        locationSearch: window.location.search
    });
    const linkId = new URLSearchParams(window.location.search).get('uid');
    excessiveLogScript('getParticipantInfo extracted uid query parameter', { linkId });
    if (!linkId) {
        excessiveLogScript('getParticipantInfo throwing because uid is missing from URL');
        throw new Error("Participant link ID not found in URL. Please use the link provided.");
    }

    excessiveLogScript('getParticipantInfo querying schedules table for link_id', { linkId });
    const { data, error } = await supabaseClient
        .from('schedules')
        .select('id, link_id, participant_id, schedule_from, submission_timestamp, session_dates')
        .eq('link_id', linkId)
        .maybeSingle();
    excessiveLogScript('getParticipantInfo received Supabase response', { data, error });

    if (error) {
        excessiveLogScript('getParticipantInfo throwing due to Supabase error', { error });
        throw new Error('Could not verify participant information.');
    }
    if (!data) {
        excessiveLogScript('getParticipantInfo throwing because no matching schedule row was returned', { linkId });
        throw new Error('This participation link is not valid.');
    }
    if (data.session_dates) {
        excessiveLogScript('getParticipantInfo throwing because participant already submitted schedule', {
            session_dates: data.session_dates
        });
        throw new Error('You have already submitted your schedule.');
    }

    // Convert schedule_from to a Date object
    const scheduleFromDate = data.schedule_from ? DateManager.toUTCDate(data.schedule_from) : null;
    excessiveLogScript('getParticipantInfo normalized schedule_from', {
        schedule_from_original: data.schedule_from,
        schedule_from_normalized: serializeScriptDate(scheduleFromDate)
    });
    const participant = { ...data, schedule_from: scheduleFromDate };
    excessiveLogScript('getParticipantInfo returning participant object', participant);
    return participant;
}

async function fetchAndUpdateAvailability() {
    excessiveLogScript('fetchAndUpdateAvailability started');
    const { data, error } = await supabaseClient
        .from('schedules')
        .select('session_dates, backup_dates, instruction_timeslot, has_equipment_days');
    excessiveLogScript('fetchAndUpdateAvailability received Supabase response', {
        rowCount: data?.length || 0,
        error,
        data
    });

    if (error) {
        excessiveLogScript('fetchAndUpdateAvailability throwing due to Supabase error', { error });
        throw new Error('Could not fetch schedule data.');
    }

    const dateCountMap = new Map();
    const takenDateTimeSlots = new Map();
    excessiveLogScript('fetchAndUpdateAvailability initialized aggregation maps');

    data?.forEach((schedule, scheduleIndex) => {
        excessiveLogScript('fetchAndUpdateAvailability processing schedule row', {
            scheduleIndex,
            schedule
        });
        const allDates = schedule.has_equipment_days || (schedule.session_dates || []).concat(schedule.backup_dates || []);
        const uniqueDateKeysForSchedule = new Set();
        excessiveLogScript('fetchAndUpdateAvailability resolved occupancy date source for schedule', {
            scheduleIndex,
            source: schedule.has_equipment_days ? 'has_equipment_days' : 'session_dates_plus_backup_dates',
            allDates
        });
        
        allDates.forEach((dateStr, dateIndex) => {
            excessiveLogScript('fetchAndUpdateAvailability processing occupancy date string', {
                scheduleIndex,
                dateIndex,
                dateStr
            });
            if (!dateStr) {
                excessiveLogScript('fetchAndUpdateAvailability skipping falsy date string', {
                    scheduleIndex,
                    dateIndex
                });
                return;
            }
            const dateKey = DateManager.toYYYYMMDD(DateManager.toUTCDate(dateStr));
            if (dateKey) {
                if (uniqueDateKeysForSchedule.has(dateKey)) {
                    excessiveLogScript('fetchAndUpdateAvailability skipped duplicate occupancy date for schedule', {
                        scheduleIndex,
                        dateKey
                    });
                    return;
                }
                uniqueDateKeysForSchedule.add(dateKey);
                const count = (dateCountMap.get(dateKey) || 0) + 1;
                dateCountMap.set(dateKey, count);
                excessiveLogScript('fetchAndUpdateAvailability incremented dateCountMap entry', {
                    dateKey,
                    count
                });
            } else {
                excessiveLogScript('fetchAndUpdateAvailability skipped date string because normalization failed', {
                    scheduleIndex,
                    dateIndex,
                    dateStr
                });
            }
        });

        if (schedule.instruction_timeslot && schedule.session_dates?.[0]) {
            const firstSessionDateKey = DateManager.toYYYYMMDD(DateManager.toUTCDate(schedule.session_dates[0]));
            if (firstSessionDateKey) {
                const normalizedTime = schedule.instruction_timeslot.substring(0, 5);
                const key = `${firstSessionDateKey}_${normalizedTime}`;
                takenDateTimeSlots.set(key, (takenDateTimeSlots.get(key) || 0) + 1);
                excessiveLogScript('fetchAndUpdateAvailability incremented takenDateTimeSlots entry', {
                    firstSessionDateKey,
                    normalizedTime,
                    key,
                    count: takenDateTimeSlots.get(key)
                });
            } else {
                excessiveLogScript('fetchAndUpdateAvailability skipped timeslot aggregation due to invalid firstSessionDateKey', {
                    scheduleIndex,
                    firstSessionValue: schedule.session_dates?.[0]
                });
            }
        } else {
            excessiveLogScript('fetchAndUpdateAvailability skipped timeslot aggregation for schedule', {
                scheduleIndex,
                hasInstructionTimeslot: Boolean(schedule.instruction_timeslot),
                hasFirstSession: Boolean(schedule.session_dates?.[0])
            });
        }
    });

    excessiveLogScript('fetchAndUpdateAvailability completed aggregation', {
        dateCountMapSize: dateCountMap.size,
        dateCountEntries: Array.from(dateCountMap.entries()),
        takenDateTimeSlotsSize: takenDateTimeSlots.size,
        takenDateTimeSlotsEntries: Array.from(takenDateTimeSlots.entries())
    });
    sessionManager.updateAvailability(dateCountMap, takenDateTimeSlots);
    excessiveLogScript('fetchAndUpdateAvailability pushed availability maps into sessionManager');
    excessiveLogScript('fetchAndUpdateAvailability returning dateCountMap', {
        size: dateCountMap.size
    });
    return dateCountMap;
}

// --- Calendar Population ---
async function populateSession1Calendar() {
    excessiveLogScript('populateSession1Calendar started', {
        participantInfo
    });
    elements.session1Calendar.innerHTML = '';
    excessiveLogScript('populateSession1Calendar cleared session1Calendar container');
    
    const participantScheduleFromDate = participantInfo.schedule_from
        ? DateManager.toUTCDate(participantInfo.schedule_from)
        : null;
    const nextWorkDayFromNow = DateManager.toUTCDate(DateManager.getNextWorkDay(new Date()));
    const searchStartDate = participantScheduleFromDate && participantScheduleFromDate.getTime() > nextWorkDayFromNow.getTime()
        ? participantScheduleFromDate
        : nextWorkDayFromNow;
    excessiveLogScript('populateSession1Calendar resolved effective searchStartDate', {
        participantScheduleFromDate: serializeScriptDate(participantScheduleFromDate),
        nextWorkDayFromNow: serializeScriptDate(nextWorkDayFromNow),
        searchStartDate: serializeScriptDate(searchStartDate),
        usedParticipantScheduleFrom: Boolean(
            participantScheduleFromDate &&
            nextWorkDayFromNow &&
            participantScheduleFromDate.getTime() > nextWorkDayFromNow.getTime()
        )
    });

    if (!searchStartDate) {
        excessiveLogScript('populateSession1Calendar throwing because searchStartDate is invalid');
        throw new Error("Could not determine a valid start date for the search.");
    }

    // We need the dateCountMap to find a valid start date
    excessiveLogScript('populateSession1Calendar fetching latest availability before start-date search');
    const dateCountMap = await fetchAndUpdateAvailability();
    excessiveLogScript('populateSession1Calendar received dateCountMap', {
        size: dateCountMap.size
    });

    const experimentStartDate = DateManager.findExperimentStartDate(
        searchStartDate,
        dateCountMap,
        SCHEDULER_CONFIG
    );
    excessiveLogScript('populateSession1Calendar computed experimentStartDate', {
        experimentStartDate: serializeScriptDate(experimentStartDate)
    });

    if (experimentStartDate) {
        const availableDates = [];
        let currentDate = new Date(experimentStartDate);
        excessiveLogScript('populateSession1Calendar beginning instruction date collection loop', {
            loopStartDate: serializeScriptDate(currentDate),
            session1WindowDays: SCHEDULER_CONFIG.SESSION1_WINDOW_DAYS
        });
        
        // Find the next valid instruction dates that each also satisfy a full capacity window.
        while (availableDates.length < SCHEDULER_CONFIG.SESSION1_WINDOW_DAYS && availableDates.length < 14) {
            const cursorSnapshot = new Date(currentDate);
            const canUseDateForInstruction = sessionManager.isDateAvailableForInstruction(currentDate);
            const hasConsecutiveWindow = DateManager.hasConsecutiveCapacityWindow(
                currentDate,
                dateCountMap,
                SCHEDULER_CONFIG
            );
            const canUseDate = canUseDateForInstruction && hasConsecutiveWindow;
            excessiveLogScript('populateSession1Calendar evaluated candidate date', {
                candidate: serializeScriptDate(cursorSnapshot),
                canUseDateForInstruction,
                hasConsecutiveWindow,
                canUseDate,
                collectedCount: availableDates.length
            });
            if (canUseDate) {
                availableDates.push(new Date(currentDate));
                excessiveLogScript('populateSession1Calendar added date to availableDates', {
                    addedDate: serializeScriptDate(currentDate),
                    newCount: availableDates.length
                });
            }
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
            excessiveLogScript('populateSession1Calendar advanced candidate cursor', {
                nextCandidate: serializeScriptDate(currentDate)
            });
        }
        
        excessiveLogScript('populateSession1Calendar finished collecting dates', {
            count: availableDates.length,
            availableDates: serializeScriptDateArray(availableDates)
        });
        availableDates.forEach((date, index) => {
            excessiveLogScript('populateSession1Calendar rendering date button', {
                index,
                date: serializeScriptDate(date)
            });
            createDateButton(date, elements.session1Calendar, 'session1');
        });
        excessiveLogScript('populateSession1Calendar rendered all session1 buttons', {
            renderedCount: availableDates.length
        });

    } else {
        excessiveLogScript('populateSession1Calendar throwing because no valid experimentStartDate found');
        throw new Error('No suitable block of dates could be found for the experiment. Please contact the administrator.');
    }
}

function populateTimeslotButtons() {
    excessiveLogScript('populateTimeslotButtons started');
    elements.timeslotButtons.innerHTML = '';
    excessiveLogScript('populateTimeslotButtons cleared timeslot button container');
    
    const selectedDate = sessionManager.selectedSessions[0] || null;
    excessiveLogScript('populateTimeslotButtons resolved selectedDate', {
        selectedDate: serializeScriptDate(selectedDate)
    });

    const availableTimeSlots = sessionManager.getAvailableTimeSlots(selectedDate);
    excessiveLogScript('populateTimeslotButtons received available time slots', {
        availableTimeSlots
    });

    availableTimeSlots.forEach((timeSlot, index) => {
        excessiveLogScript('populateTimeslotButtons rendering timeslot button', {
            index,
            timeSlot
        });
        const button = document.createElement('button');
        button.classList.add('timeslot-button');
        button.textContent = timeSlot;
        button.onclick = () => handleTimeslotSelection(timeSlot, button);
        elements.timeslotButtons.appendChild(button);
        excessiveLogScript('populateTimeslotButtons appended timeslot button', {
            index,
            timeSlot
        });
    });

    if (selectedDate) {
        elements.selectedDateDisplay.textContent = DateManager.formatForDisplay(selectedDate);
        excessiveLogScript('populateTimeslotButtons updated selectedDateDisplay', {
            selectedDateDisplay: elements.selectedDateDisplay.textContent
        });
    } else {
        excessiveLogScript('populateTimeslotButtons selectedDate missing; selectedDateDisplay unchanged');
    }
    
    elements.timeslotSection.classList.remove('hidden');
    excessiveLogScript('populateTimeslotButtons showed timeslotSection', {
        classList: elements.timeslotSection.className
    });
}

function populateFollowUpCalendar() {
    excessiveLogScript('populateFollowUpCalendar started', {
        selectedSessions: serializeScriptDateArray(sessionManager.selectedSessions)
    });
    elements.followUpCalendar.innerHTML = '';
    excessiveLogScript('populateFollowUpCalendar cleared follow-up container');
    updateFollowUpCount();

    if (sessionManager.selectedSessions.length === 0) {
        excessiveLogScript('populateFollowUpCalendar exiting early because no first session selected');
        return;
    }

    const firstSessionDate = sessionManager.selectedSessions[0];
    excessiveLogScript('populateFollowUpCalendar resolved firstSessionDate', {
        firstSessionDate: serializeScriptDate(firstSessionDate)
    });
    const dates = DateManager.generateExperimentDates(
        firstSessionDate,
        SCHEDULER_CONFIG.EXPERIMENT_WINDOW_DAYS
    );
    excessiveLogScript('populateFollowUpCalendar generated candidate follow-up dates', {
        generatedCount: dates.length,
        dates: serializeScriptDateArray(dates)
    });

    dates.forEach((date, index) => {
        // Don't show the first session date in the follow-up choices
        if (date.getTime() !== firstSessionDate.getTime()) {
            excessiveLogScript('populateFollowUpCalendar rendering follow-up date button', {
                index,
                date: serializeScriptDate(date)
            });
            createDateButton(date, elements.followUpCalendar, 'followUp');
        } else {
            excessiveLogScript('populateFollowUpCalendar skipped date because it equals first session date', {
                index,
                date: serializeScriptDate(date)
            });
        }
    });
    
    elements.followUpSection.classList.remove('hidden');
    excessiveLogScript('populateFollowUpCalendar showed follow-up section', {
        classList: elements.followUpSection.className
    });
    updateFollowUpSectionTitle();
}

// --- Date Button Creation and Handling ---
function createDateButton(date, container, type) {
    excessiveLogScript('createDateButton called', {
        date: serializeScriptDate(date),
        containerId: container?.id,
        type
    });
    const button = document.createElement('button');
    button.classList.add('date-button');
    // Store the date in a standard, recoverable format
    button.dataset.date = date.toISOString();
    excessiveLogScript('createDateButton set date dataset attribute', { datasetDate: button.dataset.date });

    const weekday = date.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' });
    const dayMonth = date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
    button.innerHTML = `${dayMonth}<span class="weekday">${weekday}</span>`;
    excessiveLogScript('createDateButton built button label', {
        weekday,
        dayMonth,
        innerHTML: button.innerHTML
    });

    const isAvailable = sessionManager.isDateAvailable(date);
    const isSelected = sessionManager.isDateSelectedInSessions(date);
    excessiveLogScript('createDateButton evaluated availability/selection', {
        date: serializeScriptDate(date),
        isAvailable,
        isSelected
    });

    if (!isAvailable) {
        button.disabled = true;
        button.title = "Date unavailable (maximum concurrent sessions reached)";
        excessiveLogScript('createDateButton disabled button due to unavailable date', {
            title: button.title
        });
    } else {
        button.onclick = () => handleDateSelection(date, type, button);
        excessiveLogScript('createDateButton attached click handler for date button', { type });
    }
    
    if (isSelected) {
        button.classList.toggle('selected', isSelected);
        excessiveLogScript('createDateButton applied selected class to button');
    }
    
    container.appendChild(button);
    excessiveLogScript('createDateButton appended button to container', {
        containerId: container?.id,
        childCount: container?.children?.length
    });
}

function handleDateSelection(date, type, button) {
    excessiveLogScript('handleDateSelection called', {
        date: serializeScriptDate(date),
        type,
        buttonDatasetDate: button?.dataset?.date,
        buttonClasses: button?.className
    });
    clearError();
    let result;

    switch (type) {
        case 'session1':
            excessiveLogScript('handleDateSelection entering session1 branch');
            result = sessionManager.selectFirstSession(date);
            excessiveLogScript('handleDateSelection session1 result', { result });
            elements.session1Calendar.querySelectorAll('.date-button').forEach(btn => btn.classList.remove('selected'));
            excessiveLogScript('handleDateSelection cleared selected class on all session1 buttons');
            if (!result.deselected) {
                button.classList.add('selected');
                excessiveLogScript('handleDateSelection marked clicked session1 button as selected');
            }
            if (result.reset) {
                excessiveLogScript('handleDateSelection session1 result requested downstream reset', {
                    deselected: result.deselected
                });
                resetSubsequentSteps();
                if (!result.deselected) {
                    excessiveLogScript('handleDateSelection repopulating timeslot buttons after selecting session1 date');
                    populateTimeslotButtons();
                }
            }
            break;

        case 'followUp':
            excessiveLogScript('handleDateSelection entering followUp branch');
            result = sessionManager.selectFollowUpSession(date);
            excessiveLogScript('handleDateSelection followUp result', { result });
            if (result.success) {
                button.classList.toggle('selected', !result.deselected);
                excessiveLogScript('handleDateSelection toggled followUp button selected class', {
                    selectedAfterToggle: !result.deselected
                });
                updateFollowUpCount();
                updateFollowUpSectionTitle();
            } else {
                excessiveLogScript('handleDateSelection followUp selection failed; showing error', {
                    error: result.error
                });
                showError(result.error);
            }
            break;

        default:
            excessiveLogScript('handleDateSelection reached unexpected type branch', { type });
            break;
    }

    excessiveLogScript('handleDateSelection invoking review button state check');
    checkReviewButtonState();
    excessiveLogScript('handleDateSelection completed', {
        selectedSessions: serializeScriptDateArray(sessionManager.selectedSessions),
        selectedTimeslot: sessionManager.selectedTimeslot
    });
}

function handleTimeslotSelection(timeSlot, button) {
    excessiveLogScript('handleTimeslotSelection called', {
        timeSlot,
        buttonText: button?.textContent,
        selectedSessions: serializeScriptDateArray(sessionManager.selectedSessions)
    });
    clearError();
    elements.timeslotButtons.querySelectorAll('.timeslot-button').forEach(btn => btn.classList.remove('selected'));
    excessiveLogScript('handleTimeslotSelection cleared selected class from all timeslot buttons');
    button.classList.add('selected');
    excessiveLogScript('handleTimeslotSelection marked clicked timeslot button as selected', {
        selectedButtonClassList: button.className
    });
    sessionManager.setTimeslot(timeSlot);
    excessiveLogScript('handleTimeslotSelection set timeslot on sessionManager', {
        selectedTimeslot: sessionManager.selectedTimeslot
    });
    populateFollowUpCalendar();
    excessiveLogScript('handleTimeslotSelection populated follow-up calendar');
}

// --- UI Updates ---
function updateFollowUpCount() {
    const followUpCount = sessionManager.getFollowUpCount();
    elements.followUpCount.textContent = followUpCount;
    excessiveLogScript('updateFollowUpCount updated UI', {
        followUpCount,
        elementTextContent: elements.followUpCount.textContent
    });
}

function updateFollowUpSectionTitle() {
    // This function can be simplified since we now use updateFollowUpCount() for the counter
    // The title stays static and the count is updated via the span element
    excessiveLogScript('updateFollowUpSectionTitle called (no-op placeholder)');
}

function checkReviewButtonState() {
    excessiveLogScript('checkReviewButtonState called');
    elements.reviewButton.disabled = !sessionManager.isReadyForReview();
    excessiveLogScript('checkReviewButtonState updated review button disabled state', {
        disabled: elements.reviewButton.disabled
    });
    if (elements.reviewButton.disabled) {
        elements.summarySection.classList.add('hidden');
        excessiveLogScript('checkReviewButtonState hid summary section because review is disabled');
    }
}

function resetSubsequentSteps() {
    excessiveLogScript('resetSubsequentSteps called');
    elements.timeslotSection.classList.add('hidden');
    elements.followUpSection.classList.add('hidden');
    excessiveLogScript('resetSubsequentSteps hid downstream sections', {
        timeslotClassList: elements.timeslotSection.className,
        followUpClassList: elements.followUpSection.className
    });
    updateFollowUpCount();
    excessiveLogScript('resetSubsequentSteps refreshed counters after reset');
}

// --- Review and Submission ---
excessiveLogScript('Registering click listener for reviewButton');
elements.reviewButton.addEventListener('click', () => {
    excessiveLogScript('reviewButton click handler started', {
        selectedSessions: serializeScriptDateArray(sessionManager.selectedSessions),
        selectedTimeslot: sessionManager.selectedTimeslot
    });
    const data = sessionManager.getSubmissionData();
    excessiveLogScript('reviewButton click handler received submission data snapshot', data);
    
    elements.logOutput.textContent = `Participant ID: ${participantInfo.participant_id}\n\n` +
        `Instruction Session Time Slot: ${data.instruction_timeslot}\n\n` +
        `Experiment Nights (${data.session_dates.length}):\n` +
        data.session_dates.map((dateStr, index) => {
            const date = DateManager.toUTCDate(dateStr);
            const prefix = index === 0 ? `First (Instruction at ${data.instruction_timeslot})` : `Session ${index + 1}`;
            excessiveLogScript('reviewButton formatting experiment session line', {
                index,
                dateStr,
                prefix,
                normalizedDate: serializeScriptDate(date)
            });
            return `  - ${prefix}: ${DateManager.formatForDisplay(date)}`;
        }).join('\n');
    excessiveLogScript('reviewButton updated summary preformatted text', {
        logOutputLength: elements.logOutput.textContent.length
    });
    
    elements.summarySection.classList.remove('hidden');
    elements.submitButton.disabled = false;
    elements.submissionStatus.classList.add('hidden');
    elements.pdfStatus.classList.add('hidden');
    excessiveLogScript('reviewButton updated summary/submit status UI', {
        summarySectionClassList: elements.summarySection.className,
        submitButtonDisabled: elements.submitButton.disabled,
        submissionStatusClassList: elements.submissionStatus.className,
        pdfStatusClassList: elements.pdfStatus.className
    });
});

excessiveLogScript('Registering click listener for submitButton');
elements.submitButton.addEventListener('click', async () => {
    excessiveLogScript('submitButton click handler started');
    setSubmissionStatus('Submitting...', 'pending');
    elements.submitButton.disabled = true;
    elements.reviewButton.disabled = true;
    excessiveLogScript('submitButton click handler set pending state and disabled submit/review buttons', {
        submitButtonDisabled: elements.submitButton.disabled,
        reviewButtonDisabled: elements.reviewButton.disabled
    });

    try {
        // Re-fetch availability right before submission
        excessiveLogScript('submitButton click handler refreshing availability before validation');
        await fetchAndUpdateAvailability();
        excessiveLogScript('submitButton click handler refreshed availability');

        // Validate the current selection
        const validation = sessionManager.validateSelection();
        excessiveLogScript('submitButton click handler validation result', validation);
        if (!validation.isValid) {
            const errorMessage = "Our apologies, it appears that while you were filling in the dates, someone else already submitted their answers, and some of these dates are now no longer available. The page will now refresh and you will see the currently available dates.";
            excessiveLogScript('submitButton click handler validation failed; scheduling page reload', {
                errorMessage,
                conflicts: validation.conflicts
            });
            showError(errorMessage);
            setTimeout(() => window.location.reload(), 5000); // Refresh after 5 seconds
            return;
        }

        const selectionSnapshot = sessionManager.getSubmissionData();
        const allSelectedSessionDates = selectionSnapshot.session_dates || [];
        const sessionDatesForStorage = allSelectedSessionDates.slice(0, 15);
        const backupDatesForStorage = allSelectedSessionDates.slice(15);
        const submissionData = {
            ...selectionSnapshot,
            session_dates: sessionDatesForStorage,
            backup_dates: backupDatesForStorage,
            submission_timestamp: new Date().toISOString()
        };
        excessiveLogScript('submitButton click handler constructed submissionData', submissionData);
        excessiveLogScript('submitButton click handler split selected dates for storage', {
            allSelectedSessionDates,
            sessionDatesForStorage,
            backupDatesForStorage
        });

        excessiveLogScript('submitButton click handler updating schedules row in Supabase', {
            link_id: participantInfo.link_id
        });
        const { error } = await supabaseClient
            .from('schedules')
            .update(submissionData)
            .eq('link_id', participantInfo.link_id);
        excessiveLogScript('submitButton click handler received Supabase update response', { error });

        if (error) throw error;

        clearInterval(availabilityInterval); // Stop polling
        excessiveLogScript('submitButton click handler cleared availability polling interval', {
            availabilityInterval
        });
        setSubmissionStatus('Schedule submitted successfully!', 'success');
        disableAllDateButtons();
        disableAllTimeslotButtons();
        excessiveLogScript('submitButton click handler disabled all interactive selection controls');
        const pdfData = {
            ...submissionData,
            session_dates: allSelectedSessionDates
        };
        generateAndDownloadPDF({
            ...pdfData,
            participant_id: participantInfo.link_id
        }, participantInfo.participant_id);
        excessiveLogScript('submitButton click handler invoked PDF generation', {
            participantIdForFilename: participantInfo.participant_id
        });

        elements.downloadPdfButton.classList.remove('hidden');
        excessiveLogScript('submitButton click handler revealed download PDF button', {
            classList: elements.downloadPdfButton.className
        });
        elements.downloadPdfButton.addEventListener('click', () => {
            excessiveLogScript('downloadPdfButton click handler triggered re-download');
            generateAndDownloadPDF({
                ...pdfData,
                participant_id: participantInfo.link_id
            }, participantInfo.participant_id);
            excessiveLogScript('downloadPdfButton click handler invoked PDF generation');
        });
        excessiveLogScript('submitButton click handler completed success path');
    } catch (err) {
        excessiveLogScript('submitButton click handler caught error', {
            message: err?.message,
            stack: err?.stack
        });
        console.error('Submission error:', err);
        setSubmissionStatus('Submission failed. Please try again.', 'error');
        elements.submitButton.disabled = false;
        elements.reviewButton.disabled = false;
        excessiveLogScript('submitButton click handler restored submit/review buttons after failure', {
            submitButtonDisabled: elements.submitButton.disabled,
            reviewButtonDisabled: elements.reviewButton.disabled
        });
    }
});

// --- Real-time Availability ---
function startAvailabilityPolling() {
    excessiveLogScript('startAvailabilityPolling called; creating 10-second interval');
    // Poll every 10 seconds
    availabilityInterval = setInterval(async () => {
        excessiveLogScript('availability polling tick started');
        try {
            await fetchAndUpdateAvailability();
            excessiveLogScript('availability polling tick refreshed availability');
            updateCalendars();
            excessiveLogScript('availability polling tick updated visible calendars');
        } catch (error) {
            excessiveLogScript('availability polling tick caught error', {
                message: error?.message,
                stack: error?.stack
            });
            console.warn("Could not poll for availability:", error.message);
        }
    }, 10000);
    excessiveLogScript('startAvailabilityPolling interval registered', {
        availabilityInterval
    });
}

function updateCalendars() {
    excessiveLogScript('updateCalendars started');
    document.querySelectorAll('.date-button').forEach(button => {
        const date = DateManager.toUTCDate(button.dataset.date);
        excessiveLogScript('updateCalendars evaluating date button', {
            datasetDate: button.dataset.date,
            parsedDate: serializeScriptDate(date),
            isCurrentlySelected: button.classList.contains('selected')
        });
        if (!date) {
            excessiveLogScript('updateCalendars skipping date button because parsed date is invalid', {
                datasetDate: button.dataset.date
            });
            return;
        }

        const isAvailable = sessionManager.isDateAvailable(date);
        const isSelected = button.classList.contains('selected');
        excessiveLogScript('updateCalendars computed date button availability', {
            datasetDate: button.dataset.date,
            isAvailable,
            isSelected
        });

        // Only update if it's not selected by the user
        if (!isSelected) {
            button.disabled = !isAvailable;
            if (!isAvailable) {
                button.title = "Date unavailable (maximum concurrent sessions reached)";
                excessiveLogScript('updateCalendars disabled date button and set unavailable title', {
                    datasetDate: button.dataset.date
                });
            } else {
                button.title = "";
                excessiveLogScript('updateCalendars enabled date button and cleared title', {
                    datasetDate: button.dataset.date
                });
            }
        } else {
            excessiveLogScript('updateCalendars left selected date button untouched', {
                datasetDate: button.dataset.date
            });
        }
    });

    // Also update timeslot buttons if they are visible
    if (!elements.timeslotSection.classList.contains('hidden')) {
        excessiveLogScript('updateCalendars timeslot section is visible; updating timeslot buttons');
        const selectedDate = sessionManager.selectedSessions[0] || null;
        const availableTimeSlots = sessionManager.getAvailableTimeSlots(selectedDate);
        excessiveLogScript('updateCalendars computed current available timeslots', {
            selectedDate: serializeScriptDate(selectedDate),
            availableTimeSlots
        });
        
        elements.timeslotButtons.querySelectorAll('.timeslot-button').forEach(button => {
            const timeSlot = button.textContent;
            const isAvailable = availableTimeSlots.includes(timeSlot);
            const isSelected = button.classList.contains('selected');
            excessiveLogScript('updateCalendars evaluating timeslot button', {
                timeSlot,
                isAvailable,
                isSelected
            });

            if (!isSelected) {
                button.disabled = !isAvailable;
                if (!isAvailable) {
                    button.title = "Timeslot is no longer available";
                    excessiveLogScript('updateCalendars disabled timeslot button and set unavailable title', {
                        timeSlot
                    });
                } else {
                    button.title = "";
                    excessiveLogScript('updateCalendars enabled timeslot button and cleared title', {
                        timeSlot
                    });
                }
            } else {
                excessiveLogScript('updateCalendars left selected timeslot button untouched', { timeSlot });
            }
        });
    } else {
        excessiveLogScript('updateCalendars skipped timeslot updates because timeslot section is hidden');
    }
    excessiveLogScript('updateCalendars completed');
}

// --- Utility Functions ---
function showLoading(message) {
    excessiveLogScript('showLoading called', { message });
    elements.loadingStatus.textContent = message;
    elements.loadingStatus.classList.remove('hidden');
    elements.schedulerContent.classList.add('hidden');
    excessiveLogScript('showLoading updated UI state', {
        loadingStatusText: elements.loadingStatus.textContent,
        loadingStatusClassList: elements.loadingStatus.className,
        schedulerContentClassList: elements.schedulerContent.className
    });
}

function hideLoading() {
    excessiveLogScript('hideLoading called');
    elements.loadingStatus.classList.add('hidden');
    excessiveLogScript('hideLoading updated loading status visibility', {
        loadingStatusClassList: elements.loadingStatus.className
    });
}

function showError(message, element = elements.errorMessages) {
    excessiveLogScript('showError called', {
        message,
        elementId: element?.id
    });
    element.textContent = message;
    element.classList.remove('hidden');
    excessiveLogScript('showError updated error UI element', {
        textContent: element.textContent,
        classList: element.className
    });
}

function clearError(element = elements.errorMessages) {
    excessiveLogScript('clearError called', {
        elementId: element?.id,
        previousText: element?.textContent
    });
    element.classList.add('hidden');
    element.textContent = '';
    excessiveLogScript('clearError cleared error UI element', {
        textContent: element.textContent,
        classList: element.className
    });
}

function setSubmissionStatus(message, type) {
    excessiveLogScript('setSubmissionStatus called', { message, type });
    const element = elements.submissionStatus;
    element.textContent = message;
    element.className = `status-box ${type}`;
    element.classList.remove('hidden');
    excessiveLogScript('setSubmissionStatus updated submission status UI', {
        textContent: element.textContent,
        className: element.className
    });
}

function disableAllDateButtons() {
    excessiveLogScript('disableAllDateButtons called');
    document.querySelectorAll('.date-button').forEach((button, index) => {
        button.disabled = true;
        excessiveLogScript('disableAllDateButtons disabled date button', {
            index,
            datasetDate: button.dataset.date
        });
    });
    excessiveLogScript('disableAllDateButtons completed');
}

function disableAllTimeslotButtons() {
    excessiveLogScript('disableAllTimeslotButtons called');
    document.querySelectorAll('.timeslot-button').forEach((button, index) => {
        button.disabled = true;
        excessiveLogScript('disableAllTimeslotButtons disabled timeslot button', {
            index,
            timeSlot: button.textContent
        });
    });
    excessiveLogScript('disableAllTimeslotButtons completed');
}
