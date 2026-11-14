import { API_URL, state, cargarDatos, cargarVista, formatearFechaHora, activarFormatoMonedaInput, leerMoneda, escribirMoneda } from "./app.js";
import { abrirVistaCheckin } from "./checkin.js";

let filtroActual = "TODAS";
let reservaSeleccionadaActual = null;
let liquidacionActual = null;
let habitacionMantSeleccionada = null;
let pagosCierreCheckOut = [];

export function inicializarTablero() {
    document.getElementById("btn-ir-checkin").addEventListener("click", () => abrirVistaCheckin());
    document.querySelectorAll(".chip-filtro").forEach(btn => {
        btn.addEventListener("click", () => filtrarHabitaciones(btn.dataset.filtro));
    });

    // Activar puntos de miles (10.000) en abonos y caja de check-out
    activarFormatoMonedaInput(document.getElementById("abono-monto"));
    activarFormatoMonedaInput(document.getElementById("chk-pago-monto"));

    // Eventos Modal Ocupada
    document.getElementById("btn-cerrar-modal-ocupada").addEventListener("click", cerrarModalOcupada);
    document.querySelectorAll(".modal-tab").forEach(btn => {
        btn.addEventListener("click", () => cambiarTabModal(btn.dataset.tab));
    });
    document.getElementById("form-nuevo-abono").addEventListener("submit", registrarAbonoModal);
    document.getElementById("form-nuevo-consumo").addEventListener("submit", registrarConsumoModal);
    document.getElementById("btn-ejecutar-checkout").addEventListener("click", abrirModalCheckoutPago);

    // Eventos Modal Caja y Liquidación de Check-Out
    document.getElementById("btn-cerrar-modal-chk").addEventListener("click", cerrarModalCheckoutPago);
    document.getElementById("btn-cancelar-chk").addEventListener("click", cerrarModalCheckoutPago);
    document.getElementById("btn-chk-agregar-pago").addEventListener("click", agregarPagoListaCheckout);
    document.getElementById("btn-chk-autocompletar").addEventListener("click", autocompletarSaldoCheckout);
    document.getElementById("btn-confirmar-chk-final").addEventListener("click", confirmarCheckoutConPagos);

    // Eventos Modal Mantenimiento y Aseo
    document.getElementById("btn-cerrar-modal-mant").addEventListener("click", cerrarModalMantenimiento);
    document.getElementById("btn-cancelar-mant").addEventListener("click", cerrarModalMantenimiento);
    document.getElementById("btn-confirmar-mant").addEventListener("click", confirmarCambioMantenimiento);

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
        let estadoTexto = hab.estado;

        if (hab.estado === "Ocupada") {
            pillStyle = "bg-google-redLight text-google-red";
            topAccent = "border-t-4 border-t-google-red";
        } else if (hab.estado === "Mantenimiento") {
            pillStyle = "bg-google-yellowLight text-amber-800";
            topAccent = "border-t-4 border-t-google-yellow";
            estadoTexto = "Aseo / Mant.";
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
                abrirModalMantenimiento(hab);
            }
        });

        const nombreHuesped = reservaActiva
            ? `${reservaActiva.titular.nombres} ${reservaActiva.titular.apellidos}`
            : "";

        let footerHtml = "";
        if (hab.estado === "Ocupada" && reservaActiva) {
            footerHtml = `<span class="text-google-text font-medium truncate flex items-center gap-1"><span class="material-symbols-rounded text-base text-google-red">person</span>${nombreHuesped} (${reservaActiva.numero_personas})</span>`;
        } else if (hab.estado === "Mantenimiento") {
            footerHtml = `<span class="text-amber-800 font-medium truncate flex items-center gap-1" title="${hab.observacion_estado || ''}"><span class="material-symbols-rounded text-base">cleaning_services</span>${hab.observacion_estado || "En aseo / revisión"}</span>`;
        } else {
            footerHtml = `
                <span class="text-google-blue font-medium flex items-center gap-1">Registrar ingreso <span class="material-symbols-rounded text-sm">arrow_forward</span></span>
                <button type="button" class="btn-mandar-mant w-7 h-7 rounded-full hover:bg-google-yellowLight text-google-textSec hover:text-amber-800 flex items-center justify-center transition" title="Enviar a Aseo / Mantenimiento">
                    <span class="material-symbols-rounded text-[16px]">cleaning_services</span>
                </button>
            `;
        }

        card.innerHTML = `
            <div>
                <div class="flex justify-between items-center mb-1.5">
                    <span class="font-display text-2xl font-bold text-google-text">${hab.numero}</span>
                    <span class="text-[11px] font-medium px-2.5 py-0.5 rounded-full ${pillStyle}">${estadoTexto}</span>
                </div>
                <p class="text-xs text-google-textSec mb-3 line-clamp-1" title="${hab.tipo_camas}">${hab.tipo_camas}</p>
                <div class="flex flex-wrap gap-1.5 mb-3">${climaHtml}</div>
            </div>
            <div class="pt-2.5 border-t border-google-bg text-xs flex items-center justify-between gap-2">
                ${footerHtml}
            </div>
        `;

        const btnMandarMant = card.querySelector(".btn-mandar-mant");
        if (btnMandarMant) {
            btnMandarMant.addEventListener("click", (e) => {
                e.stopPropagation();
                abrirModalMantenimiento(hab);
            });
        }

        if (hab.piso === 1) gridP1.appendChild(card);
        else gridP2.appendChild(card);
    });

    document.getElementById("stat-total").textContent = state.habitaciones.length;
    document.getElementById("stat-disponibles").textContent = disp;
    document.getElementById("stat-ocupadas").textContent = ocup;
    document.getElementById("stat-mantenimiento").textContent = mant;
}

// ==============================================================================
// MODAL DE CAJA Y LIQUIDACIÓN DE CHECK-OUT (PAGOS MIXTOS)
// ==============================================================================
function abrirModalCheckoutPago() {
    if (!reservaSeleccionadaActual || !liquidacionActual) return;

    pagosCierreCheckOut = [];
    document.getElementById("chk-hab-num").textContent = `#${liquidacionActual.habitacion_numero}`;
    document.getElementById("chk-cliente-info").textContent =
        `${liquidacionActual.cliente} • ${reservaSeleccionadaActual.titular.tipo_documento}: ${liquidacionActual.documento}`;

    document.getElementById("chk-total-alojamiento").textContent = `$${liquidacionActual.total_alojamiento.toLocaleString("es-CO")}`;
    document.getElementById("chk-abonos-previos").textContent = `Abonado previo: -$${liquidacionActual.total_abonado.toLocaleString("es-CO")}`;
    document.getElementById("chk-total-consumos").textContent = `$${liquidacionActual.total_consumos_tienda_lavanderia.toLocaleString("es-CO")}`;
    document.getElementById("chk-saldo-objetivo").textContent = `$${liquidacionActual.saldo_pendiente.toLocaleString("es-CO")}`;

    const saldoPendiente = liquidacionActual.saldo_pendiente;
    const seccionPagos = document.getElementById("chk-seccion-pagos");

    if (saldoPendiente <= 0) {
        seccionPagos.classList.add("hidden");
    } else {
        seccionPagos.classList.remove("hidden");
        const saldoAlojamientoSugerido = Math.max(0, liquidacionActual.total_alojamiento - liquidacionActual.total_abonado);
        if (saldoAlojamientoSugerido > 0 && liquidacionActual.total_consumos_tienda_lavanderia > 0) {
            document.getElementById("chk-pago-concepto").value = "Liquidación Alojamiento";
            escribirMoneda("chk-pago-monto", saldoAlojamientoSugerido);
        } else {
            document.getElementById("chk-pago-concepto").value = "Liquidación Total Estadía";
            escribirMoneda("chk-pago-monto", saldoPendiente);
        }
    }

    renderizarPagosCheckout();

    const modal = document.getElementById("modal-checkout-pago");
    modal.classList.remove("hidden");
    modal.classList.add("flex");
}

function cerrarModalCheckoutPago() {
    const modal = document.getElementById("modal-checkout-pago");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
}

function agregarPagoListaCheckout() {
    const concepto = document.getElementById("chk-pago-concepto").value;
    const metodo = document.getElementById("chk-pago-metodo").value;
    const monto = leerMoneda("chk-pago-monto");

    if (monto <= 0) {
        alert("Ingresa un monto válido mayor a $0.");
        return;
    }

    pagosCierreCheckOut.push({ concepto, metodo_pago: metodo, monto });

    const totalIngresado = pagosCierreCheckOut.reduce((acc, p) => acc + p.monto, 0);
    const restante = Math.max(0, liquidacionActual.saldo_pendiente - totalIngresado);

    escribirMoneda("chk-pago-monto", restante);
    if (restante > 0 && concepto === "Liquidación Alojamiento" && liquidacionActual.total_consumos_tienda_lavanderia > 0) {
        document.getElementById("chk-pago-concepto").value = "Liquidación Tienda / Lavandería";
    }

    renderizarPagosCheckout();
}

function autocompletarSaldoCheckout() {
    const totalIngresado = pagosCierreCheckOut.reduce((acc, p) => acc + p.monto, 0);
    const restante = Math.max(0, liquidacionActual.saldo_pendiente - totalIngresado);

    if (restante <= 0) return;

    const concepto = document.getElementById("chk-pago-concepto").value;
    const metodo = document.getElementById("chk-pago-metodo").value;
    pagosCierreCheckOut.push({ concepto, metodo_pago: metodo, monto: restante });
    document.getElementById("chk-pago-monto").value = "";
    renderizarPagosCheckout();
}

function renderizarPagosCheckout() {
    const lista = document.getElementById("chk-lista-pagos");
    lista.innerHTML = "";

    pagosCierreCheckOut.forEach((pago, index) => {
        const item = document.createElement("div");
        item.className = "flex items-center justify-between bg-google-surface border border-google-border rounded-xl px-3.5 py-2";
        item.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="bg-google-blueLight text-google-blue font-semibold px-2 py-0.5 rounded text-[11px]">${pago.metodo_pago}</span>
                <span class="text-google-text font-medium">${pago.concepto}</span>
            </div>
            <div class="flex items-center gap-3">
                <strong class="text-google-green">$${pago.monto.toLocaleString("es-CO")}</strong>
                <button type="button" class="text-google-textSec hover:text-google-red transition" title="Eliminar pago">
                    <span class="material-symbols-rounded text-base">delete</span>
                </button>
            </div>
        `;
        item.querySelector("button").addEventListener("click", () => {
            pagosCierreCheckOut.splice(index, 1);
            renderizarPagosCheckout();
        });
        lista.appendChild(item);
    });

    const saldoObjetivo = liquidacionActual ? liquidacionActual.saldo_pendiente : 0;
    const totalIngresado = pagosCierreCheckOut.reduce((acc, p) => acc + p.monto, 0);
    const diferencia = saldoObjetivo - totalIngresado;

    document.getElementById("chk-total-ingresado").textContent = `$${totalIngresado.toLocaleString("es-CO")}`;
    const estadoCuadre = document.getElementById("chk-estado-cuadre");
    const btnConfirmar = document.getElementById("btn-confirmar-chk-final");

    if (diferencia > 0) {
        estadoCuadre.className = "text-google-red font-medium mt-0.5";
        estadoCuadre.textContent = `Falta por cubrir: $${diferencia.toLocaleString("es-CO")}`;
        btnConfirmar.disabled = true;
    } else if (diferencia < 0) {
        estadoCuadre.className = "text-amber-700 font-medium mt-0.5";
        estadoCuadre.textContent = `Cambio / Devuelta al huésped: $${Math.abs(diferencia).toLocaleString("es-CO")}`;
        btnConfirmar.disabled = false;
    } else {
        estadoCuadre.className = "text-google-green font-medium mt-0.5";
        estadoCuadre.textContent = "Cuenta cuadrada en $0 • Lista para cerrar";
        btnConfirmar.disabled = false;
    }
}

async function confirmarCheckoutConPagos() {
    if (!reservaSeleccionadaActual || !liquidacionActual) return;

    const btnConfirmar = document.getElementById("btn-confirmar-chk-final");
    btnConfirmar.disabled = true;

    try {
        for (const pago of pagosCierreCheckOut) {
            const resPago = await fetch(`${API_URL}/pagos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    reserva_id: reservaSeleccionadaActual.id,
                    monto: pago.monto,
                    metodo_pago: pago.metodo_pago,
                    concepto: pago.concepto,
                    observacion: "Pago de liquidación en Check-out"
                })
            });
            if (!resPago.ok) throw new Error("Error registrando uno de los pagos");
        }

        const payloadFactura = {
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

        const resFactura = await fetch(`${API_URL}/facturas`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payloadFactura)
        });

        if (!resFactura.ok) throw new Error("Error generando el comprobante de Check-out");

        cerrarModalCheckoutPago();
        cerrarModalOcupada();
        await cargarDatos();
        await cargarVista("tablero");
    } catch (error) {
        alert(error.message || "Error al procesar el Check-out.");
        btnConfirmar.disabled = false;
    }
}

// ==============================================================================
// MODAL DE MANTENIMIENTO Y ASEO
// ==============================================================================
function abrirModalMantenimiento(hab) {
    habitacionMantSeleccionada = hab;
    document.getElementById("mant-hab-num").textContent = `#${hab.numero}`;

    const boxActual = document.getElementById("mant-box-actual");
    const formMotivo = document.getElementById("mant-form-motivo");
    const btnConfirmar = document.getElementById("btn-confirmar-mant");
    const inputObs = document.getElementById("mant-input-observacion");

    if (hab.estado === "Mantenimiento") {
        document.getElementById("mant-estado-subtitulo").textContent = "Habitación en proceso de alistamiento";
        boxActual.classList.remove("hidden");
        document.getElementById("mant-motivo-actual").textContent = hab.observacion_estado || "Aseo y cambio de sábanas";
        formMotivo.classList.add("hidden");

        btnConfirmar.className = "flex items-center gap-1.5 bg-google-green hover:bg-emerald-700 text-white text-xs font-semibold px-5 py-2.5 rounded-full shadow-sm transition";
        btnConfirmar.innerHTML = `<span class="material-symbols-rounded text-base">check_circle</span> Aseo Listo — Pasar a Disponible`;
    } else {
        document.getElementById("mant-estado-subtitulo").textContent = "Bloquear temporalmente para aseo o reparación";
        boxActual.classList.add("hidden");
        formMotivo.classList.remove("hidden");
        inputObs.value = "Aseo general y cambio de sábanas";

        btnConfirmar.className = "flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-5 py-2.5 rounded-full shadow-sm transition";
        btnConfirmar.innerHTML = `<span class="material-symbols-rounded text-base">cleaning_services</span> Enviar a Mantenimiento / Aseo`;
    }

    const modal = document.getElementById("modal-mantenimiento");
    modal.classList.remove("hidden");
    modal.classList.add("flex");
}

function cerrarModalMantenimiento() {
    const modal = document.getElementById("modal-mantenimiento");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    habitacionMantSeleccionada = null;
}

async function confirmarCambioMantenimiento() {
    if (!habitacionMantSeleccionada) return;

    const obs = document.getElementById("mant-input-observacion").value.trim() || "Aseo y cambio de sábanas";
    const url = `${API_URL}/habitaciones/${habitacionMantSeleccionada.id}/mantenimiento?observacion=${encodeURIComponent(obs)}`;

    try {
        const res = await fetch(url, { method: "PATCH" });
        if (!res.ok) {
            const err = await res.json();
            alert(`Error: ${err.detail}`);
            return;
        }
        cerrarModalMantenimiento();
        await cargarDatos();
    } catch (error) {
        alert("No se pudo actualizar el estado de la habitación.");
    }
}

// ==============================================================================
// MODAL DE HABITACIÓN OCUPADA (Titular + Acompañantes + Cuenta + Acciones)
// ==============================================================================
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
            <div class="flex justify-between"><span class="text-google-textSec">Tarifa noche:</span> <span>$${liquidacionActual.tarifa_noche.toLocaleString("es-CO")}</span></div>
            <div class="flex justify-between"><span class="text-google-textSec">Subtotal Alojamiento + Recargos:</span> <span>$${liquidacionActual.total_alojamiento.toLocaleString("es-CO")}</span></div>
            <div class="flex justify-between"><span class="text-google-textSec">Consumos (Tienda/Lavandería):</span> <span>$${liquidacionActual.total_consumos_tienda_lavanderia.toLocaleString("es-CO")}</span></div>
            <div class="flex justify-between text-google-green font-medium"><span class="text-google-textSec font-normal">Total Abonado:</span> <span>-$${liquidacionActual.total_abonado.toLocaleString("es-CO")}</span></div>
            <div class="border-t border-google-border pt-2.5 mt-2 flex justify-between items-center">
                <span class="font-display font-semibold">Saldo Pendiente a Pagar:</span>
                <span class="font-display text-xl font-bold text-google-red">$${liquidacionActual.saldo_pendiente.toLocaleString("es-CO")}</span>
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
        opt.textContent = `${p.nombre} - $${p.precio_unitario.toLocaleString("es-CO")} ${p.tipo === "Producto" ? `(Stock: ${p.stock})` : ""}`;
        select.appendChild(opt);
    });
}

async function registrarAbonoModal(e) {
    e.preventDefault();
    if (!reservaSeleccionadaActual) return;

    const monto = leerMoneda("abono-monto");
    if (monto <= 0) {
        alert("Ingresa un monto válido mayor a $0.");
        return;
    }

    const payload = {
        reserva_id: reservaSeleccionadaActual.id,
        monto: monto,
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