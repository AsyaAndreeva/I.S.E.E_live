// I.S.E.E. Dashboard Controller

// System Config (Obscured)
const _0x4f2 = "aHR0cHM6Ly91cy1jZW50cmFsMS1pc2VlLTQ4NDIxNS5jbG91ZGZ1bmN0aW9ucy5uZXQvZmxvb2QtbGl2ZQ==";
const API_URL = atob(_0x4f2);

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
    refreshBtn: document.getElementById('refresh-btn')
};

// Application State
let isLoading = false;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    // Auto-refresh every 6 hours
    setInterval(fetchData, 21600000); // 6 hours
});

async function fetchData() {
    if (isLoading) return;
    setLoading(true);

    try {
        console.log(`Fetching data from ${API_URL}...`);

        // Add timestamp to prevent caching
        const response = await fetch(`${API_URL}?t=${Date.now()}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

        const data = await response.json();
        // Handle both direct list or wrapped object
        const result = data.status === 'success' || data.municipalities ? data : null;

        if (result) {
            updateDashboard(result);
            setConnected(true);
        } else {
            throw new Error('Invalid data format received');
        }

    } catch (error) {
        console.error("Fetch error:", error);
        handleError(error);
        setConnected(false);
    } finally {
        setLoading(false);
    }
}

function updateDashboard(data) {
    // 1. Update Hero Status
    const warnings = data.warnings || [];
    const highRiskCount = data.scan_stats ? data.scan_stats.high_risk : warnings.filter(w => w.risk >= 35).length;

    els.hero.className = "hero";
    if (highRiskCount > 0) {
        els.hero.classList.add("danger");
        els.mainStatus.textContent = `${highRiskCount} SEVERE THREATS`;
    } else if (warnings.length > 0) {
        els.hero.classList.add("warning");
        els.mainStatus.textContent = `${warnings.length} ACTIVE RISKS`;
    } else {
        els.mainStatus.textContent = "SECTOR CLEAR";
    }

    els.lastUpdated.textContent = `LAST CAPTURE: ${new Date().toLocaleTimeString()}`;

    // 2. Update Warnings List
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
                    <strong>${w.location.toUpperCase()} <span class="badge ${tierClass}">${tierLabel}</span></strong>
                    <div class="ensemble-breakdown">
                        <div>STD_MODULE: <span>${w.details.std}%</span></div>
                        <div>MIN_SENSITIVE: <span>${w.details.min}%</span></div>
                        <div>GNN_SPATIAL: <span>${w.details.gnn}%</span></div>
                    </div>
                    <div class="weather-meta">
                        <span>RAIN_INDEX: ${w.rain_mm.toFixed(1)}MM</span>
                        <span>TEMP_ENV: ${w.temp_c.toFixed(1)}°C</span>
                    </div>
                </div>
                <div class="risk-score-badge ${tierClass}">
                    ${w.risk.toFixed(1)}%
                </div>
            `;
            els.warningsList.appendChild(div);
        });
    }

    // 3. Update Stats
    if (data.timestamp) {
        els.scanTime.textContent = new Date(data.timestamp).toLocaleTimeString();
    }
    els.locCount.textContent = data.scan_stats ? data.scan_stats.total : "264";
    els.dataSource.textContent = "ISEE_ENSEMBLE_V3";

    // 4. Update API Usage
    const fakePercent = 0.3;
    els.apiProgress.style.width = `${fakePercent}%`;
    els.apiCalls.textContent = `156 / 50000 REQ`;
    els.apiPercent.textContent = `${fakePercent}%`;
}

function handleError(error) {
    els.mainStatus.textContent = "Connection Error";
    els.mainStatus.style.color = "#f59e0b"; // Orange
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
        els.refreshBtn.textContent = "Refreshing...";
        els.refreshBtn.style.opacity = "0.7";
        els.statusBadge.innerHTML = '<span class="dot"></span> Updating...';
    } else {
        els.refreshBtn.textContent = "Refresh Data";
        els.refreshBtn.style.opacity = "1";
    }
}
