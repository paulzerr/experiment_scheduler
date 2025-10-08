// experimenter_overview/generate_pdf.js

// --- Supabase Configuration ---
let supabaseClient;
if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
} else {
    console.error("Supabase SDK not loaded.");
}

// --- DOM Elements ---
const elements = {
    participantIdInput: document.getElementById('participantIdInput'),
    generatePdfButton: document.getElementById('generatePdfButton'),
    statusMessages: document.getElementById('statusMessages')
};

// --- Event Listeners ---
elements.generatePdfButton.addEventListener('click', handleGeneratePdf);

async function handleGeneratePdf() {
    const participantId = elements.participantIdInput.value.trim();
    if (!participantId) {
        showStatus('Please enter a Participant ID.', 'error');
        return;
    }

    showStatus('Fetching schedule...', 'pending');

    try {
        const { data, error } = await supabaseClient
            .from('schedules')
            .select('participant_id, session_dates, backup_dates, instruction_timeslot')
            .eq('participant_id', participantId)
            .maybeSingle();

        if (error) throw error;

        if (!data || !data.session_dates) {
            showStatus(`No submitted schedule found for Participant ID: ${participantId}`, 'error');
            return;
        }

        // Use the existing PDF generation function
        generateAndDownloadPDF({
            ...data,
            participant_id: data.participant_id // Ensure the ID is passed correctly
        }, data.participant_id);

        showStatus('PDF generated successfully!', 'success');

    } catch (err) {
        console.error('Error generating PDF:', err);
        showStatus('Failed to generate PDF. Check the console for details.', 'error');
    }
}

function showStatus(message, type) {
    elements.statusMessages.textContent = message;
    elements.statusMessages.className = `status-box ${type}`;
    elements.statusMessages.classList.remove('hidden');
}