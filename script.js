document.addEventListener('DOMContentLoaded', () => {

    // --- jsPDF Check ---
    let jspdf;
    if (typeof window.jspdf === 'undefined') {
        showError("Critical Error: PDF generation library failed to load. Cannot generate summary PDF.");
        // No return here, allow core functionality but PDF will fail
    } else {
        jspdf = window.jspdf; // Assign to accessible variable
    }


    // --- Firebase Configuration ---
    // IMPORTANT: Replace these with your actual configuration values from Firebase!
    const firebaseConfig = {
        apiKey: "AIzaSyA2wAZ65IDnHC4GzQh1dR9BVkgp_5Ooz6E",
        authDomain: "scheduler-47c5c.firebaseapp.com",
        projectId: "scheduler-47c5c",
        storageBucket: "scheduler-47c5c.firebasestorage.app",
        messagingSenderId: "114842587009",
        appId: "1:114842587009:web:ec49cc7039f6a833746280",
        measurementId: "G-L8BPGHKVQJ"
    };

    // --- Initialize Firebase ---
    let db;
    try {
      if (!firebase.apps.length) {
          firebase.initializeApp(firebaseConfig);
      } else {
          firebase.app();
      }
      db = firebase.firestore();
      console.log("Firebase initialized successfully.");
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        showError("Critical Error: Could not connect to the database service. Please contact the experimenter.");
        // Hide scheduler content if Firebase fails critically
        const schedulerContentDiv = document.getElementById('schedulerContent');
        if (schedulerContentDiv) schedulerContentDiv.classList.add('hidden');
        return; // Stop execution
    }

    // --- General Configuration ---
    const SESSION1_LOOKAHEAD_DAYS = 14;
    const FOLLOWUP_DURATION_WEEKS = 3;
    const REQUIRED_FOLLOWUPS = 5;
    const REQUIRED_BACKUPS = 2;
    const BACKUP_WINDOW_DAYS = 7;
    const MAX_CONCURRENT_DEVICES = 15;
    const FIRESTORE_COLLECTION = "schedules";

    // --- DOM Elements ---
    const participantInfoDiv = document.getElementById('participantInfo');
    const errorMessagesDiv = document.getElementById('errorMessages');
    const loadingStatusDiv = document.getElementById('loadingStatus');
    const schedulerContentDiv = document.getElementById('schedulerContent');
    const session1CalendarDiv = document.getElementById('session1Calendar');
    const followUpSectionDiv = document.getElementById('followUpSection');
    const followUpCalendarDiv = document.getElementById('followUpCalendar');
    const followUpCountSpan = document.getElementById('followUpCount');
    const backupSectionDiv = document.getElementById('backupSection');
    const backupCalendarDiv = document.getElementById('backupCalendar');
    const backupCountSpan = document.getElementById('backupCount');
    const reviewButton = document.getElementById('reviewButton');
    const summarySectionDiv = document.getElementById('summarySection');
    const logOutputPre = document.getElementById('logOutput');
    const submitButton = document.getElementById('submitButton');
    const submissionStatusP = document.getElementById('submissionStatus');
    const pdfStatusP = document.getElementById('pdfStatus'); // PDF status element

    // --- State Variables ---
    let participantUid = null;
    let selectedSession1Date = null;
    let selectedFollowUpDates = [];
    let selectedBackupDates = [];
    let allSchedules = []; // Stores fetched schedules
    let firstAvailableStartDate = null; // Calculated start date

    // --- Utility Functions ---
    function formatDate(date) { // YYYY-MM-DD
        return date.getFullYear() + '-' +
               String(date.getMonth() + 1).padStart(2, '0') + '-' +
               String(date.getDate()).padStart(2, '0');
    }
    function parseDate(dateString) { // Expects YYYY-MM-DD, returns UTC Date
        if (!dateString || typeof dateString !== 'string') return null;
        const parts = dateString.split('-');
        if (parts.length !== 3) return null;
        const [year, month, day] = parts.map(Number);
        if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
        return new Date(Date.UTC(year, month - 1, day));
    }
    function addDays(date, days) {
        const result = new Date(date);
        result.setUTCDate(result.getUTCDate() + days);
        return result;
    }
    function displayDate(date) { // For buttons
        const optionsDate = { month: 'short', day: '2-digit' };
        const optionsWeekday = { weekday: 'short' };
        return `${date.toLocaleDateString('en-US', optionsDate)} <span class="weekday">(${date.toLocaleDateString('en-US', optionsWeekday)})</span>`;
    }
    function displayDateForSummary(date) { // For text/PDF
        if (!date) return 'N/A';
        const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    }
    function showError(message) {
        errorMessagesDiv.textContent = message;
        errorMessagesDiv.classList.remove('hidden');
    }
    function clearError() {
        errorMessagesDiv.textContent = '';
        errorMessagesDiv.classList.add('hidden');
    }
    function showStatus(element, message, type = 'pending') {
        element.textContent = message;
        element.className = `status-box ${type}`;
        element.classList.remove('hidden');
    }
    function hideStatus(element) {
        element.classList.add('hidden');
    }

    // --- Availability Logic ---
    async function fetchAllSchedules() {
        // ... (Implementation from previous response - fetch from Firestore) ...
         if (!db) {
            console.error("Firestore not initialized for fetching schedules.");
            return [];
        }
        try {
            // Fetch schedules ordered by session1Date to potentially optimize later checks
            const snapshot = await db.collection(FIRESTORE_COLLECTION).orderBy("session1Date", "desc").get();
            const schedules = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    participantUid: data.participantUid,
                    session1Date: data.session1Date, // string YYYY-MM-DD
                    followUpDates: data.followUpDates || [], // array of strings YYYY-MM-DD
                    backupDates: data.backupDates || [] // array of strings YYYY-MM-DD
                };
            });
            console.log(`Fetched ${schedules.length} schedules.`);
            allSchedules = schedules;
            return schedules;
        } catch (error) {
            console.error("Error fetching all schedules:", error);
            showError("Could not load existing schedule data. Availability checks may be inaccurate.");
            allSchedules = [];
            return [];
        }
    }

    function getLastDeviceUsageDate(schedule) {
        // ... (Implementation from previous response - find latest date among session1, followups, backups) ...
        let lastDateStr = null;
        const backups = schedule.backupDates || [];
        const followUps = schedule.followUpDates || [];

        if (backups.length > 0) {
            lastDateStr = [...backups].sort().pop(); // Lexical sort works for YYYY-MM-DD
        } else if (followUps.length > 0) {
            lastDateStr = [...followUps].sort().pop();
        } else {
            lastDateStr = schedule.session1Date;
        }

        return parseDate(lastDateStr); // Returns a Date object or null
    }

    async function calculateFirstAvailableStartDate() {
        // ... (Implementation from previous response - iterate finding day with < MAX_CONCURRENT_DEVICES) ...
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        let proposedStartDate = addDays(today, 1); // Start checking from tomorrow

        if (allSchedules.length === 0) {
            console.log("No existing schedules, starting tomorrow.");
            return proposedStartDate;
        }

        let attempts = 0;
        const maxAttempts = 90; // Look ahead ~3 months max

        while (attempts < maxAttempts) {
            let devicesInUse = 0;
            for (const schedule of allSchedules) {
                const session1 = parseDate(schedule.session1Date);
                const lastUsed = getLastDeviceUsageDate(schedule);

                // Check if the proposed start date falls within an existing booking range
                if (session1 && lastUsed && proposedStartDate >= session1 && proposedStartDate <= lastUsed) {
                    devicesInUse++;
                }
            }

            console.log(`Checking ${formatDate(proposedStartDate)}: ${devicesInUse} devices in use.`);

            if (devicesInUse < MAX_CONCURRENT_DEVICES) {
                console.log(`Available start date found: ${formatDate(proposedStartDate)}`);
                return proposedStartDate; // Found an available date
            }

            // If not available, try the next day
            proposedStartDate = addDays(proposedStartDate, 1);
            attempts++;
        }

        // Fallback if no date found within maxAttempts
        console.warn(`Could not find an available start date within ${maxAttempts} days. High demand.`);
        showError("High demand: Availability is limited. Calendar shows possible dates starting tomorrow, but please await confirmation.");
        return addDays(today, 1); // Return tomorrow as a fallback
    }


    // --- Calendar Rendering ---
    function renderCalendar(container, startDate, numDays, selectedList, clickHandler, singleSelection = false) {
        // ... (Implementation from previous response - creates buttons) ...
        container.innerHTML = '';
        for (let i = 0; i < numDays; i++) {
            const date = addDays(startDate, i);
            const dateStr = formatDate(date);
            const button = document.createElement('button');
            button.classList.add('date-button');
            button.innerHTML = displayDate(date);
            button.dataset.date = dateStr;

            // Check if button should be selected
            if (selectedList.includes(dateStr)) {
                button.classList.add('selected');
            }

            // Check if scheduler is locked after successful submission
             const alreadySubmitted = submitButton.disabled && submitButton.textContent.includes("Submitted");
             if (alreadySubmitted) {
                 button.disabled = true;
             }


            button.addEventListener('click', () => {
                if (button.disabled) return; // Ignore clicks if disabled (e.g., post-submission)
                clickHandler(dateStr, button, singleSelection);
                updateReviewButtonState();
                summarySectionDiv.classList.add('hidden');
                hideStatus(submissionStatusP);
                hideStatus(pdfStatusP);
            });
            container.appendChild(button);
        }
    }

    function renderSession1Calendar() {
        // ... (Implementation from previous response - uses firstAvailableStartDate) ...
        session1CalendarDiv.innerHTML = '';
        if (!firstAvailableStartDate) {
            showError("Could not determine the first available start date. Please refresh.");
            session1CalendarDiv.innerHTML = '<p>Error loading available start dates.</p>';
            return;
        }
        console.log("Rendering Session 1 calendar starting from:", formatDate(firstAvailableStartDate));
        renderCalendar(session1CalendarDiv, firstAvailableStartDate, SESSION1_LOOKAHEAD_DAYS, selectedSession1Date ? [selectedSession1Date] : [], handleSession1Click, true);
    }

    function renderFollowUpCalendar() {
        // ... (Implementation from previous response) ...
        if (!selectedSession1Date) return;
        followUpCalendarDiv.innerHTML = '';
        const session1 = parseDate(selectedSession1Date);
        const startDateForFollowUps = addDays(session1, 1);
        const totalFollowUpDaysToShow = FOLLOWUP_DURATION_WEEKS * 7;
        renderCalendar(followUpCalendarDiv, startDateForFollowUps, totalFollowUpDaysToShow, selectedFollowUpDates, handleFollowUpClick, false);
    }

    function renderBackupCalendar() {
        // ... (Implementation from previous response - based on last follow-up) ...
        if (selectedFollowUpDates.length !== REQUIRED_FOLLOWUPS) return;
        backupCalendarDiv.innerHTML = '';
        selectedBackupDates = []; // Reset if re-rendering
        backupCountSpan.textContent = '0';

        const sortedFollowUps = [...selectedFollowUpDates].sort(); // Lexical sort ok for YYYY-MM-DD
        const lastFollowUpDateStr = sortedFollowUps[sortedFollowUps.length - 1];
        const lastFollowUpDate = parseDate(lastFollowUpDateStr);

        if (!lastFollowUpDate) {
             console.error("Could not parse last follow-up date for backup calendar.");
             return;
        }

        const startDateForBackups = addDays(lastFollowUpDate, 1);
        renderCalendar(backupCalendarDiv, startDateForBackups, BACKUP_WINDOW_DAYS, selectedBackupDates, handleBackupClick, false);
    }

    // --- Click Handlers ---
    function handleSession1Click(dateStr, button, singleSelection) {
        // ... (Implementation from previous response - updates state, resets follow-up/backup) ...
        if (selectedSession1Date === dateStr) return;
        selectedSession1Date = dateStr;
        document.querySelectorAll('#session1Calendar .date-button').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.date === dateStr);
        });
        // Reset subsequent steps
        selectedFollowUpDates = [];
        selectedBackupDates = [];
        followUpCountSpan.textContent = '0';
        backupCountSpan.textContent = '0';
        followUpCalendarDiv.innerHTML = '';
        backupCalendarDiv.innerHTML = '';
        followUpSectionDiv.classList.remove('hidden'); // Show next step
        backupSectionDiv.classList.add('hidden'); // Hide step 3
        renderFollowUpCalendar(); // Render step 2
    }

    function handleFollowUpClick(dateStr, button, singleSelection) {
        // ... (Implementation from previous response - adds/removes from selectedFollowUpDates) ...
         const index = selectedFollowUpDates.indexOf(dateStr);
        if (index > -1) {
            selectedFollowUpDates.splice(index, 1);
            button.classList.remove('selected');
        } else {
            if (selectedFollowUpDates.length < REQUIRED_FOLLOWUPS) {
                selectedFollowUpDates.push(dateStr);
                button.classList.add('selected');
            } else {
                alert(`You can only select ${REQUIRED_FOLLOWUPS} follow-up nights.`);
            }
        }
        followUpCountSpan.textContent = selectedFollowUpDates.length;
        showBackupSelection(); // Check if we should show backup section now
        updateReviewButtonState();
    }

    function handleBackupClick(dateStr, button, singleSelection) {
        // ... (Implementation from previous response - adds/removes from selectedBackupDates) ...
        const index = selectedBackupDates.indexOf(dateStr);
        if (index > -1) {
            selectedBackupDates.splice(index, 1);
            button.classList.remove('selected');
        } else {
            if (selectedBackupDates.length < REQUIRED_BACKUPS) {
                selectedBackupDates.push(dateStr);
                button.classList.add('selected');
            } else {
                alert(`You can only select ${REQUIRED_BACKUPS} backup nights.`);
            }
        }
        backupCountSpan.textContent = selectedBackupDates.length;
        updateReviewButtonState();
    }

    // --- UI Updates ---
    function showBackupSelection() {
        if (selectedFollowUpDates.length === REQUIRED_FOLLOWUPS) {
            renderBackupCalendar();
            backupSectionDiv.classList.remove('hidden');
        } else {
            backupSectionDiv.classList.add('hidden');
        }
    }

    function updateReviewButtonState() {
        // ... (Implementation from previous response - checks all required selections) ...
        const alreadySubmitted = submitButton.disabled && submitButton.textContent.includes("Submitted");
        const allSelectionsMade = participantUid !== null &&
                                  selectedSession1Date !== null &&
                                  selectedFollowUpDates.length === REQUIRED_FOLLOWUPS &&
                                  selectedBackupDates.length === REQUIRED_BACKUPS; // Backups are now required
        reviewButton.disabled = !allSelectionsMade || alreadySubmitted;
    }


    // --- Summary and Submission ---
    function generateSummaryText() {
        // ... (Implementation from previous response - includes backups) ...
        if (!participantUid || !selectedSession1Date || selectedFollowUpDates.length !== REQUIRED_FOLLOWUPS || selectedBackupDates.length !== REQUIRED_BACKUPS) {
            return "Error: Selections incomplete.";
        }
        const sortedFollowUps = [...selectedFollowUpDates].sort();
        const sortedBackups = [...selectedBackupDates].sort();

        let summary = `Participant UID: ${participantUid}\n\n`;
        summary += `Selected First Session:\n - ${displayDateForSummary(parseDate(selectedSession1Date))} (${selectedSession1Date})\n\n`;
        summary += `Selected ${REQUIRED_FOLLOWUPS} Follow-up Nights:\n`;
        sortedFollowUps.forEach(dateStr => {
            summary += ` - ${displayDateForSummary(parseDate(dateStr))} (${dateStr})\n`;
        });
        summary += `\nSelected ${REQUIRED_BACKUPS} Backup Nights:\n`;
        sortedBackups.forEach(dateStr => {
            summary += ` - ${displayDateForSummary(parseDate(dateStr))} (${dateStr})\n`;
        });
        return summary;
    }

    function handleReview() {
        // ... (Implementation from previous response - shows summary) ...
        if (reviewButton.disabled) return;
        const summaryText = generateSummaryText();
        logOutputPre.textContent = summaryText;
        summarySectionDiv.classList.remove('hidden');
        hideStatus(submissionStatusP);
        hideStatus(pdfStatusP);
        const alreadySubmitted = submitButton.disabled && submitButton.textContent.includes("Submitted");
        submitButton.disabled = alreadySubmitted;
        if (!alreadySubmitted) {
            submitButton.textContent = "Submit Selections";
        }
        summarySectionDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    async function submitToFirebase(uid, session1, followUps, backups) {
        // ... (Implementation from previous response - writes all dates) ...
        if (!db) {
            console.error("Firestore database instance is not available.");
            showStatus(submissionStatusP, "Error: Database connection failed.", 'error');
            return false;
        }
        try {
            await db.collection(FIRESTORE_COLLECTION).add({
              participantUid: uid,
              session1Date: session1,
              followUpDates: followUps,
              backupDates: backups,
              submittedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log("Document successfully written!");
            return true;
          } catch (error) {
            console.error("Error writing document: ", error);
             showStatus(submissionStatusP, `Error submitting to database: ${error.message}. Please try again.`, 'error');
            return false;
          }
    }

    async function generatePdfSummary() {
        if (!jspdf) {
            showStatus(pdfStatusP, "PDF generation skipped: Library not loaded.", 'error');
            return;
        }
        showStatus(pdfStatusP, "Generating PDF...", 'pending');

        try {
            const { jsPDF } = jspdf; // Destructure jsPDF from the loaded library object
            const doc = new jsPDF();
            const lineHeight = 7; // mm
            let currentY = 15; // mm from top

            doc.setFontSize(16);
            doc.text("Experiment Schedule Summary", 10, currentY);
            currentY += lineHeight * 1.5;

            doc.setFontSize(11);
            doc.text(`Participant UID: ${participantUid}`, 10, currentY);
            currentY += lineHeight * 1.5;

            doc.text("Selected First Session:", 10, currentY);
            currentY += lineHeight;
            doc.text(` - ${displayDateForSummary(parseDate(selectedSession1Date))} (${selectedSession1Date})`, 15, currentY);
            currentY += lineHeight * 1.5;

            doc.text(`Selected ${REQUIRED_FOLLOWUPS} Follow-up Nights:`, 10, currentY);
            currentY += lineHeight;
            const sortedFollowUps = [...selectedFollowUpDates].sort();
            sortedFollowUps.forEach(dateStr => {
                 if (currentY > 270) { // Check for page break
                     doc.addPage();
                     currentY = 15;
                 }
                doc.text(` - ${displayDateForSummary(parseDate(dateStr))} (${dateStr})`, 15, currentY);
                currentY += lineHeight;
            });
            currentY += lineHeight * 0.5; // Extra space

            doc.text(`Selected ${REQUIRED_BACKUPS} Backup Nights:`, 10, currentY);
            currentY += lineHeight;
            const sortedBackups = [...selectedBackupDates].sort();
             sortedBackups.forEach(dateStr => {
                 if (currentY > 270) {
                     doc.addPage();
                     currentY = 15;
                 }
                 doc.text(` - ${displayDateForSummary(parseDate(dateStr))} (${dateStr})`, 15, currentY);
                 currentY += lineHeight;
             });
             currentY += lineHeight * 1.5;

             doc.setFontSize(9);
             doc.text(`Generated on: ${new Date().toLocaleString()}`, 10, currentY);

            const filename = `Experiment_Schedule_${participantUid}_${formatDate(new Date())}.pdf`;
            doc.save(filename);
            showStatus(pdfStatusP, "PDF download initiated.", 'success');

        } catch (error) {
            console.error("PDF Generation Error:", error);
            showStatus(pdfStatusP, `Error generating PDF: ${error.message}. Please copy the text summary.`, 'error');
        }
    }


    async function handleSubmit() {
        // ... (Implementation from previous response - calls submitToFirebase, then generatePdfSummary) ...
        if (submitButton.disabled) return;

         if (!participantUid || !selectedSession1Date || selectedFollowUpDates.length !== REQUIRED_FOLLOWUPS || selectedBackupDates.length !== REQUIRED_BACKUPS ) {
            showStatus(submissionStatusP, "Error: Cannot submit, selections are incomplete.", 'error');
            return;
         }

         submitButton.disabled = true;
         reviewButton.disabled = true; // Also disable review button during/after submit
         showStatus(submissionStatusP, "Submitting...", 'pending');
         hideStatus(pdfStatusP); // Clear previous PDF status

         const success = await submitToFirebase(participantUid, selectedSession1Date, selectedFollowUpDates, selectedBackupDates);

         if (success) {
            showStatus(submissionStatusP, "Your selections have been successfully submitted!", 'success');
            submitButton.textContent = "Submitted Successfully"; // Keep disabled
            reviewButton.disabled = true; // Keep disabled

            // Disable all date buttons permanently
            document.querySelectorAll('.date-button').forEach(b => b.disabled = true);

            // Trigger PDF download
            await generatePdfSummary();

         } else {
             // Error message shown by submitToFirebase
             submitButton.disabled = false; // Re-enable button on failure
             reviewButton.disabled = false; // Re-enable review button too
             // Don't hide submission status, it shows the error
         }
    }


    // --- Initialization ---
    async function initializeScheduler() {
        clearError();
        hideStatus(submissionStatusP);
        hideStatus(pdfStatusP);
        hideStatus(loadingStatusDiv); // Ensure loading is hidden initially

        const urlParams = new URLSearchParams(window.location.search);
        participantUid = urlParams.get('uid');

        if (!participantUid) {
            showError("Error: No Participant UID found in the URL (expecting '?uid=SOME_ID'). Please use the link provided.");
            return;
        }
        if (!db) {
             showError("Critical Error: Database service not initialized. Cannot proceed.");
             schedulerContentDiv.classList.add('hidden');
             return;
        }
        // Check for jsPDF early
        if (!jspdf) {
             showError("Warning: PDF library failed to load. PDF download will not be available.");
        }


        participantInfoDiv.textContent = `Participant UID: ${participantUid}`;
        participantInfoDiv.classList.remove('hidden');

        // Show loading indicator while fetching schedules
        showStatus(loadingStatusDiv, "Loading availability...", 'pending');
        schedulerContentDiv.classList.add('hidden'); // Hide main content during load

        await fetchAllSchedules();
        firstAvailableStartDate = await calculateFirstAvailableStartDate();

        hideStatus(loadingStatusDiv); // Hide loading indicator

        if (!firstAvailableStartDate) {
            // Error handled in calculate function, but double-check
             showError("Could not determine starting availability. Please refresh or contact support.");
             return; // Don't show content if we can't get a start date
        }

        schedulerContentDiv.classList.remove('hidden'); // Show main content

        reviewButton.addEventListener('click', handleReview);
        submitButton.addEventListener('click', handleSubmit);

        renderSession1Calendar(); // Render first step
    }

    // Start the process
    initializeScheduler();
});
