import { API_URL, state, cargarDatos, cargarVista } from "./app.js";

let estadiaAbiertaActiva = false;

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
    cargarVista("checkin", () => {
        if (habitacionIdPreseleccionada) {
            document.getElementById("checkin-habitacion").value = habitacionIdPreseleccionada;
            actualizarOpcionesTarifa();
        }
    });
}

export function inicializarCheckin() {
    estadiaAbiertaActiva = false;
    document.getElementById("btn-volver-tablero").addEventListener("click", () => cargarVista("tablero"));
    document.getElementById("btn-buscar-huesped").addEventListener("click", buscarHuespedTitular);
    document.getElementById("btn-agregar-acompanante").addEventListener("click", agregarBloqueAcompanante);

    document.getElementById("checkin-habitacion").addEventListener("change", actualizarOpcionesTarifa);
    document.getElementById("checkin-tarifa-select").addEventListener("change", alCambiarTarifaSelect);
    document.getElementById("checkin-tarifa-manual").addEventListener("change", toggleTarifaManual);
    document.getElementById("btn-toggle-abierta").addEventListener("click", toggleEstadiaAbierta);

    ["checkin-precio-noche", "checkin-fecha-salida", "checkin-recargo", "checkin-abono"].forEach(id => {
        document.getElementById(id).addEventListener("input", recalcularResumenCheckin);
    });

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
    const inputPrecio = document.getElementById("checkin-precio-noche");

    if (!habId) {
        selectTarifa.disabled = true;
        selectTarifa.innerHTML = `<option value="">Primero elija una habitación...</option>`;
        inputPrecio.value = 0;
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
        document.getElementById("checkin-precio-noche").value = opcion.dataset.precio;
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

function recalcularResumenCheckin() {
    const precioNoche = parseFloat(document.getElementById("checkin-precio-noche").value) || 0;
    const recargo = parseFloat(document.getElementById("checkin-recargo").value) || 0;
    const abono = parseFloat(document.getElementById("checkin-abono").value) || 0;
    const fechaSalidaVal = document.getElementById("checkin-fecha-salida").value;

    const grupoMetodo = document.getElementById("grupo-metodo-pago");
    if (abono > 0) {
        grupoMetodo.classList.remove("opacity-50", "pointer-events-none");
    } else {
        grupoMetodo.classList.add("opacity-50", "pointer-events-none");
    }

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

    const totalEstimado = (noches * precioNoche) + recargo;
    const saldo = Math.max(0, totalEstimado - abono);

    document.getElementById("resumen-noches").textContent = textoNoches;
    document.getElementById("resumen-total").textContent = `$${totalEstimado.toLocaleString()}`;
    document.getElementById("resumen-saldo").textContent = `$${saldo.toLocaleString()}`;
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
        precio_noche: parseFloat(document.getElementById("checkin-precio-noche").value),
        es_tarifa_manual: document.getElementById("checkin-tarifa-manual").checked,
        fecha_salida: (!estadiaAbiertaActiva && fechaSalidaVal) ? `${fechaSalidaVal}T13:00:00` : null,
        es_estadia_abierta: estadiaAbiertaActiva,
        recargo_adicional: parseFloat(document.getElementById("checkin-recargo").value) || 0,
        abono_inicial: parseFloat(document.getElementById("checkin-abono").value) || 0,
        metodo_pago_abono: document.getElementById("checkin-metodo-pago").value
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

        await cargarDatos();
        await cargarVista("tablero");
    } catch (error) {
        alert("No se pudo conectar con el servidor para registrar el Check-in.");
    }
}