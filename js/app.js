// Auth Lock Security Control ("ECO")
function checkAuthSession() {
    const isAuth = sessionStorage.getItem('gm_auth_unlocked');
    const overlay = document.getElementById('authOverlay');
    if (isAuth === 'true' && overlay) {
        overlay.classList.add('unlocked');
    }
}

function handleAuthSubmit(e) {
    if (e) e.preventDefault();
    const pwdInput = document.getElementById('authPasswordInput');
    const errorMsg = document.getElementById('authErrorMsg');
    const overlay = document.getElementById('authOverlay');
    if (!pwdInput) return;

    const enteredVal = pwdInput.value.trim();

    if (enteredVal === "ECO" || enteredVal === "eco" || enteredVal === "Eco") {
        sessionStorage.setItem('gm_auth_unlocked', 'true');
        if (overlay) overlay.classList.add('unlocked');
        if (errorMsg) errorMsg.style.display = 'none';
    } else {
        pwdInput.classList.add('shake');
        setTimeout(() => pwdInput.classList.remove('shake'), 400);
        if (errorMsg) {
            errorMsg.textContent = "Contraseña incorrecta. Intente nuevamente.";
            errorMsg.style.display = "block";
        }
        pwdInput.value = "";
        pwdInput.focus();
    }
}
window.handleAuthSubmit = handleAuthSubmit;

// Global Filter State
let selectedMonth = 'ALL';
let chartInvInstance = null;
let chartVendInstance = null;
let chartCompInstance = null;

function formatCLP(val) {
    if (!val || isNaN(val)) return '$0';
    return '$' + Math.round(val).toLocaleString('es-CL');
}

function formatM(val) {
    if (!val || isNaN(val)) return '$0M';
    const m = val / 1000000;
    return '$' + (Math.round(m * 100) / 100).toFixed(2) + 'M CLP';
}

function getMonthLabel(ym) {
    if (!ym || ym === 'ALL') return 'Todos los Meses (Acumulado)';
    const parts = ym.split('-');
    if (parts.length < 2) return ym;
    const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const idx = parseInt(parts[1], 10) - 1;
    return `${monthNames[idx] || parts[1]} ${parts[0]}`;
}

function getAvailableMonths() {
    const txs = window.GRANEL_DATA ? (window.GRANEL_DATA.transacciones || []) : [];
    const monthsSet = new Set();
    txs.forEach(tx => {
        if (tx.fecha && tx.fecha.length >= 7) {
            const ym = tx.fecha.substring(0, 7);
            monthsSet.add(ym);
        }
    });
    return Array.from(monthsSet).sort();
}

function populateMonthControls() {
    const months = getAvailableMonths();
    const dashSelect = document.getElementById('dashboardMonthSelect');
    const tableSelect = document.getElementById('tableMonthFilter');
    const pillsContainer = document.getElementById('monthPillsContainer');

    const optionsHTML = `
        <option value="ALL">Todos los Meses (Consolidado)</option>
        ${months.map(m => `<option value="${m}">${getMonthLabel(m)}</option>`).join('')}
    `;

    if (dashSelect) dashSelect.innerHTML = optionsHTML;
    if (tableSelect) tableSelect.innerHTML = optionsHTML;

    if (pillsContainer) {
        let pillsHTML = `<button type="button" class="month-pill active" data-month="ALL"><i class="ri-apps-2-line"></i> Todos los Meses</button>`;
        months.forEach(m => {
            pillsHTML += `<button type="button" class="month-pill" data-month="${m}"><i class="ri-calendar-event-line"></i> ${getMonthLabel(m)}</button>`;
        });
        pillsContainer.innerHTML = pillsHTML;

        pillsContainer.querySelectorAll('.month-pill').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetBtn = e.currentTarget;
                const m = targetBtn.getAttribute('data-month');
                setMonthFilter(m);
            });
        });
    }

    if (dashSelect) {
        dashSelect.addEventListener('change', (e) => setMonthFilter(e.target.value));
    }
    if (tableSelect) {
        tableSelect.addEventListener('change', (e) => setMonthFilter(e.target.value));
    }
}

function setMonthFilter(monthVal) {
    selectedMonth = monthVal;

    const dashSelect = document.getElementById('dashboardMonthSelect');
    const tableSelect = document.getElementById('tableMonthFilter');
    if (dashSelect) dashSelect.value = monthVal;
    if (tableSelect) tableSelect.value = monthVal;

    const pillsContainer = document.getElementById('monthPillsContainer');
    if (pillsContainer) {
        pillsContainer.querySelectorAll('.month-pill').forEach(btn => {
            if (btn.getAttribute('data-month') === monthVal) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    updateDynamicKPIs();
    renderCharts();
    renderTable();
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuthSession();
    populateMonthControls();

    const btnFullscreen = document.getElementById('btnFullscreen');
    if (btnFullscreen) {
        btnFullscreen.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => console.log(err));
            } else {
                if (document.exitFullscreen) document.exitFullscreen();
            }
        });
    }

    updateDynamicKPIs();
    renderCharts();
    renderTable();
});

// Populate Dynamic KPIs across cards
function updateDynamicKPIs() {
    if (!window.GRANEL_DATA) return;
    const kpisGlobal = window.GRANEL_DATA.kpis || {};
    const allTxs = window.GRANEL_DATA.transacciones || [];

    // Timestamp Badge
    const timestampText = document.getElementById('timestampText');
    if (timestampText) {
        const now = new Date();
        const dateStr = now.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeStr = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
        timestampText.textContent = `Datos actualizados al: ${dateStr} ${timeStr} hrs`;
    }

    const filteredTxs = selectedMonth === 'ALL' 
        ? allTxs 
        : allTxs.filter(tx => tx.fecha && tx.fecha.startsWith(selectedMonth));

    let enapCount = 0;
    let enapMontoSum = 0;
    let enapLitrosSum = 0;
    let cjLitros = 0, cjMonto = 0, cjOps = 0;
    let tripLitros = 0, tripMonto = 0, tripOps = 0;
    let extraccionesSum = 0;
    let ventasLitrosSum = 0, ventasMontoSum = 0;
    let comisionesPagadas = 0, comisionesPendientes = 0;

    filteredTxs.forEach(tx => {
        const v = tx.vendedor || '';
        const c = tx.cliente || '';
        const obs = tx.observacion || '';
        const det = tx.detalles || '';

        if (v.includes('ENAP') || c.includes('ENAP') || det.includes('Guía') || obs.includes('Guía')) {
            enapCount++;
            if (tx.total > 0) enapMontoSum += tx.total;
            if (tx.litros > 0) enapLitrosSum += tx.litros;
        } else if (v.includes('Ignacio') || c.includes('Ignacio')) {
            extraccionesSum += tx.litros;
        } else if (v.includes('Tripulacion') || c.includes('Tripulacion')) {
            tripLitros += tx.litros;
            tripMonto += tx.total;
            tripOps++;
            ventasLitrosSum += tx.litros;
            ventasMontoSum += tx.total;
        } else {
            cjLitros += tx.litros;
            cjMonto += tx.total;
            cjOps++;
            ventasLitrosSum += tx.litros;
            ventasMontoSum += tx.total;

            if (tx.comision > 0) {
                if (obs.includes('Pagada') || tx.medioPago.includes('Tarjeta') || tx.medioPago.includes('Pagado')) {
                    comisionesPagadas += tx.comision;
                } else {
                    comisionesPendientes += tx.comision;
                }
            }
        }
    });

    const comprasL = selectedMonth === 'ALL' ? (kpisGlobal.comprasLitros || enapLitrosSum) : enapLitrosSum;
    const comprasMonto = selectedMonth === 'ALL' ? (kpisGlobal.montoCompras || enapMontoSum) : enapMontoSum;
    const guiCount = enapCount;

    const ventasL = selectedMonth === 'ALL' ? (kpisGlobal.ventasLitros || ventasLitrosSum) : ventasLitrosSum;
    const ventasMonto = selectedMonth === 'ALL' ? (kpisGlobal.montoVentas || ventasMontoSum) : ventasMontoSum;
    const extraccionesL = selectedMonth === 'ALL' ? (kpisGlobal.extraccionesLitros || extraccionesSum) : extraccionesSum;
    const stockSaldo = selectedMonth === 'ALL' ? (kpisGlobal.stockSaldoLitros || (comprasL - ventasL - extraccionesL)) : (comprasL - ventasL - extraccionesL);

    const costoPromL = comprasL > 0 ? (comprasMonto / comprasL) : (kpisGlobal.costoPromedioLitro || 333.46);
    const precioPromL = ventasL > 0 ? (ventasMonto / ventasL) : (kpisGlobal.precioPromedioVentaLitro || 845.59);
    const margenPromL = precioPromL - costoPromL;
    const pctMargen = precioPromL > 0 ? ((margenPromL / precioPromL) * 100) : 60.6;

    // Top Row 4 KPI Cards
    const valCompras = document.getElementById('valCompras');
    if (valCompras) valCompras.textContent = `${comprasL.toLocaleString('es-CL')} L`;

    const badgeGuias = document.getElementById('badgeGuias');
    if (badgeGuias) badgeGuias.textContent = `${guiCount} Guías`;

    const valMontoCompras = document.getElementById('valMontoCompras');
    if (valMontoCompras) valMontoCompras.textContent = formatM(comprasMonto);

    const valStock = document.getElementById('valStock');
    if (valStock) valStock.textContent = `${stockSaldo.toLocaleString('es-CL')} L`;

    const valVentas = document.getElementById('valVentas');
    if (valVentas) valVentas.textContent = formatCLP(ventasMonto);

    const badgeVentasLitros = document.getElementById('badgeVentasLitros');
    if (badgeVentasLitros) badgeVentasLitros.textContent = `${ventasL.toLocaleString('es-CL')} Litros`;

    const valMargen = document.getElementById('valMargenPct') || document.getElementById('valMargen');
    if (valMargen) valMargen.textContent = `${pctMargen.toFixed(1)}%`;

    const badgeSpreadUnit = document.getElementById('badgeSpreadUnit');
    if (badgeSpreadUnit) badgeSpreadUnit.textContent = `+$${margenPromL.toFixed(2)} / L`;

    // Col 1 Summary Texts
    const txtVentasL = document.getElementById('txtVentasL');
    if (txtVentasL) txtVentasL.textContent = `${ventasL.toLocaleString('es-CL')} L`;

    const txtExtraccionesL = document.getElementById('txtExtraccionesL');
    if (txtExtraccionesL) txtExtraccionesL.textContent = `${extraccionesL.toLocaleString('es-CL')} L`;

    const txtStockL = document.getElementById('txtStockL');
    if (txtStockL) txtStockL.textContent = `${stockSaldo.toLocaleString('es-CL')} L`;

    // Col 2 Channel Stat Rows
    const txtCjOps = document.getElementById('txtCjOps');
    if (txtCjOps) txtCjOps.textContent = `${cjOps} Operaciones`;

    const txtCjLitros = document.getElementById('txtCjLitros');
    if (txtCjLitros) txtCjLitros.textContent = `${cjLitros.toLocaleString('es-CL')} L`;

    const txtCjMonto = document.getElementById('txtCjMonto');
    if (txtCjMonto) txtCjMonto.textContent = formatM(cjMonto);

    const txtTripOps = document.getElementById('txtTripOps');
    if (txtTripOps) txtTripOps.textContent = `${tripOps} Operaciones`;

    const txtTripLitros = document.getElementById('txtTripLitros');
    if (txtTripLitros) txtTripLitros.textContent = `${tripLitros.toLocaleString('es-CL')} L`;

    const txtTripMonto = document.getElementById('txtTripMonto');
    if (txtTripMonto) txtTripMonto.textContent = formatCLP(tripMonto);

    // Col 3 Spread & Unit Metrics
    const txtCostoUnit = document.getElementById('txtCostoUnit');
    if (txtCostoUnit) txtCostoUnit.textContent = `$${costoPromL.toFixed(2)}/L`;

    const txtPrecioUnit = document.getElementById('txtPrecioUnit');
    if (txtPrecioUnit) txtPrecioUnit.textContent = `$${precioPromL.toFixed(2)}/L`;

    const txtSpreadUnit = document.getElementById('txtSpreadUnit');
    if (txtSpreadUnit) txtSpreadUnit.textContent = `+$${margenPromL.toFixed(2)} / Litro (${pctMargen.toFixed(1)}%)`;

    const txtComisionesPendientes = document.getElementById('txtComisionesPendientes');
    if (txtComisionesPendientes) txtComisionesPendientes.textContent = `${formatCLP(comisionesPendientes)} Pendiente`;

    // Comisiones Progress Bar
    const totalCom = comisionesPagadas + comisionesPendientes;
    const barPagadas = document.getElementById('barComisionesPagadas');
    const barPendientes = document.getElementById('barComisionesPendientes');
    if (barPagadas && barPendientes) {
        if (totalCom > 0) {
            const pctPagado = ((comisionesPagadas / totalCom) * 100).toFixed(1);
            const pctPendiente = (100 - pctPagado).toFixed(1);
            barPagadas.style.width = `${pctPagado}%`;
            barPagadas.textContent = `${pctPagado}% Pagado (${formatCLP(comisionesPagadas)})`;
            barPendientes.style.width = `${pctPendiente}%`;
            barPendientes.textContent = `${pctPendiente}% Pendiente (${formatCLP(comisionesPendientes)})`;
        } else {
            barPagadas.style.width = '100%';
            barPagadas.textContent = 'Sin comisiones registradas';
            barPendientes.style.width = '0%';
            barPendientes.textContent = '';
        }
    }
}

// Chart.js Renderers
function renderCharts() {
    if (!window.GRANEL_DATA) return;
    const allTxs = window.GRANEL_DATA.transacciones || [];
    const filteredTxs = selectedMonth === 'ALL' 
        ? allTxs 
        : allTxs.filter(tx => tx.fecha && tx.fecha.startsWith(selectedMonth));

    let ventasLitrosSum = 0;
    let extraccionesSum = 0;
    let comprasLitrosSum = 0;
    let cjLitros = 0;
    let tripLitros = 0;

    filteredTxs.forEach(tx => {
        const v = tx.vendedor || '';
        const c = tx.cliente || '';
        const obs = tx.observacion || '';
        const det = tx.detalles || '';

        if (v.includes('ENAP') || c.includes('ENAP') || det.includes('Guía') || obs.includes('Guía')) {
            if (tx.litros > 0) comprasLitrosSum += tx.litros;
        } else if (v.includes('Ignacio') || c.includes('Ignacio')) {
            extraccionesSum += tx.litros;
        } else if (v.includes('Tripulacion') || c.includes('Tripulacion')) {
            tripLitros += tx.litros;
            ventasLitrosSum += tx.litros;
        } else {
            cjLitros += tx.litros;
            ventasLitrosSum += tx.litros;
        }
    });

    const stockSaldo = comprasLitrosSum - ventasLitrosSum - extraccionesSum;

    // Chart 1: Inventario Donut
    const ctxInvEl = document.getElementById('chartInventario');
    if (ctxInvEl) {
        if (chartInvInstance) chartInvInstance.destroy();
        const ctxInv = ctxInvEl.getContext('2d');
        chartInvInstance = new Chart(ctxInv, {
            type: 'doughnut',
            data: {
                labels: ['Ventas Comerciales', 'Extracciones (Ignacio)', 'Stock Almacén'],
                datasets: [{
                    data: [
                        ventasLitrosSum, 
                        extraccionesSum, 
                        stockSaldo > 0 ? stockSaldo : 0
                    ],
                    backgroundColor: ['#10b981', '#ef4444', '#00f2fe'],
                    borderWidth: 0,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11, family: 'Inter' } } }
                },
                cutout: '70%'
            }
        });
    }

    // Chart 2: Vendedores Pie
    const ctxVendEl = document.getElementById('chartVendedores');
    if (ctxVendEl) {
        if (chartVendInstance) chartVendInstance.destroy();
        const ctxVend = ctxVendEl.getContext('2d');

        const totalVend = cjLitros + tripLitros;
        const cjPct = totalVend > 0 ? ((cjLitros / totalVend) * 100).toFixed(1) : 0;
        const tripPct = totalVend > 0 ? ((tripLitros / totalVend) * 100).toFixed(1) : 0;

        chartVendInstance = new Chart(ctxVend, {
            type: 'pie',
            data: {
                labels: [`Canal CJ (${cjPct}%)`, `Tripulación (${tripPct}%)`],
                datasets: [{
                    data: [cjLitros, tripLitros],
                    backgroundColor: ['#00f2fe', '#f59e0b'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11, family: 'Inter' } } }
                }
            }
        });
    }

    // Chart 3: Monthly Comparison Chart
    renderMonthlyComparisonChart();
}

function renderMonthlyComparisonChart() {
    const ctxCompEl = document.getElementById('chartComparativa');
    if (!ctxCompEl || !window.GRANEL_DATA) return;

    if (chartCompInstance) {
        chartCompInstance.destroy();
    }

    const txs = window.GRANEL_DATA.transacciones || [];
    const months = getAvailableMonths();

    const ventasByMonth = {};
    const comprasByMonth = {};
    const litrosByMonth = {};

    months.forEach(m => {
        ventasByMonth[m] = 0;
        comprasByMonth[m] = 0;
        litrosByMonth[m] = 0;
    });

    txs.forEach(tx => {
        if (tx.fecha && tx.fecha.length >= 7) {
            const ym = tx.fecha.substring(0, 7);
            if (ventasByMonth.hasOwnProperty(ym)) {
                const v = tx.vendedor || '';
                const c = tx.cliente || '';
                const obs = tx.observacion || '';
                const det = tx.detalles || '';

                if (v.includes('ENAP') || c.includes('ENAP') || det.includes('Guía') || obs.includes('Guía')) {
                    if (tx.total > 0) comprasByMonth[ym] += tx.total;
                } else if (!v.includes('Ignacio') && !c.includes('Ignacio')) {
                    ventasByMonth[ym] += tx.total;
                    litrosByMonth[ym] += tx.litros;
                }
            }
        }
    });

    const labels = months.map(m => getMonthLabel(m));
    const dataVentas = months.map(m => ventasByMonth[m]);
    const dataCompras = months.map(m => comprasByMonth[m]);
    const dataLitros = months.map(m => litrosByMonth[m]);

    const ctxComp = ctxCompEl.getContext('2d');
    chartCompInstance = new Chart(ctxComp, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Ventas Recaudadas ($ CLP)',
                    data: dataVentas,
                    backgroundColor: 'rgba(16, 185, 129, 0.75)',
                    borderColor: '#10b981',
                    borderWidth: 1,
                    borderRadius: 6,
                    yAxisID: 'y'
                },
                {
                    label: 'Compras ENAP ($ CLP)',
                    data: dataCompras,
                    backgroundColor: 'rgba(139, 92, 246, 0.75)',
                    borderColor: '#8b5cf6',
                    borderWidth: 1,
                    borderRadius: 6,
                    yAxisID: 'y'
                },
                {
                    label: 'Litros Vendidos (L)',
                    data: dataLitros,
                    type: 'line',
                    borderColor: '#00f2fe',
                    backgroundColor: 'rgba(0, 242, 254, 0.2)',
                    borderWidth: 3,
                    pointBackgroundColor: '#00f2fe',
                    pointRadius: 5,
                    fill: false,
                    tension: 0.3,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.dataset.yAxisID === 'y1') {
                                label += context.parsed.y.toLocaleString('es-CL') + ' L';
                            } else {
                                label += '$' + Math.round(context.parsed.y).toLocaleString('es-CL') + ' CLP';
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#94a3b8', font: { family: 'Inter' } },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    ticks: {
                        color: '#10b981',
                        callback: function(val) { return '$' + (val / 1000000).toFixed(1) + 'M'; }
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    ticks: {
                        color: '#00f2fe',
                        callback: function(val) { return val.toLocaleString('es-CL') + ' L'; }
                    },
                    grid: { drawOnChartArea: false }
                }
            }
        }
    });
}

// Populate Interactive Data Table
function renderTable() {
    const tableBody = document.getElementById('tableBody');
    const searchInput = document.getElementById('searchInput');
    const sellerFilter = document.getElementById('sellerFilter');
    if (!tableBody || !window.GRANEL_DATA) return;
    
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const sellerVal = sellerFilter ? sellerFilter.value : 'ALL';
    const monthVal = selectedMonth;

    const filtered = window.GRANEL_DATA.transacciones.filter(tx => {
        const matchesMonth = monthVal === 'ALL' || (tx.fecha && tx.fecha.startsWith(monthVal));

        const matchesQuery = !query || 
            (tx.cliente && tx.cliente.toLowerCase().includes(query)) ||
            (tx.direccion && tx.direccion.toLowerCase().includes(query)) ||
            (tx.observacion && tx.observacion.toLowerCase().includes(query)) ||
            (tx.detalles && tx.detalles.toLowerCase().includes(query));

        const matchesSeller = sellerVal === 'ALL' || (tx.vendedor && tx.vendedor.includes(sellerVal));

        return matchesMonth && matchesQuery && matchesSeller;
    });

    tableBody.innerHTML = '';
    if (filtered.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2rem;">No se encontraron registros matching con los filtros seleccionados.</td></tr>`;
        return;
    }

    filtered.forEach(tx => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${tx.fecha}</td>
            <td><strong>${tx.cliente}</strong></td>
            <td><span class="badge badge-blue">${tx.camion}</span></td>
            <td>${tx.vendedor}</td>
            <td>${tx.precio > 0 ? formatCLP(tx.precio) : '-'}</td>
            <td><strong>${tx.litros.toLocaleString('es-CL')} L</strong></td>
            <td>${tx.total > 0 ? formatCLP(tx.total) : '-'}</td>
            <td>${tx.medioPago}</td>
            <td style="color: var(--accent-amber);">${tx.comision > 0 ? formatCLP(tx.comision) : '-'}</td>
        `;
        tableBody.appendChild(tr);
    });
}

const searchInput = document.getElementById('searchInput');
const sellerFilter = document.getElementById('sellerFilter');
if (searchInput) searchInput.addEventListener('input', renderTable);
if (sellerFilter) sellerFilter.addEventListener('change', renderTable);

// Export to CSV Download Handler
function downloadCSV() {
    if (!window.GRANEL_DATA || !window.GRANEL_DATA.transacciones) return;
    
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const sellerVal = sellerFilter ? sellerFilter.value : 'ALL';
    const monthVal = selectedMonth;

    const filtered = window.GRANEL_DATA.transacciones.filter(tx => {
        const matchesMonth = monthVal === 'ALL' || (tx.fecha && tx.fecha.startsWith(monthVal));

        const matchesQuery = !query || 
            (tx.cliente && tx.cliente.toLowerCase().includes(query)) ||
            (tx.direccion && tx.direccion.toLowerCase().includes(query)) ||
            (tx.observacion && tx.observacion.toLowerCase().includes(query)) ||
            (tx.detalles && tx.detalles.toLowerCase().includes(query));

        const matchesSeller = sellerVal === 'ALL' || (tx.vendedor && tx.vendedor.includes(sellerVal));
        return matchesMonth && matchesQuery && matchesSeller;
    });

    const headers = [
        "Fecha",
        "Cliente / Entidad",
        "Camión",
        "Vendedor / Canal",
        "Dirección",
        "Precio por Litro ($)",
        "Litros",
        "Total Recaudado ($)",
        "Medio de Pago",
        "Comisión ($)",
        "Observación",
        "Detalles"
    ];

    function escapeCSV(field) {
        if (field === null || field === undefined) return '""';
        const str = String(field).replace(/"/g, '""');
        return `"${str}"`;
    }

    const rows = filtered.map(tx => [
        escapeCSV(tx.fecha),
        escapeCSV(tx.cliente),
        escapeCSV(tx.camion),
        escapeCSV(tx.vendedor),
        escapeCSV(tx.direccion),
        tx.precio || 0,
        tx.litros || 0,
        tx.total || 0,
        escapeCSV(tx.medioPago),
        tx.comision || 0,
        escapeCSV(tx.observacion),
        escapeCSV(tx.detalles)
    ].join(';'));

    const csvContent = '\uFEFF' + [headers.map(escapeCSV).join(';'), ...rows].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const dateStr = new Date().toISOString().split('T')[0];
    const monthSuffix = monthVal === 'ALL' ? 'Consolidado' : monthVal;
    link.setAttribute('href', url);
    link.setAttribute('download', `Registro_Movimientos_Granel_${monthSuffix}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

const btnDownloadCSV = document.getElementById('btnDownloadCSV');
if (btnDownloadCSV) btnDownloadCSV.addEventListener('click', downloadCSV);
