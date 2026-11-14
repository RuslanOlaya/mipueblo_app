import { API_URL, state, cargarDatos, cargarVista, formatearFechaHora } from "./app.js";
import { abrirVistaCheckin } from "./checkin.js";

let filtroActual = "TODAS";
let reservaSeleccionadaActual = null;
let liquidacionActual = null;

export function inicializarTablero() {
    document.getElementById("btn-ir-checkin").addEventListener("click", () => abrirVistaCheckin());
    document.querySelectorAll(".chip-filtro").forEach(btn => {
        btn.addEventListener("click", () => filtrarHabitaciones(btn.dataset.filtro));
    });

    document.getElementById("btn-cerrar-modal-ocupada").addEventListener("click", cerrarModalOcupada);

    document.querySelectorAll(".modal-tab").forEach(btn => {
        btn.addEventListener("click", () => cambiarTabModal(btn.dataset.tab));
    });

    document.getElementById("form-nuevo-abono").addEventListener("submit", registrarAbonoModal);
    document.getElementById("form-nuevo-consumo").addEventListener("submit", registrarConsumoModal);
    document.getElementById("btn-ejecutar-checkout").addEventListener("click", ejecutarCheckoutFinal);

    renderizarMapaHabitaciones();
}

function filtrarHabitaciones(estado) {
    filtroActual = estado;
    document.querySelectorAll(".chip-filtro").forEach(btn => {
        btn.className = btn.dataset.filtro === estado
            ? "chip-filtro bg-google-blueLight text-google-blue border border-google-blue/20 text-xs font-medium px-3.5 py-1.5 rounded-lg transition"
            : "chip-filtro bg-google-surface text-google-textSec border border-google-border hover:bg-google-bg text-xs font-medium px-3.5 py-1.5 rounded-lg transition";
    });
    renderizarMapaHabitaciones();
}

export function renderizarMapaHabitaciones() {
    const gridP1 = document.getElementById("grid-piso-1");
    const gridP2 = document.getElementById("grid-piso-2");
    if (!gridP1 || !gridP2) return;

    gridP1.innerHTML = "";
    gridP2.innerHTML = "";

    let disp = 0, ocup = 0, mant = 0;

    state.habitaciones.forEach(hab => {
        if (hab.estado === "Disponible") disp++;
        else if (hab.estado === "Ocupada") ocup++;
        else mant++;

        if (filtroActual !== "TODAS" && hab.estado !== filtroActual) return;

        const reservaActiva = state.reservasActivas.find(r => r.habitacion_id === hab.id);

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
        card.addEventListener("click", () => {
            if (hab.estado === "Disponible") {
                abrirVistaCheckin(hab.id);
            } else if (hab.estado === "Ocupada" && reservaActiva) {
                abrirModalHabitacionOcupada(hab, reservaActiva);
            } else {
                alert(`Habitación ${hab.numero} en mantenimiento: ${hab.observacion_estado || "Sin detalles"}`);
            }
        });

        const nombreHuesped = reservaActiva
            ? `${reservaActiva.titular.nombres} ${reservaActiva.titular.apellidos}`
            : "";

        card.innerHTML = `
            <div>
                <div class="flex justify-between items-center mb-1.5">
                    <span class="font-display text-2xl font-bold text-google-text">${hab.numero}</span>
                    <span class="text-[11px] font-medium px-2.5 py-0.5 rounded-full ${pillStyle}">${hab.estado}</span>
                </div>
                <p class="text-xs text-google-textSec mb-3 line-clamp-1" title="${hab.tipo_camas}">${hab.tipo_camas}</p>
                <div class="flex flex-wrap gap-1.5 mb-3">${climaHtml}</div>
            </div>
            <div class="pt-2.5 border-t border-google-bg text-xs flex items-center justify-between">
                ${reservaActiva
                    ? `<span class="text-google-text font-medium truncate flex items-center gap-1"><span class="material-symbols-rounded text-base text-google-red">person</span>${nombreHuesped} (${reservaActiva.numero_personas})</span>`
                    : `<span class="text-google-blue font-medium flex items-center gap-1">Registrar ingreso <span class="material-symbols-rounded text-sm">arrow_forward</span></span>`
                }
            </div>
        `;

        if (hab.piso === 1) gridP1.appendChild(card);
        else gridP2.appendChild(card);
    });

    document.getElementById("stat-total").textContent = state.habitaciones.length;
    document.getElementById("stat-disponibles").textContent = disp;
    document.getElementById("stat-ocupadas").textContent = ocup;
    document.getElementById("stat-mantenimiento").textContent = mant;
}

function cerrarModalOcupada() {
    const modal = document.getElementById("modal-ocupada");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
}

async function abrirModalHabitacionOcupada(hab, reserva) {
    reservaSeleccionadaActual = reserva;
    document.getElementById("modal-hab-num").textContent = `#${hab.numero}`;
    document.getElementById("modal-huesped-info").textContent =
        `Ingreso: ${formatearFechaHora(reserva.fecha_ingreso)} • ${reserva.numero_personas} ocupante(s)`;

    const listaOcupantes = document.getElementById("modal-lista-ocupantes");
    let htmlOcupantes = `
        <div class="bg-google-surface border border-google-blue/30 rounded-xl p-3 flex flex-wrap justify-between items-center gap-2">
            <div>
                <span class="inline-block bg-google-blueLight text-google-blue text-[10px] font-bold px-2 py-0.5 rounded uppercase mr-1.5">Titular</span>
                <strong class="text-google-text">${reserva.titular.nombres} ${reserva.titular.apellidos}</strong>
            </div>
            <div class="text-google-textSec flex flex-wrap gap-3">
                <span><strong class="text-google-text">${reserva.titular.tipo_documento}:</strong> ${reserva.titular.documento}</span>
                <span><strong class="text-google-text">Tel:</strong> ${reserva.titular.telefono || "No registrado"}</span>
            </div>
        </div>
    `;

    if (reserva.acompanantes && reserva.acompanantes.length > 0) {
        reserva.acompanantes.forEach((acomp, idx) => {
            htmlOcupantes += `
                <div class="bg-google-surface border border-google-border rounded-xl p-2.5 flex flex-wrap justify-between items-center gap-2">
                    <div>
                        <span class="inline-block bg-google-bg text-google-textSec border border-google-border text-[10px] font-medium px-2 py-0.5 rounded mr-1.5">Acompañante ${idx + 1}</span>
                        <span class="font-medium text-google-text">${acomp.nombres} ${acomp.apellidos}</span>
                    </div>
                    <div class="text-google-textSec flex flex-wrap gap-3">
                        <span><strong class="text-google-text">${acomp.tipo_documento}:</strong> ${acomp.documento}</span>
                        <span><strong class="text-google-text">Tel:</strong> ${acomp.telefono || "No registrado"}</span>
                    </div>
                </div>
            `;
        });
    }

    listaOcupantes.innerHTML = htmlOcupantes;

    poblarSelectProductos();
    cambiarTabModal("tab-cuenta");
    const modal = document.getElementById("modal-ocupada");
    modal.classList.remove("hidden");
    modal.classList.add("flex");

    await cargarDetalleLiquidacion(reserva.id);
}

function cambiarTabModal(idTab) {
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.add("hidden"));
    document.getElementById(idTab).classList.remove("hidden");

    document.querySelectorAll(".modal-tab").forEach(btn => {
        btn.className = btn.dataset.tab === idTab
            ? "modal-tab px-3.5 py-1.5 rounded-lg text-xs font-medium bg-google-blueLight text-google-blue"
            : "modal-tab px-3.5 py-1.5 rounded-lg text-xs font-medium text-google-textSec hover:bg-google-bg";
    });
}

async function cargarDetalleLiquidacion(reservaId) {
    const contenedor = document.getElementById("liquidacion-detalle");
    contenedor.innerHTML = `<p class="text-google-textSec text-center py-3">Calculando cuenta...</p>`;

    try {
        const res = await fetch(`${API_URL}/reservas/${reservaId}/liquidacion`);
        liquidacionActual = await res.json();

        contenedor.innerHTML = `
            <div class="flex justify-between"><span class="text-google-textSec">Días hospedados:</span> <span class="font-medium">${liquidacionActual.dias_hospedados} noche(s)</span></div>
            <div class="flex justify-between"><span class="text-google-textSec">Tarifa noche:</span> <span>$${liquidacionActual.tarifa_noche.toLocaleString()}</span></div>
            <div class="flex justify-between"><span class="text-google-textSec">Subtotal Alojamiento + Recargos:</span> <span>$${liquidacionActual.total_alojamiento.toLocaleString()}</span></div>
            <div class="flex justify-between"><span class="text-google-textSec">Consumos (Tienda/Lavandería):</span> <span>$${liquidacionActual.total_consumos_tienda_lavanderia.toLocaleString()}</span></div>
            <div class="flex justify-between text-google-green font-medium"><span class="text-google-textSec font-normal">Total Abonado:</span> <span>-$${liquidacionActual.total_abonado.toLocaleString()}</span></div>
            <div class="border-t border-google-border pt-2.5 mt-2 flex justify-between items-center">
                <span class="font-display font-semibold">Saldo Pendiente a Pagar:</span>
                <span class="font-display text-xl font-bold text-google-red">$${liquidacionActual.saldo_pendiente.toLocaleString()}</span>
            </div>
        `;
    } catch (error) {
        contenedor.innerHTML = `<p class="text-google-red">Error al obtener liquidación.</p>`;
    }
}

function poblarSelectProductos() {
    const select = document.getElementById("consumo-producto");
    if (!select) return;
    select.innerHTML = "";
    state.productos.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${p.nombre} - $${p.precio_unitario.toLocaleString()} ${p.tipo === "Producto" ? `(Stock: ${p.stock})` : ""}`;
        select.appendChild(opt);
    });
}

async function registrarAbonoModal(e) {
    e.preventDefault();
    if (!reservaSeleccionadaActual) return;

    const payload = {
        reserva_id: reservaSeleccionadaActual.id,
        monto: parseFloat(document.getElementById("abono-monto").value),
        metodo_pago: document.getElementById("abono-metodo").value,
        concepto: "Abono parcial en recepción",
        observacion: document.getElementById("abono-obs").value || null
    };

    const res = await fetch(`${API_URL}/pagos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (res.ok) {
        document.getElementById("form-nuevo-abono").reset();
        cambiarTabModal("tab-cuenta");
        await cargarDetalleLiquidacion(reservaSeleccionadaActual.id);
    } else {
        alert("Error al registrar el abono.");
    }
}

async function registrarConsumoModal(e) {
    e.preventDefault();
    if (!reservaSeleccionadaActual) return;

    const payload = {
        reserva_id: reservaSeleccionadaActual.id,
        producto_servicio_id: parseInt(document.getElementById("consumo-producto").value),
        cantidad: parseInt(document.getElementById("consumo-cantidad").value),
        es_cortesia: document.getElementById("consumo-cortesia").checked
    };

    const res = await fetch(`${API_URL}/consumos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (res.ok) {
        document.getElementById("form-nuevo-consumo").reset();
        await cargarDatos();
        poblarSelectProductos();
        cambiarTabModal("tab-cuenta");
        await cargarDetalleLiquidacion(reservaSeleccionadaActual.id);
    } else {
        const err = await res.json();
        alert(`Error: ${err.detail}`);
    }
}

async function ejecutarCheckoutFinal() {
    if (!reservaSeleccionadaActual || !liquidacionActual) return;

    const confirmar = confirm(
        `¿Confirmar Check-out de la habitación #${liquidacionActual.habitacion_numero}?\nSaldo pendiente: $${liquidacionActual.saldo_pendiente.toLocaleString()}`
    );
    if (!confirmar) return;

    const payload = {
        reserva_ids: [reservaSeleccionadaActual.id],
        tipo_cliente: reservaSeleccionadaActual.empresa ? "Empresa" : "Persona Natural",
        razon_social_o_nombre: reservaSeleccionadaActual.empresa || liquidacionActual.cliente,
        tipo_documento: reservaSeleccionadaActual.titular.tipo_documento,
        documento_numero: liquidacionActual.documento,
        subtotal: liquidacionActual.total_general,
        total: liquidacionActual.total_general,
        total_pagado: liquidacionActual.total_general,
        saldo_pendiente: 0
    };

    const res = await fetch(`${API_URL}/facturas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (res.ok) {
        cerrarModalOcupada();
        await cargarDatos();
        await cargarVista("tablero");
    } else {
        alert("Error al generar el Check-out.");
    }
}