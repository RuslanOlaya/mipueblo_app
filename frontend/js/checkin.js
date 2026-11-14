import { API_URL, state, cargarDatos, cargarVista, activarFormatoMonedaInput, leerMoneda, escribirMoneda } from "./app.js";

let estadiaAbiertaActiva = false;
let pagosInicialesCheckin = [];

const TARIFAS_SISTEMA = {
    VENTILADOR: [
        { personas: 1, label: "1 Persona - 1 Cama (Ventilador) - $50.000", precio: 50000 },
        { personas: 2, label: "2 Personas - 1 Cama / Pareja (Ventilador) - $65.000", precio: 65000 },
        { personas: 2, label: "2 Personas - 2 Camas Separadas (Ventilador) - $85.000", precio: 85000 },
        { personas: 3, label: "3 Personas - 2 Camas (Ventilador) - $105.000", precio: 105000 }
    ],
    AIRE: [
        { personas: 1, label: "1 Persona - 1 Cama (Aire) - $70.000", precio: 70000 },
        { personas: 2, label: "2 Personas - 1 Cama / Pareja (Aire) - $95.000", precio: 95000 },
        { personas: 2, label: "2 Personas - 2 Camas Separadas (Aire) - $115.000", precio: 115000 },
        { personas: 3, label: "3 Personas - 2 Camas (Aire) - $125.000", precio: 125000 }
    ],
    CAMAROTE_AIRE: [
        { personas: 3, label: "3 Personas - 1 Cama + 1 Camarote (Aire) - $145.000", precio: 145000 },
        { personas: 4, label: "4 Personas - 1 Cama + 1 Camarote (Aire) - $165.000", precio: 165000 }
    ]
};

export function abrirVistaCheckin(habitacionIdPreseleccionada = null) {
    estadiaAbiertaActiva = false;
    pagosInicialesCheckin = [];
    cargarVista("checkin", () => {
        if (habitacionIdPreseleccionada) {
            document.getElementById("checkin-habitacion").value = habitacionIdPreseleccionada;
            actualizarOpcionesTarifa();
        }
    });
}

export function inicializarCheckin() {
    estadiaAbiertaActiva = false;
    pagosInicialesCheckin = [];

    document.getElementById("btn-volver-tablero").addEventListener("click", () => cargarVista("tablero"));
    document.getElementById("btn-buscar-huesped").addEventListener("click", buscarHuespedTitular);
    document.getElementById("btn-agregar-acompanante").addEventListener("click", agregarBloqueAcompanante);

    document.getElementById("checkin-habitacion").addEventListener("change", actualizarOpcionesTarifa);
    document.getElementById("checkin-tarifa-select").addEventListener("change", alCambiarTarifaSelect);
    document.getElementById("checkin-tarifa-manual").addEventListener("change", toggleTarifaManual);
    document.getElementById("btn-toggle-abierta").addEventListener("click", toggleEstadiaAbierta);

    // Activar puntos de miles (10.000) en los campos de moneda
    ["checkin-precio-noche", "checkin-recargo", "checkin-monto-recibido"].forEach(id => {
        activarFormatoMonedaInput(document.getElementById(id));
        document.getElementById(id).addEventListener("input", recalcularResumenCheckin);
    });

    // Eventos de caja y calculadora de devuelta
    document.getElementById("btn-checkin-agregar-pago").addEventListener("click", agregarPagoInicialCheckin);
    document.getElementById("btn-checkin-pago-exacto").addEventListener("click", agregarPagoExactoCheckin);
    document.getElementById("checkin-fecha-salida").addEventListener("input", recalcularResumenCheckin);

    document.getElementById("form-checkin-completo").addEventListener("submit", enviarFormularioCheckin);

    poblarSelectHabitacionesDisponibles();
    actualizarOpcionesTarifa();
    actualizarContadorOcupantes();
}

export function poblarSelectHabitacionesDisponibles() {
    const select = document.getElementById("checkin-habitacion");
    if (!select) return;
    select.innerHTML = `<option value="">Seleccione la Habitación...</option>`;

    state.habitaciones
        .filter(h => h.estado === "Disponible")
        .forEach(hab => {
            let climaTxt = [];
            if (hab.tiene_aire_acondicionado) climaTxt.push("Aire");
            if (hab.tiene_ventilador) climaTxt.push("Ventilador");
            if (hab.tipo_camas.includes("Camarote")) climaTxt.push("Camarote");

            const opt = document.createElement("option");
            opt.value = hab.id;
            opt.textContent = `Habitación ${hab.numero} (${climaTxt.join(" + ")})`;
            select.appendChild(opt);
        });
}

async function consultarHuespedApi(documento) {
    const res = await fetch(`${API_URL}/huespedes/${encodeURIComponent(documento)}`);
    if (!res.ok) return null;
    return await res.json();
}

async function buscarHuespedTitular() {
    const doc = document.getElementById("titular-documento").value.trim();
    if (!doc) {
        alert("Escribe un número de documento para buscar.");
        return;
    }

    const h = await consultarHuespedApi(doc);
    if (!h) {
        alert("No se encontró un huésped previo con ese documento. Puedes registrarlo como nuevo.");
        return;
    }

    document.getElementById("titular-tipo-doc").value = h.tipo_documento;
    document.getElementById("titular-nombres").value = h.nombres;
    document.getElementById("titular-apellidos").value = h.apellidos;
    document.getElementById("titular-telefono").value = h.telefono || "";
    document.getElementById("titular-ciudad").value = h.ciudad_procedencia || "";
    document.getElementById("titular-placa").value = h.placa_vehiculo || "";
}

function agregarBloqueAcompanante() {
    const contenedor = document.getElementById("contenedor-acompanantes");
    const indice = contenedor.children.length + 2;

    if (indice > 4) {
        alert("El máximo permitido por habitación es de 4 ocupantes.");
        return;
    }

    const div = document.createElement("div");
    div.className = "bloque-acompanante bg-google-surface border border-google-border rounded-2xl p-5 shadow-sm relative";
    div.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <div class="section-accent-blue">
                <h4 class="font-display text-sm font-semibold text-google-blue">Huésped Acompañante (Ocupante ${indice})</h4>
            </div>
            <button type="button" class="btn-quitar-acomp text-xs text-google-red hover:bg-google-redLight px-2.5 py-1 rounded-lg flex items-center gap-1 transition">
                <span class="material-symbols-rounded text-base">delete</span> Quitar
            </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-12 gap-3 mb-3">
            <div class="md:col-span-4">
                <label class="block text-xs font-medium text-google-textSec mb-1">Tipo Documento *</label>
                <select class="acomp-tipo-doc google-input">
                    <option value="CC">CC - Cédula Ciudadanía</option>
                    <option value="TI">TI - Tarjeta Identidad</option>
                    <option value="CE">CE - Extranjería</option>
                    <option value="PA">PA - Pasaporte</option>
                </select>
            </div>
            <div class="md:col-span-5">
                <label class="block text-xs font-medium text-google-textSec mb-1">Documento de Identidad *</label>
                <input type="text" required placeholder="N° Identificación" class="acomp-documento google-input">
            </div>
            <div class="md:col-span-3 flex items-end">
                <button type="button" class="btn-buscar-acomp w-full h-[38px] bg-google-surface hover:bg-google-blueLight text-google-blue border border-google-border font-medium text-xs rounded-lg flex items-center justify-center gap-1.5 transition">
                    <span class="material-symbols-rounded text-base">search</span>
                    Buscar
                </button>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
                <label class="block text-xs font-medium text-google-textSec mb-1">Nombre(s) *</label>
                <input type="text" required placeholder="Nombres" class="acomp-nombres google-input">
            </div>
            <div>
                <label class="block text-xs font-medium text-google-textSec mb-1">Apellido(s) *</label>
                <input type="text" required placeholder="Apellidos" class="acomp-apellidos google-input">
            </div>
            <div>
                <label class="block text-xs font-medium text-google-textSec mb-1">Teléfono Celular</label>
                <input type="tel" placeholder="Ej: 310..." class="acomp-telefono google-input">
            </div>
        </div>
    `;

    div.querySelector(".btn-buscar-acomp").addEventListener("click", async () => {
        const doc = div.querySelector(".acomp-documento").value.trim();
        if (!doc) {
            alert("Ingresa el documento del acompañante para buscar.");
            return;
        }
        const h = await consultarHuespedApi(doc);
        if (!h) {
            alert("Acompañante no encontrado en el historial. Completa sus datos para registrarlo.");
            return;
        }
        div.querySelector(".acomp-tipo-doc").value = h.tipo_documento;
        div.querySelector(".acomp-nombres").value = h.nombres;
        div.querySelector(".acomp-apellidos").value = h.apellidos;
        div.querySelector(".acomp-telefono").value = h.telefono || "";
    });

    div.querySelector(".btn-quitar-acomp").addEventListener("click", () => {
        div.remove();
        actualizarContadorOcupantes();
    });

    contenedor.appendChild(div);
    actualizarContadorOcupantes();
}

function actualizarContadorOcupantes() {
    const badge = document.getElementById("badge-ocupantes-total");
    if (!badge) return;

    const total = 1 + document.querySelectorAll(".bloque-acompanante").length;
    badge.textContent = total === 1 ? "1 Ocupante registrado" : `${total} Ocupantes registrados`;

    const selectTarifa = document.getElementById("checkin-tarifa-select");
    if (!selectTarifa.disabled && selectTarifa.options.length > 0) {
        const opciones = Array.from(selectTarifa.options);
        const coincidencia = opciones.find(opt => parseInt(opt.dataset.personas) === total);
        if (coincidencia) {
            selectTarifa.value = coincidencia.value;
            alCambiarTarifaSelect();
        }
    }
}

function actualizarOpcionesTarifa() {
    const habId = parseInt(document.getElementById("checkin-habitacion").value);
    const selectTarifa = document.getElementById("checkin-tarifa-select");

    if (!habId) {
        selectTarifa.disabled = true;
        selectTarifa.innerHTML = `<option value="">Primero elija una habitación...</option>`;
        escribirMoneda("checkin-precio-noche", 0);
        recalcularResumenCheckin();
        return;
    }

    const hab = state.habitaciones.find(h => h.id === habId);
    let opcionesValidas = [];

    if (hab.tiene_ventilador) opcionesValidas.push(...TARIFAS_SISTEMA.VENTILADOR);
    if (hab.tiene_aire_acondicionado) opcionesValidas.push(...TARIFAS_SISTEMA.AIRE);
    if (hab.tipo_camas.includes("Camarote")) opcionesValidas.push(...TARIFAS_SISTEMA.CAMAROTE_AIRE);

    selectTarifa.disabled = false;
    selectTarifa.innerHTML = "";

    opcionesValidas.forEach((t, idx) => {
        const opt = document.createElement("option");
        opt.value = idx;
        opt.textContent = t.label;
        opt.dataset.precio = t.precio;
        opt.dataset.personas = t.personas;
        opt.dataset.descripcion = t.label;
        selectTarifa.appendChild(opt);
    });

    actualizarContadorOcupantes();
    alCambiarTarifaSelect();
}

function alCambiarTarifaSelect() {
    const selectTarifa = document.getElementById("checkin-tarifa-select");
    const opcion = selectTarifa.options[selectTarifa.selectedIndex];
    if (opcion && opcion.dataset.precio && !document.getElementById("checkin-tarifa-manual").checked) {
        escribirMoneda("checkin-precio-noche", opcion.dataset.precio);
    }
    recalcularResumenCheckin();
}

function toggleTarifaManual(e) {
    const inputPrecio = document.getElementById("checkin-precio-noche");
    inputPrecio.readOnly = !e.target.checked;
    if (!e.target.checked) alCambiarTarifaSelect();
}

function toggleEstadiaAbierta() {
    estadiaAbiertaActiva = !estadiaAbiertaActiva;
    const btn = document.getElementById("btn-toggle-abierta");
    const inputSalida = document.getElementById("checkin-fecha-salida");

    if (estadiaAbiertaActiva) {
        inputSalida.value = "";
        inputSalida.disabled = true;
        btn.classList.add("bg-google-blueLight", "border-google-blue");
    } else {
        inputSalida.disabled = false;
        btn.classList.remove("bg-google-blueLight", "border-google-blue");
    }
    recalcularResumenCheckin();
}

// ==============================================================================
// GESTIÓN DE PAGOS AL INGRESO Y CALCULADORA DE DEVUELTA
// ==============================================================================
function calcularTotalEstadiaActual() {
    const precioNoche = leerMoneda("checkin-precio-noche");
    const recargo = leerMoneda("checkin-recargo");
    const fechaSalidaVal = document.getElementById("checkin-fecha-salida").value;

    let noches = 1;
    let textoNoches = "1 noche (Cobro diario / Estadía abierta)";

    if (!estadiaAbiertaActiva && fechaSalidaVal) {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const salida = new Date(fechaSalidaVal + "T00:00:00");
        const diffDias = Math.round((salida - hoy) / (1000 * 60 * 60 * 24));
        noches = Math.max(1, diffDias);
        textoNoches = `${noches} noche(s) programada(s)`;
    }

    return {
        noches,
        textoNoches,
        totalEstimado: (noches * precioNoche) + recargo
    };
}

function agregarPagoInicialCheckin() {
    const metodo = document.getElementById("checkin-metodo-pago").value;
    const monto = leerMoneda("checkin-monto-recibido");

    if (monto <= 0) {
        alert("Ingresa el monto recibido del huésped.");
        return;
    }

    pagosInicialesCheckin.push({ metodo_pago: metodo, monto_recibido: monto });
    document.getElementById("checkin-monto-recibido").value = "";
    renderizarListaPagosCheckin();
    recalcularResumenCheckin();
}

function agregarPagoExactoCheckin() {
    const { totalEstimado } = calcularTotalEstadiaActual();
    const yaEntregado = pagosInicialesCheckin.reduce((acc, p) => acc + p.monto_recibido, 0);
    const faltante = Math.max(0, totalEstimado - yaEntregado);

    if (faltante <= 0) return;

    const metodo = document.getElementById("checkin-metodo-pago").value;
    pagosInicialesCheckin.push({ metodo_pago: metodo, monto_recibido: faltante });
    document.getElementById("checkin-monto-recibido").value = "";
    renderizarListaPagosCheckin();
    recalcularResumenCheckin();
}

function renderizarListaPagosCheckin() {
    const lista = document.getElementById("checkin-lista-pagos");
    if (!lista) return;
    lista.innerHTML = "";

    pagosInicialesCheckin.forEach((pago, index) => {
        const item = document.createElement("div");
        item.className = "flex items-center justify-between bg-google-surface border border-google-border rounded-xl px-3.5 py-2";
        item.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="bg-google-blueLight text-google-blue font-semibold px-2 py-0.5 rounded text-[11px]">${pago.metodo_pago}</span>
                <span class="text-google-text">Dinero recibido al ingreso</span>
            </div>
            <div class="flex items-center gap-3">
                <strong class="text-google-green">$${pago.monto_recibido.toLocaleString("es-CO")}</strong>
                <button type="button" class="text-google-textSec hover:text-google-red transition" title="Quitar pago">
                    <span class="material-symbols-rounded text-base">delete</span>
                </button>
            </div>
        `;
        item.querySelector("button").addEventListener("click", () => {
            pagosInicialesCheckin.splice(index, 1);
            renderizarListaPagosCheckin();
            recalcularResumenCheckin();
        });
        lista.appendChild(item);
    });
}

function recalcularResumenCheckin() {
    const { textoNoches, totalEstimado } = calcularTotalEstadiaActual();

    const acumuladoLista = pagosInicialesCheckin.reduce((acc, p) => acc + p.monto_recibido, 0);
    const inputEnVivo = leerMoneda("checkin-monto-recibido");
    const totalEntregado = acumuladoLista + inputEnVivo;

    const devuelta = Math.max(0, totalEntregado - totalEstimado);
    const abonoRealAplicado = Math.min(totalEntregado, totalEstimado);
    const saldoPendiente = Math.max(0, totalEstimado - abonoRealAplicado);

    document.getElementById("resumen-noches").textContent = textoNoches;
    document.getElementById("resumen-total").textContent = `$${totalEstimado.toLocaleString("es-CO")}`;
    document.getElementById("resumen-abonado-real").textContent = `$${abonoRealAplicado.toLocaleString("es-CO")}`;
    document.getElementById("resumen-saldo").textContent = `$${saldoPendiente.toLocaleString("es-CO")}`;

    const boxDevuelta = document.getElementById("box-devuelta-checkin");
    const txtDevuelta = document.getElementById("resumen-devuelta");

    if (devuelta > 0) {
        boxDevuelta.className = "bg-google-yellowLight border border-amber-300 rounded-xl p-3 text-center transition";
        txtDevuelta.className = "font-display text-lg font-bold text-amber-800";
        txtDevuelta.textContent = `$${devuelta.toLocaleString("es-CO")}`;
    } else {
        boxDevuelta.className = "bg-google-surface border border-google-border rounded-xl p-3 text-center transition";
        txtDevuelta.className = "font-display text-lg font-bold text-google-textSec";
        txtDevuelta.textContent = "$0";
    }
}

async function enviarFormularioCheckin(e) {
    e.preventDefault();

    const selectTarifa = document.getElementById("checkin-tarifa-select");
    const opcionTarifa = selectTarifa.options[selectTarifa.selectedIndex];

    const acompanantes = [];
    document.querySelectorAll(".bloque-acompanante").forEach(bloque => {
        acompanantes.push({
            tipo_documento: bloque.querySelector(".acomp-tipo-doc").value,
            documento: bloque.querySelector(".acomp-documento").value,
            nombres: bloque.querySelector(".acomp-nombres").value,
            apellidos: bloque.querySelector(".acomp-apellidos").value,
            telefono: bloque.querySelector(".acomp-telefono").value || null
        });
    });

    const pagosFinales = [...pagosInicialesCheckin];
    const montoDirecto = leerMoneda("checkin-monto-recibido");
    if (montoDirecto > 0) {
        pagosFinales.push({
            metodo_pago: document.getElementById("checkin-metodo-pago").value,
            monto_recibido: montoDirecto
        });
    }

    const { totalEstimado } = calcularTotalEstadiaActual();
    let restantePorCubrir = totalEstimado;
    const pagosNetos = [];

    for (const p of pagosFinales) {
        if (restantePorCubrir <= 0) break;
        const montoNeto = Math.min(p.monto_recibido, restantePorCubrir);
        if (montoNeto > 0) {
            pagosNetos.push({ metodo_pago: p.metodo_pago, monto: montoNeto });
            restantePorCubrir -= montoNeto;
        }
    }

    const primerPago = pagosNetos[0] || { monto: 0, metodo_pago: "Efectivo" };
    const pagosAdicionales = pagosNetos.slice(1);
    const fechaSalidaVal = document.getElementById("checkin-fecha-salida").value;

    const payload = {
        habitacion_id: parseInt(document.getElementById("checkin-habitacion").value),
        titular: {
            tipo_documento: document.getElementById("titular-tipo-doc").value,
            documento: document.getElementById("titular-documento").value,
            nombres: document.getElementById("titular-nombres").value,
            apellidos: document.getElementById("titular-apellidos").value,
            telefono: document.getElementById("titular-telefono").value || null,
            ciudad_procedencia: document.getElementById("titular-ciudad").value || null,
            placa_vehiculo: document.getElementById("titular-placa").value || null
        },
        acompanantes: acompanantes,
        empresa: document.getElementById("checkin-empresa").value || null,
        grupo_id: document.getElementById("checkin-grupo").value || null,
        numero_personas: 1 + acompanantes.length,
        tarifa_descripcion: opcionTarifa ? opcionTarifa.dataset.descripcion : "Tarifa Personalizada",
        precio_noche: leerMoneda("checkin-precio-noche"),
        es_tarifa_manual: document.getElementById("checkin-tarifa-manual").checked,
        fecha_salida: (!estadiaAbiertaActiva && fechaSalidaVal) ? `${fechaSalidaVal}T13:00:00` : null,
        es_estadia_abierta: estadiaAbiertaActiva,
        recargo_adicional: leerMoneda("checkin-recargo"),
        abono_inicial: primerPago.monto,
        metodo_pago_abono: primerPago.metodo_pago
    };

    try {
        const res = await fetch(`${API_URL}/reservas`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            alert(`Error en Check-in: ${err.detail}`);
            return;
        }

        const reservaCreada = await res.json();

        for (const extra of pagosAdicionales) {
            await fetch(`${API_URL}/pagos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    reserva_id: reservaCreada.id,
                    monto: extra.monto,
                    metodo_pago: extra.metodo_pago,
                    concepto: "Abono inicial mixto",
                    observacion: "Segundo método de pago en Check-in"
                })
            });
        }

        await cargarDatos();
        await cargarVista("tablero");
    } catch (error) {
        alert("No se pudo conectar con el servidor para registrar el Check-in.");
    }
}