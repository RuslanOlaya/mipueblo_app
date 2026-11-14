const API_URL = "http://127.0.0.1:8000";

let habitacionesCache = [];
let reservasActivasCache = [];
let filtroActual = "TODAS";

document.addEventListener("DOMContentLoaded", () => {
    inicializarEventos();
    cargarDatos();
});

function inicializarEventos() {
    document.getElementById("btn-refresh").addEventListener("click", cargarDatos);
    document.getElementById("form-checkin").addEventListener("submit", registrarCheckin);

    // Filtros tipo Chip
    document.querySelectorAll(".chip-filtro").forEach(btn => {
        btn.addEventListener("click", () => filtrarHabitaciones(btn.dataset.filtro));
    });

    // Botones de cierre de modales
    document.querySelectorAll("[data-close-modal]").forEach(btn => {
        btn.addEventListener("click", () => cerrarModal(btn.dataset.closeModal));
    });
}

async function cargarDatos() {
    const statusBadge = document.getElementById("status-api");
    try {
        const [resHab, resRes] = await Promise.all([
            fetch(`${API_URL}/habitaciones`),
            fetch(`${API_URL}/reservas/activas`)
        ]);

        if (!resHab.ok || !resRes.ok) throw new Error("Error en API");

        habitacionesCache = await resHab.json();
        reservasActivasCache = await resRes.json();

        statusBadge.className = "flex items-center gap-2 text-xs font-medium bg-google-greenLight text-google-green px-3.5 py-1.5 rounded-full";
        statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-google-green"></span> En línea`;
        renderizarHabitaciones();
    } catch (error) {
        console.error(error);
        statusBadge.className = "flex items-center gap-2 text-xs font-medium bg-google-redLight text-google-red px-3.5 py-1.5 rounded-full";
        statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-google-red"></span> Sin conexión`;
    }
}

function filtrarHabitaciones(estado) {
    filtroActual = estado;
    document.querySelectorAll(".chip-filtro").forEach(btn => {
        if (btn.dataset.filtro === estado) {
            btn.className = "chip-filtro bg-google-blueLight text-google-blue border border-google-blue/20 text-xs font-medium px-3.5 py-1.5 rounded-lg transition";
        } else {
            btn.className = "chip-filtro bg-google-surface text-google-textSec border border-google-border hover:bg-google-bg text-xs font-medium px-3.5 py-1.5 rounded-lg transition";
        }
    });
    renderizarHabitaciones();
}

function renderizarHabitaciones() {
    const grid = document.getElementById("grid-habitaciones");
    grid.innerHTML = "";

    let disp = 0, ocup = 0, mant = 0;

    habitacionesCache.forEach(hab => {
        if (hab.estado === "Disponible") disp++;
        else if (hab.estado === "Ocupada") ocup++;
        else mant++;

        if (filtroActual !== "TODAS" && hab.estado !== filtroActual) return;

        const reservaActiva = reservasActivasCache.find(r => r.habitacion_id === hab.id);

        let pillStyle = "bg-google-greenLight text-google-green";
        let topAccent = "border-t-4 border-t-google-green";

        if (hab.estado === "Ocupada") {
            pillStyle = "bg-google-redLight text-google-red";
            topAccent = "border-t-4 border-t-google-red";
        } else if (hab.estado === "Mantenimiento") {
            pillStyle = "bg-google-yellowLight text-amber-800";
            topAccent = "border-t-4 border-t-google-yellow";
        }

        let climaHtml = "";
        if (hab.tiene_aire_acondicionado) {
            climaHtml += `<span class="inline-flex items-center gap-1 bg-google-blueLight text-google-blue px-2 py-0.5 rounded-md text-[11px] font-medium"><span class="material-symbols-rounded text-[14px]">ac_unit</span>Aire</span>`;
        }
        if (hab.tiene_ventilador) {
            climaHtml += `<span class="inline-flex items-center gap-1 bg-google-bg text-google-textSec border border-google-border px-2 py-0.5 rounded-md text-[11px] font-medium"><span class="material-symbols-rounded text-[14px]">mode_fan</span>Ventilador</span>`;
        }

        const card = document.createElement("div");
        card.className = `bg-google-surface border border-google-border ${topAccent} rounded-2xl p-4 cursor-pointer hover:shadow-md transition-all flex flex-col justify-between`;
        card.addEventListener("click", () => manejarClickHabitacion(hab, reservaActiva));

        card.innerHTML = `
            <div>
                <div class="flex justify-between items-center mb-2">
                    <span class="font-display text-2xl font-bold text-google-text">${hab.numero}</span>
                    <span class="text-[11px] font-medium px-2.5 py-0.5 rounded-full ${pillStyle}">${hab.estado}</span>
                </div>
                <p class="text-xs text-google-textSec mb-3 line-clamp-1" title="${hab.tipo_camas}">${hab.tipo_camas}</p>
                <div class="flex flex-wrap gap-1.5 mb-4">
                    ${climaHtml}
                </div>
            </div>
            <div class="pt-2.5 border-t border-google-bg text-xs flex items-center justify-between">
                ${reservaActiva 
                    ? `<span class="text-google-text font-medium truncate flex items-center gap-1"><span class="material-symbols-rounded text-base text-google-red">person</span>${reservaActiva.cliente_nombre}</span>` 
                    : `<span class="text-google-blue font-medium flex items-center gap-1">Gestionar <span class="material-symbols-rounded text-sm">arrow_forward</span></span>`
                }
            </div>
        `;
        grid.appendChild(card);
    });

    document.getElementById("stat-total").textContent = habitacionesCache.length;
    document.getElementById("stat-disponibles").textContent = disp;
    document.getElementById("stat-ocupadas").textContent = ocup;
    document.getElementById("stat-mantenimiento").textContent = mant;
}

function manejarClickHabitacion(hab, reserva) {
    if (hab.estado === "Disponible") {
        document.getElementById("checkin-hab-id").value = hab.id;
        document.getElementById("checkin-hab-num").textContent = `#${hab.numero}`;
        document.getElementById("checkin-tarifa").value = hab.tiene_aire_acondicionado ? 70000 : 50000;
        abrirModal("modal-checkin");
    } else if (hab.estado === "Ocupada" && reserva) {
        verLiquidacion(hab, reserva);
    } else {
        alert(`Habitación #${hab.numero} en mantenimiento: ${hab.observacion_estado || 'Sin observaciones'}`);
    }
}

async function registrarCheckin(e) {
    e.preventDefault();
    const payload = {
        habitacion_id: parseInt(document.getElementById("checkin-hab-id").value),
        cliente_nombre: document.getElementById("checkin-nombre").value,
        cliente_documento: document.getElementById("checkin-doc").value,
        empresa: document.getElementById("checkin-empresa").value || null,
        numero_personas: parseInt(document.getElementById("checkin-personas").value),
        precio_noche: parseFloat(document.getElementById("checkin-tarifa").value),
        es_estadia_abierta: document.getElementById("checkin-abierta").checked
    };

    try {
        const res = await fetch(`${API_URL}/reservas`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            alert(`Error: ${err.detail}`);
            return;
        }

        cerrarModal("modal-checkin");
        document.getElementById("form-checkin").reset();
        cargarDatos();
    } catch (error) {
        alert("No se pudo conectar con el servidor.");
    }
}

async function verLiquidacion(hab, reserva) {
    document.getElementById("detalle-hab-num").textContent = `#${hab.numero}`;
    const contenedor = document.getElementById("detalle-contenido");
    contenedor.innerHTML = `<p class="text-google-textSec py-4 text-center">Calculando estado de cuenta...</p>`;
    abrirModal("modal-detalle");

    try {
        const res = await fetch(`${API_URL}/reservas/${reserva.id}/liquidacion`);
        const data = await res.json();

        contenedor.innerHTML = `
            <div class="bg-google-bg rounded-2xl p-4 border border-google-border space-y-2.5">
                <div class="flex justify-between"><span class="text-google-textSec">Huésped titular:</span> <span class="font-medium text-google-text">${data.cliente}</span></div>
                <div class="flex justify-between"><span class="text-google-textSec">Tiempo de estadía:</span> <span class="text-google-text">${data.dias_hospedados} noche(s)</span></div>
                <div class="flex justify-between"><span class="text-google-textSec">Tarifa por noche:</span> <span class="text-google-text">$${data.tarifa_noche.toLocaleString()}</span></div>
                <div class="flex justify-between"><span class="text-google-textSec">Subtotal alojamiento:</span> <span class="text-google-text">$${data.total_alojamiento.toLocaleString()}</span></div>
                <div class="flex justify-between"><span class="text-google-textSec">Consumos (Tienda/Lavandería):</span> <span class="text-google-text">$${data.total_consumos_tienda_lavanderia.toLocaleString()}</span></div>
                <div class="flex justify-between text-google-green font-medium"><span class="text-google-textSec font-normal">Abonos realizados:</span> <span>-$${data.total_abonado.toLocaleString()}</span></div>
                <div class="border-t border-google-border pt-3 mt-2 flex justify-between items-center">
                    <span class="font-display font-semibold text-google-text">Saldo pendiente</span>
                    <span class="font-display text-xl font-bold text-google-red">$${data.saldo_pendiente.toLocaleString()}</span>
                </div>
            </div>
        `;
    } catch (error) {
        contenedor.innerHTML = `<p class="text-google-red text-center py-4">No se pudo cargar la liquidación.</p>`;
    }
}

function abrirModal(id) {
    const m = document.getElementById(id);
    m.classList.remove("hidden");
    m.classList.add("flex");
}

function cerrarModal(id) {
    const m = document.getElementById(id);
    m.classList.add("hidden");
    m.classList.remove("flex");
}