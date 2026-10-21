// --- CHART SETUP ---
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.color = '#6B7280';

let npkChart, mtChart;
try {
    npkChart = new Chart(document.getElementById('npkChart'), {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'N', data: [], backgroundColor: '#3B82F6', borderRadius: 4 }, { label: 'P', data: [], backgroundColor: '#8B5CF6', borderRadius: 4 }, { label: 'K', data: [], backgroundColor: '#F59E0B', borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
    mtChart = new Chart(document.getElementById('mtChart'), {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Moisture', data: [], backgroundColor: '#06B6D4', borderRadius: 4, yAxisID: 'y' }, { label: 'Temp', data: [], backgroundColor: '#EF4444', borderRadius: 4, yAxisID: 'y1' }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { position: 'left' }, y1: { position: 'right', grid: { drawOnChartArea: false } } } }
    });
} catch(e) { console.log("Chart initialization delayed"); }

const API_BASE = 'http://localhost:3000/api';

function toggleAuth() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const btnShowRegister = document.getElementById('btn-show-register');
    const btnShowLogin = document.getElementById('btn-show-login');

    if (loginForm.classList.contains('hidden')) {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        btnShowRegister.classList.remove('hidden');
        btnShowLogin.classList.add('hidden');
    } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        btnShowRegister.classList.add('hidden');
        btnShowLogin.classList.remove('hidden');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    
    // Toggle Events
    document.getElementById('btn-show-register').addEventListener('click', (e) => { e.preventDefault(); toggleAuth(); });
    document.getElementById('btn-show-login').addEventListener('click', (e) => { e.preventDefault(); toggleAuth(); });

    // Registration
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        const role = document.getElementById('reg-role').value;

        try {
            const response = await fetch(`${API_BASE}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, role })
            });
            const data = await response.json();
            
            if (response.ok) {
                alert('Registration successful! Please log in.');
                toggleAuth(); 
            } else {
                alert(data.error || 'Registration failed.');
            }
        } catch (err) {
            alert('Cannot connect to backend server.');
        }
    });

    // Login
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await fetch(`${API_BASE}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('agrosphere_token', data.token);
                localStorage.setItem('agrosphere_role', data.user.role);
                
                if (data.user.role === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    document.getElementById('auth-screen').classList.add('hidden');
                    fetchLiveData(); 
                }
            } else {
                alert(data.error || 'Invalid credentials');
            }
        } catch (err) {
            alert('Cannot connect to backend server.');
        }
    });

    // Logout Button Logic
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('agrosphere_token');
            localStorage.removeItem('agrosphere_role');
            window.location.reload();
        });
    }

    // Auth Check on Load
    const token = localStorage.getItem('agrosphere_token');
    const role = localStorage.getItem('agrosphere_role');
    
    if (token && role === 'admin') {
        window.location.href = 'admin.html';
    } else if (token && role === 'farmer') {
        document.getElementById('auth-screen').classList.add('hidden');
        fetchLiveData(); 
    }
});

// --- COMPONENT 4 NOVELTY LOGIC ---
let isOnline = true;
let localBuffer = []; 
const API_URL = 'http://localhost:3000/api/sensors/latest';

function toggleNetwork() {
    isOnline = !isOnline;
    const btn = document.getElementById('simulate-btn');
    const statusPill = document.getElementById('network-status');
    const dot = document.getElementById('network-dot');
    const cloudText = document.getElementById('cloud-status-text');

    if (!isOnline) {
        btn.innerHTML = '<i class="fa-solid fa-wifi text-green-400 mr-2"></i> Restore Network';
        btn.classList.replace('bg-gray-800', 'bg-red-600');
        statusPill.className = "bg-red-100 text-red-700 text-xs px-3 py-1.5 rounded-full flex items-center gap-2 font-semibold transition-colors duration-300";
        dot.className = "w-2 h-2 bg-red-500 rounded-full animate-pulse";
        statusPill.innerHTML = '<span id="network-dot" class="w-2 h-2 bg-red-500 rounded-full"></span> Offline (Buffering)';
        cloudText.innerText = "Disconnected";
        cloudText.className = "text-xs font-semibold text-red-600";
    } else {
        btn.innerHTML = '<i class="fa-solid fa-wifi text-red-400 mr-2"></i> Simulate Offline';
        btn.classList.replace('bg-red-600', 'bg-gray-800');
        statusPill.className = "bg-green-100 text-green-700 text-xs px-3 py-1.5 rounded-full flex items-center gap-2 font-semibold transition-colors duration-300";
        dot.className = "w-2 h-2 bg-green-500 rounded-full animate-pulse";
        statusPill.innerHTML = '<span id="network-dot" class="w-2 h-2 bg-green-500 rounded-full"></span> Cloud Connected';
        cloudText.innerText = "Connected";
        cloudText.className = "text-xs font-semibold text-green-600";
        syncBufferedData(); 
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const simulateBtn = document.getElementById('simulate-btn');
    if (simulateBtn) {
        simulateBtn.addEventListener('click', toggleNetwork);
    }
});

async function syncBufferedData() {
    if (localBuffer.length === 0) return;
    const token = localStorage.getItem('agrosphere_token');
    if(!token) return;

    for (let reading of localBuffer) {
        try {
            await fetch('http://localhost:3000/api/sensors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reading)
            });
        } catch(e) { console.log("Sync error", e); }
    }
    localBuffer = [];
    updateBufferUI();
    alert(`✅ Sync Complete: Buffered records successfully uploaded to MySQL!`);
}

function updateBufferUI() {
    const bufferText = document.getElementById('buffer-status-text');
    if (localBuffer.length > 0) {
        bufferText.innerText = `${localBuffer.length} pending records`;
        bufferText.className = "text-xs font-semibold text-orange-500 animate-pulse";
    } else {
        bufferText.innerText = `0 records`;
        bufferText.className = "text-xs font-semibold text-gray-500";
    }
}

// 🟢 FETCH SENSOR DATA (UPDATED FOR ALL 6 SENSORS)
async function fetchLiveData() {
    const token = localStorage.getItem('agrosphere_token');
    if (!token) return;

    try {
        if (!isOnline) {
            const mockReading = { nitrogen: 45, phosphorus: 25, potassium: 40, ec: 1.2, ph: 6.5, moisture: 55, temperature: 28 };
            localBuffer.push(mockReading);
            updateBufferUI();
            updateUIAndCharts(mockReading);
            return;
        }

        const response = await fetch(API_URL, { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });

        if (response.status === 401 || response.status === 403) {
            localStorage.clear();
            window.location.reload();
            return;
        }

        const data = await response.json();

        if (data.length > 0) {
            const latest = data[data.length - 1];
            updateUIAndCharts(latest);
            
            if(npkChart && mtChart) {
                const labels = data.map(item => new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
                npkChart.data.labels = labels;
                npkChart.data.datasets[0].data = data.map(i => i.nitrogen);
                npkChart.data.datasets[1].data = data.map(i => i.phosphorus);
                npkChart.data.datasets[2].data = data.map(i => i.potassium);
                npkChart.update();

                mtChart.data.labels = labels;
                mtChart.data.datasets[0].data = data.map(i => i.moisture);
                mtChart.data.datasets[1].data = data.map(i => i.temperature);
                mtChart.update();
            }
        }
    } catch (error) {
        console.error("API Error", error);
    }
}

// 🟢 UPDATE UI CARDS (UPDATED FOR ALL 6 SENSORS)
function updateUIAndCharts(data) {
    // Nitrogen
    document.getElementById('val-n').innerText = Math.round(data.nitrogen || 0);
    // Phosphorus
    document.getElementById('val-p').innerText = Math.round(data.phosphorus || 0);
    // Potassium
    document.getElementById('val-k').innerText = Math.round(data.potassium || 0);
    // EC
    document.getElementById('val-ec').innerText = data.ec ? parseFloat(data.ec).toFixed(2) : "0.00";
    // pH
    document.getElementById('val-ph').innerText = data.ph ? parseFloat(data.ph).toFixed(2) : "0.00";
    // Moisture
    document.getElementById('val-hum').innerText = Math.round(data.moisture || 0);
    // Temperature
    document.getElementById('val-temp').innerText = Math.round(data.temperature || 0);
    
    // Update Time
    document.getElementById('last-sync').innerText = new Date().toLocaleTimeString();
}

// Poll every 3 seconds
setInterval(fetchLiveData, 3000);