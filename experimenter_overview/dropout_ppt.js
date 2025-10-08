document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('dropoutForm');
    const responseDiv = document.getElementById('response');

    // Initialize Supabase client
    const supabase = window.supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const pptId = document.getElementById('pptId').value;
        const confirmation = confirm(`Are you sure you want to process the dropout for participant ${pptId}? This action cannot be undone.`);
        if (!confirmation) {
            responseDiv.textContent = 'Operation cancelled.';
            responseDiv.style.color = 'orange';
            return;
        }

        responseDiv.textContent = 'Processing...';
        const dropoutDate = document.getElementById('dropoutDate').value;

        if (!pptId || !dropoutDate) {
            responseDiv.textContent = 'Please fill in all fields.';
            responseDiv.style.color = 'red';
            return;
        }

        try {
            // Fetch the user's data
            const { data, error } = await supabase
                .from('schedules')
                .select('participant_id, session_dates, backup_dates, has_equipment_days')
                .eq('participant_id', pptId)
                .single();

            if (error) throw error;
            if (!data) {
                responseDiv.textContent = `Participant with ID ${pptId} not found.`;
                responseDiv.style.color = 'red';
                return;
            }

            // Calculate what will be removed
            const sessionsToRemove = data.session_dates.filter(date => new Date(date) >= new Date(dropoutDate));
            const backupToRemove = data.backup_dates.filter(date => new Date(date) >= new Date(dropoutDate));
            const equipmentDaysToRemove = data.has_equipment_days.filter(date => new Date(date) >= new Date(dropoutDate));

            // Filter out the sessions to be removed
            const updatedSessions = data.session_dates.filter(date => new Date(date) < new Date(dropoutDate));
            const updatedBackupSessions = data.backup_dates.filter(date => new Date(date) < new Date(dropoutDate));
            const updatedEquipmentDays = data.has_equipment_days.filter(date => new Date(date) < new Date(dropoutDate));

            // Update the database
            const { error: updateError } = await supabase
                .from('schedules')
                .update({
                    session_dates: updatedSessions,
                    backup_dates: updatedBackupSessions,
                    has_equipment_days: updatedEquipmentDays
                })
                .eq('participant_id', pptId);

            if (updateError) throw updateError;

            const formatDateList = (dateArray) => {
                if (!dateArray || dateArray.length === 0) return '<li>None</li>';
                return dateArray.map(d => `<li>${DateManager.formatForDisplay(new Date(d))}</li>`).join('');
            };

            let feedbackMessage = `<h2>Dropout Processed for Participant ${pptId}</h2>`;

            if (sessionsToRemove.length > 0 || backupToRemove.length > 0 || equipmentDaysToRemove.length > 0) {
                feedbackMessage += `
                    <h3>Summary of Changes</h3>
                    <p><strong>${sessionsToRemove.length}</strong> session(s), <strong>${backupToRemove.length}</strong> backup session(s), and <strong>${equipmentDaysToRemove.length}</strong> equipment day(s) were removed.</p>
                    <p><strong>${updatedSessions.length}</strong> session(s), <strong>${updatedBackupSessions.length}</strong> backup session(s), and <strong>${updatedEquipmentDays.length}</strong> equipment day(s) were kept.</p>
                    
                    <h3>Details</h3>
                    <div class="dropout-details">
                        <div class="column">
                            <h4>Removed Dates</h4>
                            <strong>Sessions:</strong><ul>${formatDateList(sessionsToRemove)}</ul>
                            <strong>Backups:</strong><ul>${formatDateList(backupToRemove)}</ul>
                            <strong>Equipment Days:</strong><ul>${formatDateList(equipmentDaysToRemove)}</ul>
                        </div>
                        <div class="column">
                            <h4>Kept Dates</h4>
                            <strong>Sessions:</strong><ul>${formatDateList(updatedSessions)}</ul>
                            <strong>Backups:</strong><ul>${formatDateList(updatedBackupSessions)}</ul>
                            <strong>Equipment Days:</strong><ul>${formatDateList(updatedEquipmentDays)}</ul>
                        </div>
                    </div>
                `;
            } else {
                feedbackMessage = `
                    <h2>No Changes for Participant ${pptId}</h2>
                    <p>No sessions, backups, or equipment days were found on or after the specified dropout date. The participant's schedule remains unchanged.</p>
                    <h4>Current Schedule</h4>
                    <ul>
                        <li><strong>Sessions:</strong> ${updatedSessions.length}</li>
                        <li><strong>Backups:</strong> ${updatedBackupSessions.length}</li>
                        <li><strong>Equipment Days:</strong> ${updatedEquipmentDays.length}</li>
                    </ul>
                `;
            }

            responseDiv.innerHTML = feedbackMessage;
            responseDiv.style.color = 'green';
        } catch (error) {
            console.error('Error:', error);
            responseDiv.textContent = `An error occurred: ${error.message}`;
            responseDiv.style.color = 'red';
        }
    });
});