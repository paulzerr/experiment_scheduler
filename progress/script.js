document.addEventListener('DOMContentLoaded', async () => {
    let supabaseClient;
    let completedSessionsChart, sessionsPerDayChart;
    let allData = [];
    let showPreview = true;

    function initializeSupabase() {
        if (window.supabase) {
            supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
            loadAndProcessData();
        } else {
            console.error("Supabase SDK not loaded.");
        }
    }

    async function loadAndProcessData() {
        const { data, error } = await supabaseClient
            .from('schedules')
            .select('participant_id, session_dates, backup_dates')
            .order('submission_timestamp', { ascending: false });

        if (error) {
            console.error('Error fetching schedules:', error);
            return;
        }

        // Calculate and render the summary table with the full dataset
        calculateAndRenderSummary(data);

        // Now, filter for the charts
        allData = data
            .filter(schedule => !OVERVIEW_CONFIG.EXCLUDED_PPTS.has(schedule.participant_id))
            .flatMap(schedule => schedule.session_dates || [])
            .map(dateStr => new Date(dateStr))
            .sort((a, b) => a - b);

        if (allData.length === 0) {
            console.log("No sessions found for charts.");
        }

        document.getElementById('togglePreviewBtn').addEventListener('click', () => {
            showPreview = !showPreview;
            updateCharts();
        });

        createCharts();
    }

    function calculateAndRenderSummary(schedules) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let completed = 0;
        let running = 0;
        let scheduled = 0;
        const dropouts = OVERVIEW_CONFIG.EXCLUDED_PPTS.size;

        const nonDropouts = schedules.filter(s => !OVERVIEW_CONFIG.EXCLUDED_PPTS.has(s.participant_id));

        nonDropouts.forEach(schedule => {
            const sessionDates = (schedule.session_dates || []).map(d => new Date(d));
            const backupDates = (schedule.backup_dates || []).map(d => new Date(d));
            
            if (sessionDates.length === 0) {
                return;
            }

            const firstSession = sessionDates[0];
            const allDates = sessionDates.concat(backupDates);
            const lastDate = new Date(Math.max.apply(null, allDates));

            if (lastDate < today) {
                completed++;
            } else if (firstSession <= today) {
                running++;
            } else { // firstSession is in the future
                scheduled++;
            }
        });

        const summaryContainer = document.getElementById('summary-container');
        if (summaryContainer) {
            summaryContainer.innerHTML = `
                <h3>Experiment Summary</h3>
                <table style="margin: 0 auto; border-collapse: collapse; width: 300px;">
                    <tbody>
                        <tr><td style="text-align: left; padding: 5px;">Currently running:</td><td style="text-align: right; padding: 5px;">${running}</td></tr>
                        <tr><td style="text-align: left; padding: 5px;">Completed ppts:</td><td style="text-align: right; padding: 5px;">${completed}</td></tr>
                        <tr><td style="text-align: left; padding: 5px;">Dropouts:</td><td style="text-align: right; padding: 5px;">${dropouts}</td></tr>
                        <tr><td style="text-align: left; padding: 5px;">Scheduled:</td><td style="text-align: right; padding: 5px;">${scheduled}</td></tr>
                    </tbody>
                </table>
            `;
        }
    }

    function getChartData() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const pastSessions = allData.filter(date => date <= today);
        const futureSessions = showPreview ? allData.filter(date => date > today) : [];

        const dailyCounts = {};
        pastSessions.forEach(sessionDate => {
            const day = sessionDate.toISOString().split('T')[0];
            dailyCounts[day] = (dailyCounts[day] || 0) + 1;
        });

        const futureDailyCounts = {};
        futureSessions.forEach(sessionDate => {
            const day = sessionDate.toISOString().split('T')[0];
            futureDailyCounts[day] = (futureDailyCounts[day] || 0) + 1;
        });

        const allDates = [...pastSessions, ...futureSessions].map(d => d.toISOString().split('T')[0]);
        if (allDates.length === 0) {
            return { labels: [], cumulativeData: [], perDayData: [], futurePerDayData: [], futureCumulativeData: [] };
        }
        const uniqueDays = [...new Set(allDates)].sort();
        
        const firstDay = new Date(uniqueDays[0]);
        const lastDay = showPreview ? new Date('2025-11-30') : new Date(uniqueDays[uniqueDays.length - 1]);

        const labels = [];
        const cumulativeData = [];
        const perDayData = [];
        const futurePerDayData = [];
        const futureCumulativeData = [];
        
        let pastCumulativeTotal = pastSessions.length;
        let runningPastCumulative = 0;
        let runningFutureCumulative = pastCumulativeTotal;

        for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
            const dayString = d.toISOString().split('T')[0];
            labels.push(dayString);

            const pastCount = dailyCounts[dayString] || 0;
            const futureCount = futureDailyCounts[dayString] || 0;

            perDayData.push(pastCount);
            futurePerDayData.push(futureCount);

            runningPastCumulative += pastCount;
            cumulativeData.push(pastCount > 0 ? runningPastCumulative : NaN);

            if (d > today && futureCount > 0) {
                runningFutureCumulative += futureCount;
                futureCumulativeData.push(runningFutureCumulative);
            } else {
                futureCumulativeData.push(NaN);
            }
        }
        
        const todayStr = today.toISOString().split('T')[0];
        const todayIndex = labels.indexOf(todayStr);
        if (todayIndex !== -1) {
            futureCumulativeData[todayIndex] = runningPastCumulative;
        }

        return { labels, cumulativeData, perDayData, futurePerDayData, futureCumulativeData, todayStr };
    }

    function createCharts() {
        const { labels, cumulativeData, perDayData, futurePerDayData, futureCumulativeData, todayStr } = getChartData();

        const completedSessionsCtx = document.getElementById('completedSessionsChart').getContext('2d');
        completedSessionsChart = new Chart(completedSessionsCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Cumulative Completed Sessions',
                        data: cumulativeData,
                        borderColor: 'rgba(54, 162, 235, 1)',
                        backgroundColor: 'rgba(54, 162, 235, 0.2)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                        spanGaps: true
                    },
                    {
                        label: 'Cumulative Planned Sessions',
                        data: futureCumulativeData,
                        borderColor: 'rgba(201, 203, 207, 1)',
                        backgroundColor: 'rgba(201, 203, 207, 0.2)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                        spanGaps: true
                    }
                ]
            },
            options: getChartOptions('Completed & Planned Sessions Over Time (Cumulative)', 'Total Sessions', todayStr, true)
        });

        const sessionsPerDayCtx = document.getElementById('sessionsPerDayChart').getContext('2d');
        sessionsPerDayChart = new Chart(sessionsPerDayCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Completed Sessions',
                        data: perDayData,
                        backgroundColor: 'rgba(75, 192, 75, 0.6)',
                        borderColor: 'rgba(75, 192, 75, 1)',
                        borderWidth: 1,
                    },
                    {
                        label: 'Future Sessions',
                        data: futurePerDayData,
                        backgroundColor: 'rgba(201, 203, 207, 0.6)',
                        borderColor: 'rgba(201, 203, 207, 1)',
                        borderWidth: 1,
                    }
                ]
            },
            options: getChartOptions('Sessions per Day', 'Number of Sessions', todayStr, false, true)
        });
    }

    function updateCharts() {
        const { labels, cumulativeData, perDayData, futurePerDayData, futureCumulativeData, todayStr } = getChartData();
        
        completedSessionsChart.data.labels = labels;
        completedSessionsChart.data.datasets[0].data = cumulativeData;
        completedSessionsChart.data.datasets[1].data = futureCumulativeData;
        completedSessionsChart.options.plugins.annotation.annotations.line1.xMin = todayStr;
        completedSessionsChart.options.plugins.annotation.annotations.line1.xMax = todayStr;
        completedSessionsChart.update();

        sessionsPerDayChart.data.labels = labels;
        sessionsPerDayChart.data.datasets[0].data = perDayData;
        sessionsPerDayChart.data.datasets[1].data = futurePerDayData;
        sessionsPerDayChart.options.plugins.annotation.annotations.line1.xMin = todayStr;
        sessionsPerDayChart.options.plugins.annotation.annotations.line1.xMax = todayStr;
        sessionsPerDayChart.update();
    }

    function getChartOptions(titleText, yAxisLabel, todayStr, showLegend, isStacked = false) {
        return {
            scales: {
                x: {
                    stacked: isStacked,
                    type: 'time',
                    time: {
                        unit: 'week', // Dynamic unit
                        displayFormats: {
                            week: 'MMM d'
                        }
                    },
                    grid: { color: 'rgba(0, 0, 0, 0.05)' },
                    ticks: {
                        autoSkip: true,
                        maxTicksLimit: 20 // Limit number of ticks
                    },
                    title: { display: true, text: 'Date' }
                },
                y: {
                    stacked: isStacked,
                    beginAtZero: true,
                    max: isStacked ? 15 : undefined,
                    grid: { color: 'rgba(0, 0, 0, 0.05)' },
                    title: { display: true, text: yAxisLabel },
                    ticks: { stepSize: 1 }
                }
            },
            plugins: {
                title: { display: true, text: titleText },
                legend: { display: showLegend },
                annotation: {
                    annotations: {
                        line1: {
                            type: 'line',
                            xMin: todayStr,
                            xMax: todayStr,
                            borderColor: 'rgb(255, 99, 132)',
                            borderWidth: 2,
                            label: {
                                content: 'Today',
                                enabled: true,
                                position: 'start'
                            }
                        }
                    }
                }
            }
        };
    }

    initializeSupabase();
});