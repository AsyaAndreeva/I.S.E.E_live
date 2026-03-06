// I.S.E.E. Dashboard Controller

// Endpoints
const _0x4f2 = "aHR0cHM6Ly91cy1jZW50cmFsMS1pc2VlLTQ4NDIxNS5jbG91ZGZ1bmN0aW9ucy5uZXQvZmxvb2QtbGl2ZQ==";
const API_URL = atob(_0x4f2); // flood-live (for manual force-refresh only)
const LATEST_URL = 'https://us-central1-isee-484215.cloudfunctions.net/flood-latest'; // instant cached read

const SCAN_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours

// DOM Elements
const els = {
    statusBadge: document.getElementById('connection-status'),
    statusDot: document.querySelector('.dot'),
    hero: document.getElementById('hero-section'),
    mainStatus: document.getElementById('main-status'),
    lastUpdated: document.getElementById('last-updated'),
    warningsList: document.getElementById('warnings-list'),
    scanTime: document.getElementById('scan-time'),
    locCount: document.getElementById('locations-count'),
    dataSource: document.getElementById('data-source'),
    apiProgress: document.getElementById('api-progress'),
    apiCalls: document.getElementById('api-calls'),
    apiPercent: document.getElementById('api-percent'),
    refreshBtn: document.getElementById('refresh-btn'),
    nextScanEl: document.getElementById('next-scan-countdown')
};

// Application State
let isLoading = false;
let nextScanTime = null;
let countdownTimer = null;

// Initialize — load cached data, no live scan on page load
document.addEventListener('DOMContentLoaded', () => {
    loadCachedData();
    startCountdownTicker();
});

// Load the latest cached prediction from GCS (instant, no scanning)
async function loadCachedData() {
    if (isLoading) return;
    setLoading(true);

    try {
        const response = await fetch(`${LATEST_URL}?t=${Date.now()}`);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

        const data = await response.json();

        if (data.status === 'no_data') {
            // No scan has run yet — trigger the first scan automatically
            els.mainStatus.textContent = 'INITIALISING FIRST SCAN...';
            els.lastUpdated.textContent = 'Running first scan now, this may take 2–3 minutes';
            setConnected(true);
            setLoading(false);
            // Kick off a real scan immediately
            fetchData();
            return;
        }

        if (data.status === 'success' || data.warnings) {
            updateDashboard(data);
            setConnected(true);

            if (data.next_scan) {
                nextScanTime = new Date(data.next_scan);
            } else if (data.timestamp) {
                // Fallback to 12 hours if next_scan not provided
                nextScanTime = new Date(new Date(data.timestamp).getTime() + SCAN_INTERVAL_MS);
            }
        } else {
            throw new Error('Invalid data format received');
        }

    } catch (error) {
        console.error('Fetch error:', error);
        handleError(error);
        setConnected(false);
    } finally {
        setLoading(false);
    }
}

// Force a live scan (manual override — takes 2-3 min)
async function fetchData() {
    if (isLoading) return;
    setLoading(true);
    els.mainStatus.textContent = 'SCANNING REGIONS...';

    try {
        const response = await fetch(`${API_URL}?limit=264&t=${Date.now()}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        const data = await response.json();

        if (data.status === 'success' || data.warnings) {
            updateDashboard(data);
            setConnected(true);
            // After a live scan, next scan is 12 hours from now
            nextScanTime = new Date(Date.now() + SCAN_INTERVAL_MS);
        } else {
            throw new Error('Invalid data format received');
        }

    } catch (error) {
        console.error('Fetch error:', error);
        handleError(error);
        setConnected(false);
    } finally {
        setLoading(false);
    }
}

// --- Countdown Clock ---
function startCountdownTicker() {
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(updateCountdown, 1000);
    updateCountdown();
}

function updateCountdown() {
    if (!els.nextScanEl) return;
    if (!nextScanTime) {
        els.nextScanEl.textContent = '--:--:--';
        return;
    }

    const now = Date.now();
    const diff = nextScanTime.getTime() - now;

    if (diff <= 0) {
        els.nextScanEl.textContent = 'SCANNING NOW...';
        // Auto-trigger scan if not already loading
        if (!isLoading) {
            console.log("⏰ Countdown expired. Forcing automatic rescan...");
            fetchData();
        }
        return;
    }
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    // Dynamic countdown label
    const totalMinutes = Math.round(diff / 60000);

    if (totalMinutes <= 0) {
        els.nextScanEl.textContent = 'SCANNING NOW...';
        if (!isLoading) {
            console.log("⏰ Countdown expired. Forcing automatic rescan...");
            fetchData();
        }
        return;
    }

    if (totalMinutes < 60) {
        els.nextScanEl.textContent = `${totalMinutes}min until next scan`;
        els.nextScanEl.style.color = '#facc15'; // Yellow when close
    } else {
        els.nextScanEl.textContent = `${totalMinutes}min until next scan`;
        els.nextScanEl.style.color = 'var(--accent-color)';
    }
}

function updateDashboard(data) {
    const warnings = data.warnings || [];
    const highRiskCount = data.scan_stats ? data.scan_stats.high_risk : warnings.filter(w => w.risk >= 35).length;

    els.hero.className = 'hero';
    if (highRiskCount > 0) {
        els.hero.classList.add('danger');
        els.mainStatus.textContent = `${highRiskCount} SEVERE THREATS`;
    } else if (warnings.length > 0) {
        els.hero.classList.add('warning');
        els.mainStatus.textContent = `${warnings.length} ACTIVE RISKS`;
    } else {
        els.mainStatus.textContent = 'SECTOR CLEAR';
    }

    // Show actual scan time, not page load time
    if (data.timestamp) {
        const scanDate = new Date(data.timestamp);
        const apiUpdateText = data.api_last_update ? `<br><small style="opacity:0.7">API LAST UPDATED: ${data.api_last_update.replace('T', ' ')}</small>` : '';
        els.lastUpdated.innerHTML = `LAST SCAN: ${scanDate.toLocaleDateString()} ${scanDate.toLocaleTimeString()} ${apiUpdateText} <br><span style="color:#facc15; font-weight:bold; font-size: 0.9em;">FORECAST WINDOW: NEXT 48 HOURS</span>`;
        els.scanTime.textContent = scanDate.toLocaleTimeString();
    }

    els.warningsList.innerHTML = '';

    if (warnings.length === 0) {
        els.warningsList.innerHTML = '<div class="empty-state">✅ NO ANOMALIES DETECTED</div>';
    } else {
        warnings.forEach(w => {
            const div = document.createElement('div');
            div.className = 'warning-item';

            let tierClass = 'minor';
            let tierLabel = 'MINOR';
            if (w.risk >= 35) { tierClass = 'severe'; tierLabel = 'SEVERE'; }
            else if (w.risk >= 15) { tierClass = 'moderate'; tierLabel = 'MODERATE'; }

            div.innerHTML = `
                <div class="warning-info">
                    <strong>${(w.location || 'Unknown').toUpperCase()} <span class="badge ${tierClass}">${tierLabel}</span></strong>
                    <div class="ensemble-breakdown">
                        <div>STD_MODULE: <span>${w.details?.std !== undefined ? w.details.std + '%' : 'N/A'}</span></div>
                        <div>MIN_SENSITIVE: <span>${w.details?.min !== undefined ? w.details.min + '%' : 'N/A'}</span></div>
                        <div>GNN_SPATIAL: <span>${w.details?.gnn !== undefined ? w.details.gnn + '%' : 'N/A'}</span></div>
                    </div>
                    <div class="weather-meta">
                        <span>RAIN_INDEX: ${w.rain_mm !== undefined ? w.rain_mm.toFixed(1) + 'MM' : 'N/A'}</span>
                        <span>TEMP_ENV: ${w.temp_c !== undefined ? w.temp_c.toFixed(1) + '°C' : 'N/A'}</span>
                    </div>
                    <div class="ai-reasoning" style="margin-top: 6px; font-size: 0.85em; opacity: 0.8; color: #cbd5e1; border-top: 1px dashed rgba(255,255,255,0.2); padding-top: 6px;">
                        <em>AI Analysis: ${w.explanation || 'No details provided'}</em>
                    </div>
                </div>
                <div class="risk-score-badge ${tierClass}">
                    ${w.risk !== undefined ? w.risk.toFixed(1) + '%' : 'N/A'}
                </div>
            `;
            els.warningsList.appendChild(div);
        });
    }

    els.locCount.textContent = data.scan_stats ? data.scan_stats.total : '264';
    els.dataSource.textContent = 'ISEE_ENSEMBLE_V3';

    const fakePercent = 0.3;
    els.apiProgress.style.width = `${fakePercent}%`;
    els.apiCalls.textContent = `156 / 50000 REQ`;
    els.apiPercent.textContent = `${fakePercent}%`;
}

function handleError(error) {
    els.mainStatus.textContent = 'Connection Error';
    els.mainStatus.style.color = '#f59e0b';
    els.lastUpdated.textContent = `Error: ${error.message}`;
    els.statusBadge.innerHTML = '<span class="dot red"></span> Offline';
}

function setConnected(isConnected) {
    if (isConnected) {
        els.statusBadge.innerHTML = '<span class="dot green"></span> Live';
    } else {
        els.statusBadge.innerHTML = '<span class="dot red"></span> Offline';
    }
}

function setLoading(loading) {
    isLoading = loading;
    if (loading) {
        els.refreshBtn.textContent = 'Refreshing...';
        els.refreshBtn.style.opacity = '0.7';
        els.statusBadge.innerHTML = '<span class="dot"></span> Updating...';
    } else {
        els.refreshBtn.textContent = 'FORCE RE-SCAN';
        els.refreshBtn.style.opacity = '1';
    }
}
