import { state, formatearFechaHora } from "./app.js";

export function inicializarLlegadas() {
    document.getElementById("buscar-llegada").addEventListener("input", renderizarTablaLlegadas);
    renderizarTablaLlegadas();
}

export function renderizarTablaLlegadas() {
    const tbody = document.getElementById("tabla-llegadas-body");
    if (!tbody) return;

    const filtro = document.getElementById("buscar-llegada").value.toLowerCase().trim();
    tbody.innerHTML = "";

    const filtradas = state.historialLlegadas.filter(r => {
        const nombreTitular = `${r.titular.nombres} ${r.titular.apellidos}`.toLowerCase();
        return (
            nombreTitular.includes(filtro) ||
            r.titular.documento.toLowerCase().includes(filtro) ||
            r.habitacion_numero.includes(filtro)
        );
    });

    if (filtradas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-xs text-google-textSec">No hay registros de llegada para mostrar.</td></tr>`;
        return;
    }

    filtradas.forEach(r => {
        const estadoBadge = r.activa
            ? `<span class="bg-google-redLight text-google-red text-[11px] font-medium px-2.5 py-0.5 rounded-full">Hospedado</span>`
            : `<span class="bg-google-greenLight text-google-green text-[11px] font-medium px-2.5 py-0.5 rounded-full">Check-out</span>`;

        const textoAcomp = r.acompanantes.length > 0
            ? r.acompanantes.map(a => `${a.nombres} ${a.apellidos}`).join(", ")
            : `<span class="text-google-textSec italic">Sin acompañantes</span>`;

        const tr = document.createElement("tr");
        tr.className = "hover:bg-google-bg/60 transition";
        tr.innerHTML = `
            <td class="py-3 px-4 text-xs font-medium text-google-text whitespace-nowrap">${formatearFechaHora(r.fecha_ingreso)}</td>
            <td class="py-3 px-4 font-display font-bold text-google-blue">#${r.habitacion_numero}</td>
            <td class="py-3 px-4 font-medium text-google-text">${r.titular.nombres} ${r.titular.apellidos}</td>
            <td class="py-3 px-4 text-xs text-google-textSec">${r.titular.tipo_documento}: ${r.titular.documento}</td>
            <td class="py-3 px-4 text-xs text-google-text">${textoAcomp}</td>
            <td class="py-3 px-4 text-xs font-medium">$${r.precio_noche.toLocaleString()}</td>
            <td class="py-3 px-4">${estadoBadge}</td>
        `;
        tbody.appendChild(tr);
    });
}