// I.S.E.E. History Controller

const HISTORY_URL = 'https://us-central1-isee-484215.cloudfunctions.net/flood-history';
const FEEDBACK_URL = 'https://us-central1-isee-484215.cloudfunctions.net/flood-feedback';

let currentDate = null;
let allPredictions = [];
let feedbackPending = { location: null, date: null };

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    loadDates();

    document.getElementById('location-search').addEventListener('input', renderPredictions);
    document.getElementById('risk-filter').addEventListener('change', renderPredictions);
    document.getElementById('feedback-filter').addEventListener('change', renderPredictions);
});

// --- LOAD AVAILABLE DATES ---
async function loadDates() {
    try {
        const resp = await fetch(HISTORY_URL);
        const data = await resp.json();
        const dates = data.dates || [];

        const container = document.getElementById('dates-list');
        if (dates.length === 0) {
            container.innerHTML = '<div class="empty-state">No historical data yet. Data will appear after the next scan.</div>';
            return;
        }

        container.innerHTML = dates.map(d => `
            <button class="date-chip" id="date-${d}" onclick="loadPredictions('${d}')">${formatDate(d)}</button>
        `).join('');

        // Auto-load most recent date
        if (dates.length > 0) {
            loadPredictions(dates[0]);
        }
    } catch (e) {
        document.getElementById('dates-list').innerHTML =
            `<div class="empty-state">⚠️ Could not load dates: ${e.message}</div>`;
    }
}

// --- LOAD PREDICTIONS FOR A DATE ---
async function loadPredictions(date) {
    currentDate = date;

    // Highlight selected date chip
    document.querySelectorAll('.date-chip').forEach(c => c.classList.remove('active'));
    const chip = document.getElementById(`date-${date}`);
    if (chip) chip.classList.add('active');

    document.getElementById('selected-date-label').textContent = formatDate(date);
    document.getElementById('predictions-panel').style.display = 'block';
    document.getElementById('predictions-table-container').innerHTML =
        '<div class="empty-state loading-state"><i class="fas fa-spinner fa-spin"></i> Loading predictions...</div>';

    try {
        const resp = await fetch(`${HISTORY_URL}?date=${date}`);
        const data = await resp.json();

        if (!data.predictions || data.predictions.length === 0) {
            document.getElementById('predictions-table-container').innerHTML =
                '<div class="empty-state">No prediction data found for this date.</div>';
            return;
        }

        allPredictions = data.predictions;
        document.getElementById('history-subtitle').textContent =
            `ARCHIVE: ${formatDate(date)} — ${data.scan_count || 1} scan(s), ${data.total_scanned} locations`;
        document.getElementById('scan-meta').textContent =
            `Scan time: ${data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : 'Unknown'}`;

        renderPredictions();

    } catch (e) {
        document.getElementById('predictions-table-container').innerHTML =
            `<div class="empty-state">⚠️ Error: ${e.message}</div>`;
    }
}

// --- RENDER TABLE ---
function renderPredictions() {
    const search = document.getElementById('location-search').value.toLowerCase();
    const riskFilter = document.getElementById('risk-filter').value;
    const feedbackFilter = document.getElementById('feedback-filter').value;

    const filtered = allPredictions.filter(p => {
        if (search && !p.location.toLowerCase().includes(search)) return false;

        if (riskFilter === 'high' && p.risk < 35) return false;
        if (riskFilter === 'moderate' && (p.risk < 15 || p.risk >= 35)) return false;
        if (riskFilter === 'low' && (p.risk < 5 || p.risk >= 15)) return false;
        if (riskFilter === 'safe' && p.risk >= 5) return false;

        const hasFeedback = p.feedback && p.feedback.flooded !== undefined;
        if (feedbackFilter === 'flooded' && (!hasFeedback || !p.feedback.flooded)) return false;
        if (feedbackFilter === 'not_flooded' && (!hasFeedback || p.feedback.flooded)) return false;
        if (feedbackFilter === 'no_feedback' && hasFeedback) return false;

        return true;
    });

    if (filtered.length === 0) {
        document.getElementById('predictions-table-container').innerHTML =
            '<div class="empty-state">No predictions match your filters.</div>';
        return;
    }

    const rows = filtered.map(p => {
        const risk = p.risk;
        let tierClass = 'safe';
        let tierLabel = 'SAFE';
        if (risk >= 35) { tierClass = 'severe'; tierLabel = 'HIGH'; }
        else if (risk >= 15) { tierClass = 'moderate'; tierLabel = 'MOD'; }
        else if (risk >= 5) { tierClass = 'minor'; tierLabel = 'LOW'; }

        const feedback = p.feedback;
        let feedbackHtml = '';
        if (feedback && feedback.flooded === true) {
            feedbackHtml = `<span class="feedback-tag flood-yes"><i class="fas fa-water"></i> FLOODED</span>`;
        } else if (feedback && feedback.flooded === false) {
            feedbackHtml = `<span class="feedback-tag flood-no"><i class="fas fa-check-circle"></i> NO FLOOD</span>`;
        } else {
            feedbackHtml = `<button class="feedback-btn" onclick="openFeedbackModal('${escapeHtml(p.location)}')">
                <i class="fas fa-comment-dots"></i> ADD FEEDBACK
            </button>`;
        }

        return `
            <tr class="pred-row ${tierClass}-row">
                <td class="location-cell">
                    <span class="location-name">${p.location}</span>
                </td>
                <td class="risk-cell">
                    <span class="risk-badge ${tierClass}">${risk.toFixed(1)}%</span>
                    <span class="tier-label ${tierClass}">${tierLabel}</span>
                </td>
                <td class="ensemble-cell">
                    <div class="mini-ensemble">
                        <span title="Standard Model">S: ${p.details?.std ?? '—'}%</span>
                        <span title="Sensitive Model">M: ${p.details?.min ?? '—'}%</span>
                        <span title="GNN Spatial">G: ${p.details?.gnn ?? '—'}%</span>
                    </div>
                </td>
                <td class="weather-cell">
                    <span><i class="fas fa-droplet"></i> ${p.rain_mm?.toFixed(1) ?? '—'}mm</span>
                    <span><i class="fas fa-temperature-half"></i> ${p.temp_c?.toFixed(1) ?? '—'}°C</span>
                </td>
                <td class="feedback-cell">${feedbackHtml}</td>
            </tr>
        `;
    }).join('');

    document.getElementById('predictions-table-container').innerHTML = `
        <table class="predictions-table">
            <thead>
                <tr>
                    <th>LOCATION</th>
                    <th>RISK SCORE</th>
                    <th>ENSEMBLE DETAILS</th>
                    <th>WEATHER</th>
                    <th>ACTUAL OUTCOME</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

// --- FEEDBACK MODAL ---
function openFeedbackModal(location) {
    feedbackPending = { location, date: currentDate };
    document.getElementById('modal-location').textContent = location;
    document.getElementById('modal-date').textContent = formatDate(currentDate);
    document.getElementById('feedback-modal').style.display = 'flex';
}

function closeFeedbackModal() {
    document.getElementById('feedback-modal').style.display = 'none';
    feedbackPending = { location: null, date: null };
}

async function submitFeedback(flooded) {
    const { location, date } = feedbackPending;
    if (!location || !date) return;

    closeFeedbackModal();

    try {
        const resp = await fetch(FEEDBACK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date, location, flooded })
        });
        const data = await resp.json();
        if (data.status === 'success') {
            // Update local data and re-render
            const pred = allPredictions.find(p => p.location === location);
            if (pred) {
                pred.feedback = { flooded, submitted_at: new Date().toISOString() };
            }
            renderPredictions();
        }
    } catch (e) {
        alert('Failed to save feedback: ' + e.message);
    }
}

// --- UTILS ---
function formatDate(dateStr) {
    if (!dateStr) return '--';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
    return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
