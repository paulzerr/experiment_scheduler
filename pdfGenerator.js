// pdfGenerator.js - PDF generation functionality for experiment scheduler

/**
 * Generates and downloads a PDF summary of the experiment schedule
 * @param {Object} scheduleData - The schedule data object
 * @param {string} participantId - The participant ID for the filename
 */
function generateAndDownloadPDF(scheduleData, participantId) {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
        throw new Error("jsPDF library not found.");
    }
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Lucid Dreaming At Home Experiment Schedule", 14, 22);
    doc.setFontSize(12);
    doc.text(`Participant ID: ${participantId}`, 14, 32);

    let yPos = 45;
    doc.setFontSize(11);
    
    // Display instruction session info
    const firstSessionDate = scheduleData.session_dates[0];

    // Add horizontal line
    doc.line(14, yPos, 196, yPos);
    yPos += 10;

    doc.setFont(undefined, 'bold');
    doc.text("Instruction session:", 14, yPos);
    yPos += 6;
    doc.setFont(undefined, 'normal');
    doc.text(`${scheduleData.instruction_timeslot}, ${DateManager.formatForDisplay(DateManager.toUTCDate(firstSessionDate))}`, 14, yPos);
    yPos += 10;
    
    // Display location information
    doc.setFont(undefined, 'bold');
    doc.text("Location:", 14, yPos);
    yPos += 6;
    doc.setFont(undefined, 'normal');
    doc.text("Donders Centre for Cognitive Neuroimaging", 14, yPos);
    yPos += 6;
    doc.text("Kapittelweg 29, 6525 EN Nijmegen", 14, yPos);
    yPos += 10;
    doc.text("We will pick you up from the small room near reception just after you enter the building.", 14, yPos);
    yPos += 10;
    doc.text("Please make sure to be on time.", 14, yPos);
    yPos += 10;
    
    // Add horizontal line
    doc.line(14, yPos, 196, yPos);
    yPos += 10;
    
    doc.setFont(undefined, 'bold');
    doc.text(`Experiment Sessions (${scheduleData.session_dates.length}):`, 14, yPos);
    yPos += 6;
    doc.setFont(undefined, 'normal');
    scheduleData.session_dates.forEach((date, index) => {
        if (yPos > 270) { doc.addPage(); yPos = 20; }
        const prefix = index === 0 ? `Session 1 (Instruction at ${scheduleData.instruction_timeslot})` : `Session ${index + 1}`;
        doc.text(`  - ${prefix}: ${DateManager.formatForDisplay(DateManager.toUTCDate(date))}`, 20, yPos);
        yPos += 6;
    });

    yPos += 4;
    // Add horizontal line
    doc.line(14, yPos, 196, yPos);
    yPos += 10;
    
    doc.setFont(undefined, 'bold');
    doc.text(`Backup Sessions (${scheduleData.backup_dates.length}):`, 14, yPos);
    yPos += 6;
    doc.setFont(undefined, 'normal');
    scheduleData.backup_dates.forEach((date, index) => {
        if (yPos > 270) { doc.addPage(); yPos = 20; }
        doc.text(`  - Backup ${index + 1}: ${DateManager.formatForDisplay(DateManager.toUTCDate(date))}`, 20, yPos);
        yPos += 6;
    });

    yPos = Math.max(yPos, 250);
    if (yPos > 270) { doc.addPage(); yPos = 20;}
    doc.text("Please keep this PDF for your records.", 14, yPos);
    doc.text("Contact the experimenters if you have any questions: luciddreamingathome@donders.ru.nl", 14, yPos + 6);

    doc.save(`Experiment_Schedule_${participantId}.pdf`);

    const pdfStatusP = document.getElementById('pdfStatus');
    if (pdfStatusP) {
        pdfStatusP.textContent = 'PDF downloaded successfully!';
        pdfStatusP.className = 'status-box success';
    }
}
