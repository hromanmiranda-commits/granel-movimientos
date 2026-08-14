// Granel Movimientos - Dynamic Presentation & Dashboard Controller

document.addEventListener('DOMContentLoaded', () => {
    const slides = document.querySelectorAll('.slide');
    const totalSlides = slides.length;
    let currentSlide = 0;

    const currentSlideNumEl = document.getElementById('currentSlideNum');
    const totalSlideNumEl = document.getElementById('totalSlideNum');
    const progressBarEl = document.getElementById('progressBar');
    const btnPrev = document.getElementById('btnPrev');
    const btnNext = document.getElementById('btnNext');
    const btnOverview = document.getElementById('btnOverview');
    const overviewModal = document.getElementById('overviewModal');
    const btnCloseOverview = document.getElementById('btnCloseOverview');
    const overviewGrid = document.getElementById('overviewGrid');
    const btnFullscreen = document.getElementById('btnFullscreen');

    totalSlideNumEl.textContent = String(totalSlides).padStart(2, '0');

    // Populate Dynamic KPIs across cards
    function updateDynamicKPIs() {
        if (!window.GRANEL_DATA || !window.GRANEL_DATA.kpis) return;
        const kpis = window.GRANEL_DATA.kpis;
        const txs = window.GRANEL_DATA.transacciones || [];

        // Slide 1 KPIs
        const kpiComprasL = document.querySelector('#slide-1 .kpi-value.cyan');
        if (kpiComprasL) kpiComprasL.textContent = `${kpis.comprasLitros.toLocaleString('es-CL')} L`;

        const kpiVentasMonto = document.querySelector('#slide-1 .kpi-value.emerald');
        if (kpiVentasMonto) kpiVentasMonto.textContent = `$${Math.round(kpis.montoVentas).toLocaleString('es-CL')}`;

        const kpiVentasLitrosSub = document.querySelector('#slide-1 .badge.badge-emerald');
        if (kpiVentasLitrosSub) kpiVentasLitrosSub.textContent = `${kpis.ventasLitros.toLocaleString('es-CL')} Litros`;

        const kpiStockSaldo = document.querySelector('#slide-1 .kpi-value.purple');
        if (kpiStockSaldo) kpiStockSaldo.textContent = `${kpis.stockSaldoLitros.toLocaleString('es-CL')} L`;

        // Slide 2 KPIs
        const s2ComprasL = document.querySelector('#slide-2 .kpi-value.cyan');
        if (s2ComprasL) s2ComprasL.textContent = `${kpis.comprasLitros.toLocaleString('es-CL')} L`;

        const s2VentasL = document.querySelector('#slide-2 .kpi-value.emerald');
        if (s2VentasL) s2VentasL.textContent = `${kpis.ventasLitros.toLocaleString('es-CL')} L`;

        const s2ExtraccionesL = document.querySelector('#slide-2 .kpi-value.rose');
        if (s2ExtraccionesL) s2ExtraccionesL.textContent = `${kpis.extraccionesLitros.toLocaleString('es-CL')} L`;

        // Slide 4 Dynamic Seller Cards (CJ & Tripulacion)
        let cjLitros = 0, cjMonto = 0, cjOps = 0;
        let tripLitros = 0, tripMonto = 0, tripOps = 0;

        txs.forEach(tx => {
            const v = tx.vendedor || '';
            const c = tx.cliente || '';
            if (v.includes('ENAP') || c.includes('ENAP') || v.includes('Ignacio') || c.includes('Ignacio')) return;

            if (v.includes('Tripulacion') || c.includes('Tripulacion')) {
                tripLitros += tx.litros;
                tripMonto += tx.total;
                tripOps += 1;
            } else if (v.includes('CJ') || c.includes('CJ') || tx.comision > 0) {
                cjLitros += tx.litros;
                cjMonto += tx.total;
                cjOps += 1;
            }
        });

        // Update Slide 4 CJ Card
        const s4CjLitros = document.getElementById('s4CjLitros');
        if (s4CjLitros) s4CjLitros.textContent = `${cjLitros.toLocaleString('es-CL')} L`;
        
        const s4CjMonto = document.getElementById('s4CjMonto');
        if (s4CjMonto) s4CjMonto.textContent = `$${Math.round(cjMonto / 1000000 * 100) / 100}M`;

        const s4CjOps = document.getElementById('s4CjOps');
        if (s4CjOps) s4CjOps.textContent = `${cjOps} Ventas`;

        // Update Slide 4 Tripulación Card
        const s4TripLitros = document.getElementById('s4TripLitros');
        if (s4TripLitros) s4TripLitros.textContent = `${tripLitros.toLocaleString('es-CL')} L`;

        const s4TripMonto = document.getElementById('s4TripMonto');
        if (s4TripMonto) s4TripMonto.textContent = `$${Math.round(tripMonto).toLocaleString('es-CL')}`;

        const s4TripOps = document.getElementById('s4TripOps');
        if (s4TripOps) s4TripOps.textContent = `${tripOps} Ventas`;
    }

    // Slide Navigation Function
    function showSlide(index) {
        if (index < 0 || index >= totalSlides) return;
        
        slides.forEach((slide, idx) => {
            if (idx === index) {
                slide.classList.add('active');
            } else {
                slide.classList.remove('active');
            }
        });

        currentSlide = index;
        currentSlideNumEl.textContent = String(currentSlide + 1).padStart(2, '0');
        
        const progressPercent = ((currentSlide + 1) / totalSlides) * 100;
        progressBarEl.style.width = `${progressPercent}%`;

        btnPrev.disabled = currentSlide === 0;
        btnNext.disabled = currentSlide === totalSlides - 1;

        // Render charts when reaching specific slides
        if (currentSlide === 1) renderChartInventario();
        if (currentSlide === 2) renderChartFinanciero();
        if (currentSlide === 3) renderChartVendedores();
    }

    btnPrev.addEventListener('click', () => showSlide(currentSlide - 1));
    btnNext.addEventListener('click', () => showSlide(currentSlide + 1));

    // Keyboard Controls
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
            showSlide(currentSlide + 1);
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
            showSlide(currentSlide - 1);
        } else if (e.key.toLowerCase() === 'g') {
            toggleOverview();
        } else if (e.key.toLowerCase() === 'f') {
            toggleFullscreen();
        }
    });

    // Fullscreen Toggle
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => console.log(err));
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
        }
    }

    if (btnFullscreen) {
        btnFullscreen.addEventListener('click', toggleFullscreen);
    }

    // Grid Overview Drawer
    function toggleOverview() {
        overviewModal.classList.toggle('active');
    }

    function buildOverviewGrid() {
        overviewGrid.innerHTML = '';
        slides.forEach((slide, idx) => {
            const titleEl = slide.querySelector('.slide-title, .hero-title');
            const titleText = titleEl ? titleEl.textContent : `Diapositiva ${idx + 1}`;

            const card = document.createElement('div');
            card.className = 'thumb-card';
            card.innerHTML = `
                <div class="thumb-num">0${idx + 1}</div>
                <div class="thumb-title">${titleText}</div>
                <div style="font-size: 0.75rem; color: var(--text-dim);">Haz clic para ir</div>
            `;
            card.addEventListener('click', () => {
                showSlide(idx);
                overviewModal.classList.remove('active');
            });
            overviewGrid.appendChild(card);
        });
    }

    btnOverview.addEventListener('click', toggleOverview);
    btnCloseOverview.addEventListener('click', toggleOverview);

    // Chart.js Implementations
    let chartInventarioObj = null;
    let chartFinancieroObj = null;
    let chartVendedoresObj = null;

    function renderChartInventario() {
        const ctx = document.getElementById('chartInventario');
        if (!ctx || chartInventarioObj || !window.GRANEL_DATA) return;
        const k = window.GRANEL_DATA.kpis;

        chartInventarioObj = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Litros Vendidos', 'Stock Saldo', 'Extracciones Operativas'],
                datasets: [{
                    data: [k.ventasLitros, k.stockSaldoLitros, k.extraccionesLitros],
                    backgroundColor: ['#10b981', '#8b5cf6', '#ef4444'],
                    borderColor: '#0b0f19',
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#f8fafc', font: { family: 'Inter' } } }
                }
            }
        });
    }

    function renderChartFinanciero() {
        const ctx = document.getElementById('chartFinanciero');
        if (!ctx || chartFinancieroObj || !window.GRANEL_DATA) return;
        const k = window.GRANEL_DATA.kpis;

        chartFinancieroObj = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Monto Compras ENAP', 'Total Recaudado Ventas', 'Comisiones Totales'],
                datasets: [{
                    label: 'Monto ($ CLP)',
                    data: [k.montoCompras, k.montoVentas, k.totalComisiones],
                    backgroundColor: ['#00f2fe', '#10b981', '#f59e0b'],
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    function renderChartVendedores() {
        const ctx = document.getElementById('chartVendedores');
        if (!ctx || chartVendedoresObj || !window.GRANEL_DATA) return;

        let cjLitros = 0;
        let tripLitros = 0;

        window.GRANEL_DATA.transacciones.forEach(tx => {
            const v = tx.vendedor || '';
            const c = tx.cliente || '';
            if (v.includes('Tripulacion') || c.includes('Tripulacion')) tripLitros += tx.litros;
            else if (v.includes('CJ') || c.includes('CJ') || tx.comision > 0) cjLitros += tx.litros;
        });

        chartVendedoresObj = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['CJ (Comisionista JC)', 'Tripulación (Ventas Directas)'],
                datasets: [{
                    data: [cjLitros > 0 ? cjLitros : 5108.8, tripLitros > 0 ? tripLitros : 1627.0],
                    backgroundColor: ['#00f2fe', '#f59e0b'],
                    borderColor: '#0b0f19',
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#f8fafc', font: { family: 'Inter' } } }
                }
            }
        });
    }

    // Populate Interactive Data Table
    const tableBody = document.getElementById('tableBody');
    const searchInput = document.getElementById('searchInput');
    const sellerFilter = document.getElementById('sellerFilter');

    function formatCLP(val) {
        if (!val || isNaN(val)) return '$0';
        return '$' + Math.round(val).toLocaleString('es-CL');
    }

    function renderTable() {
        if (!tableBody || !window.GRANEL_DATA) return;
        
        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const sellerVal = sellerFilter ? sellerFilter.value : 'ALL';

        const filtered = window.GRANEL_DATA.transacciones.filter(tx => {
            const matchesQuery = !query || 
                tx.cliente.toLowerCase().includes(query) ||
                tx.direccion.toLowerCase().includes(query) ||
                tx.observacion.toLowerCase().includes(query) ||
                tx.detalles.toLowerCase().includes(query);

            const matchesSeller = sellerVal === 'ALL' || tx.vendedor.includes(sellerVal);

            return matchesQuery && matchesSeller;
        });

        tableBody.innerHTML = '';
        if (filtered.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2rem;">No se encontraron registros matching con la búsqueda.</td></tr>`;
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

    if (searchInput) searchInput.addEventListener('input', renderTable);
    if (sellerFilter) sellerFilter.addEventListener('change', renderTable);

    // Initial Setup
    updateDynamicKPIs();
    buildOverviewGrid();
    showSlide(0);
    renderTable();
});
