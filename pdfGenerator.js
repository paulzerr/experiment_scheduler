// pdfGenerator.js - PDF generation functionality for experiment scheduler

const EXCESSIVE_LOG_MARKER_PDF_GENERATOR = '[EXCESSIVE_TRACE]';
function excessiveLogPdfGenerator(message, payload) {
    if (payload === undefined) {
        console.log(EXCESSIVE_LOG_MARKER_PDF_GENERATOR, message);
    } else {
        console.log(EXCESSIVE_LOG_MARKER_PDF_GENERATOR, message, payload);
    }
}

/**
 * Generates and downloads a PDF summary of the experiment schedule
 * @param {Object} scheduleData - The schedule data object
 * @param {string} participantId - The participant ID for the filename
 */
function generateAndDownloadPDF(scheduleData, participantId) {
    excessiveLogPdfGenerator('generateAndDownloadPDF called', { scheduleData, participantId });
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
        excessiveLogPdfGenerator('generateAndDownloadPDF throwing because jsPDF is missing');
        throw new Error("jsPDF library not found.");
    }
    excessiveLogPdfGenerator('generateAndDownloadPDF located jsPDF constructor');
    const doc = new jsPDF();
    excessiveLogPdfGenerator('generateAndDownloadPDF created jsPDF document instance');

    doc.setFontSize(18);
    excessiveLogPdfGenerator('generateAndDownloadPDF set font size for title', { fontSize: 18 });
    doc.text("Lucid Dreaming At Home Experiment Schedule", 14, 22);
    excessiveLogPdfGenerator('generateAndDownloadPDF wrote title text', { x: 14, y: 22 });
    doc.setFontSize(12);
    excessiveLogPdfGenerator('generateAndDownloadPDF set font size for participant header', { fontSize: 12 });
    doc.text(`Participant ID: ${participantId}`, 14, 32);
    excessiveLogPdfGenerator('generateAndDownloadPDF wrote participant ID', { participantId, x: 14, y: 32 });

    let yPos = 45;
    doc.setFontSize(11);
    excessiveLogPdfGenerator('generateAndDownloadPDF initialized content cursor', { yPos, fontSize: 11 });
    
    // Display instruction session info
    const firstSessionDate = scheduleData.session_dates[0];
    excessiveLogPdfGenerator('generateAndDownloadPDF resolved first session date', { firstSessionDate });

    // Add horizontal line
    doc.line(14, yPos, 196, yPos);
    excessiveLogPdfGenerator('generateAndDownloadPDF drew separator line', { yPos });
    yPos += 10;
    excessiveLogPdfGenerator('generateAndDownloadPDF advanced yPos after separator line', { yPos });

    doc.setFont(undefined, 'bold');
    excessiveLogPdfGenerator('generateAndDownloadPDF set bold font for instruction section heading');
    doc.text("Instruction session (and first experiment night):", 14, yPos);
    excessiveLogPdfGenerator('generateAndDownloadPDF wrote instruction section heading', { yPos });
    yPos += 6;
    excessiveLogPdfGenerator('generateAndDownloadPDF advanced yPos after heading', { yPos });
    doc.setFont(undefined, 'normal');
    excessiveLogPdfGenerator('generateAndDownloadPDF set normal font for instruction section body');
    const firstSessionDisplay = DateManager.formatForDisplay(DateManager.toUTCDate(firstSessionDate));
    const instructionLine = `${scheduleData.instruction_timeslot}, ${firstSessionDisplay}`;
    doc.text(instructionLine, 14, yPos);
    excessiveLogPdfGenerator('generateAndDownloadPDF wrote instruction session line', { instructionLine, yPos });
    yPos += 10;
    excessiveLogPdfGenerator('generateAndDownloadPDF advanced yPos after instruction line', { yPos });
    
    // Display location information
    doc.setFont(undefined, 'bold');
    excessiveLogPdfGenerator('generateAndDownloadPDF set bold font for location heading');
    doc.text("Location:", 14, yPos);
    excessiveLogPdfGenerator('generateAndDownloadPDF wrote location heading', { yPos });
    yPos += 6;
    excessiveLogPdfGenerator('generateAndDownloadPDF advanced yPos after location heading', { yPos });
    doc.setFont(undefined, 'normal');
    excessiveLogPdfGenerator('generateAndDownloadPDF set normal font for location details');
    doc.text("Donders Centre for Cognitive Neuroimaging", 14, yPos);
    excessiveLogPdfGenerator('generateAndDownloadPDF wrote location line 1', { yPos });
    yPos += 6;
    excessiveLogPdfGenerator('generateAndDownloadPDF advanced yPos after location line 1', { yPos });
    doc.text("Kapittelweg 29, 6525 EN Nijmegen", 14, yPos);
    excessiveLogPdfGenerator('generateAndDownloadPDF wrote location line 2', { yPos });
    yPos += 10;
    excessiveLogPdfGenerator('generateAndDownloadPDF advanced yPos after location line 2', { yPos });
    doc.text("We will pick you up from the small room near reception just after you enter the building.", 14, yPos);
    excessiveLogPdfGenerator('generateAndDownloadPDF wrote pickup instructions', { yPos });
    yPos += 10;
    excessiveLogPdfGenerator('generateAndDownloadPDF advanced yPos after pickup instructions', { yPos });
    doc.text("Please make sure to be on time.", 14, yPos);
    excessiveLogPdfGenerator('generateAndDownloadPDF wrote punctuality reminder', { yPos });
    yPos += 10;
    excessiveLogPdfGenerator('generateAndDownloadPDF advanced yPos after punctuality reminder', { yPos });
    
    // Add horizontal line
    doc.line(14, yPos, 196, yPos);
    excessiveLogPdfGenerator('generateAndDownloadPDF drew second separator line', { yPos });
    yPos += 10;
    excessiveLogPdfGenerator('generateAndDownloadPDF advanced yPos after second separator', { yPos });
    
    doc.setFont(undefined, 'bold');
    excessiveLogPdfGenerator('generateAndDownloadPDF set bold font for sessions heading');
    doc.text(`Experiment Nights (${scheduleData.session_dates.length}):`, 14, yPos);
    excessiveLogPdfGenerator('generateAndDownloadPDF wrote sessions heading', {
        sessionsCount: scheduleData.session_dates.length,
        yPos
    });
    yPos += 6;
    excessiveLogPdfGenerator('generateAndDownloadPDF advanced yPos after sessions heading', { yPos });
    doc.setFont(undefined, 'normal');
    excessiveLogPdfGenerator('generateAndDownloadPDF set normal font for sessions list');
    scheduleData.session_dates.forEach((date, index) => {
        excessiveLogPdfGenerator('generateAndDownloadPDF iterating session date', {
            index,
            date,
            yPosBefore: yPos
        });
        if (yPos > 270) {
            excessiveLogPdfGenerator('generateAndDownloadPDF adding page before session line due to yPos overflow', {
                yPosBeforePageBreak: yPos
            });
            doc.addPage();
            yPos = 20;
            excessiveLogPdfGenerator('generateAndDownloadPDF reset yPos after page break for sessions', { yPos });
        }
        const prefix = index === 0 ? `Session 1 (Instruction at ${scheduleData.instruction_timeslot})` : `Session ${index + 1}`;
        const displayDate = DateManager.formatForDisplay(DateManager.toUTCDate(date));
        const sessionLine = `  - ${prefix}: ${displayDate}`;
        doc.text(sessionLine, 20, yPos);
        excessiveLogPdfGenerator('generateAndDownloadPDF wrote session line', {
            index,
            sessionLine,
            yPos
        });
        yPos += 6;
        excessiveLogPdfGenerator('generateAndDownloadPDF advanced yPos after session line', { index, yPos });
    });

    excessiveLogPdfGenerator('generateAndDownloadPDF normalizing final yPos floor', { yPosBefore: yPos });
    yPos = Math.max(yPos, 250);
    excessiveLogPdfGenerator('generateAndDownloadPDF normalized final yPos floor', { yPosAfter: yPos });
    if (yPos > 270) {
        excessiveLogPdfGenerator('generateAndDownloadPDF adding final page for closing text due to yPos overflow', { yPos });
        doc.addPage();
        yPos = 20;
        excessiveLogPdfGenerator('generateAndDownloadPDF reset yPos for closing text', { yPos });
    }
    doc.text("Please keep this PDF for your records.", 14, yPos + 6);
    excessiveLogPdfGenerator('generateAndDownloadPDF wrote records reminder', { yPos: yPos + 6 });
    doc.text("Contact the experimenters if you have any questions: luciddreamingathome@donders.ru.nl", 14, yPos + 12);
    excessiveLogPdfGenerator('generateAndDownloadPDF wrote contact information', { yPos: yPos + 12 });

    const filename = `Experiment_Schedule_${participantId}.pdf`;
    excessiveLogPdfGenerator('generateAndDownloadPDF saving document', { filename });
    doc.save(filename);
    excessiveLogPdfGenerator('generateAndDownloadPDF save invoked', { filename });

    const pdfStatusP = document.getElementById('pdfStatus');
    excessiveLogPdfGenerator('generateAndDownloadPDF resolved pdfStatus element', { exists: Boolean(pdfStatusP) });
    if (pdfStatusP) {
        pdfStatusP.textContent = 'PDF downloaded successfully!';
        pdfStatusP.className = 'status-box success';
        excessiveLogPdfGenerator('generateAndDownloadPDF updated pdfStatus UI', {
            textContent: pdfStatusP.textContent,
            className: pdfStatusP.className
        });
    }
}
