import { state, formatearFechaHora } from "./app.js";

export function inicializarHuespedes() {
    document.getElementById("buscar-directorio-huesped").addEventListener("input", renderizarTablaHuespedes);
    renderizarTablaHuespedes();
}

export function renderizarTablaHuespedes() {
    const tbody = document.getElementById("tabla-huespedes-body");
    if (!tbody) return;

    const filtro = document.getElementById("buscar-directorio-huesped").value.toLowerCase().trim();
    tbody.innerHTML = "";

    const filtrados = state.directorioHuespedes.filter(h => {
        const nombre = `${h.nombres} ${h.apellidos}`.toLowerCase();
        const ciudad = (h.ciudad_procedencia || "").toLowerCase();
        const placa = (h.placa_vehiculo || "").toLowerCase();
        return (
            nombre.includes(filtro) ||
            h.documento.toLowerCase().includes(filtro) ||
            ciudad.includes(filtro) ||
            placa.includes(filtro)
        );
    });

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-xs text-google-textSec">No hay huéspedes registrados en la base de datos.</td></tr>`;
        return;
    }

    filtrados.forEach(h => {
        const tr = document.createElement("tr");
        tr.className = "hover:bg-google-bg/60 transition";
        tr.innerHTML = `
            <td class="py-3 px-4 font-medium text-google-text">${h.nombres} ${h.apellidos}</td>
            <td class="py-3 px-4 text-xs text-google-textSec">${h.tipo_documento}: <strong class="text-google-text">${h.documento}</strong></td>
            <td class="py-3 px-4 text-xs">${h.telefono || "—"}</td>
            <td class="py-3 px-4 text-xs">${h.ciudad_procedencia || "—"}</td>
            <td class="py-3 px-4 text-xs font-mono">${h.placa_vehiculo || "—"}</td>
            <td class="py-3 px-4 text-xs text-google-textSec">${formatearFechaHora(h.fecha_registro)}</td>
        `;
        tbody.appendChild(tr);
    });
}