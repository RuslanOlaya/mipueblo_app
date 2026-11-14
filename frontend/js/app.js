import { inicializarTablero, renderizarMapaHabitaciones } from "./tablero.js";
import { inicializarCheckin, poblarSelectHabitacionesDisponibles } from "./checkin.js";
import { inicializarLlegadas, renderizarTablaLlegadas } from "./llegadas.js";
import { inicializarHuespedes, renderizarTablaHuespedes } from "./huespedes.js";

export const API_URL = "http://127.0.0.1:8000";

export const state = {
    habitaciones: [],
    reservasActivas: [],
    productos: [],
    historialLlegadas: [],
    directorioHuespedes: [],
    vistaActual: "tablero"
};

export function formatearFechaHora(isoString) {
    if (!isoString) return "—";
    const fecha = new Date(isoString);
    return fecha.toLocaleString("es-CO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    document.querySelectorAll(".nav-tab").forEach(btn => {
        btn.addEventListener("click", () => cargarVista(btn.dataset.vista));
    });
    document.getElementById("btn-refresh").addEventListener("click", cargarDatos);

    await cargarDatos();
    await cargarVista("tablero");
});

export async function cargarDatos() {
    const statusBadge = document.getElementById("status-api");
    try {
        const [resHab, resRes, resProd, resLlegadas, resHuespedes] = await Promise.all([
            fetch(`${API_URL}/habitaciones`),
            fetch(`${API_URL}/reservas/activas`),
            fetch(`${API_URL}/productos`),
            fetch(`${API_URL}/reservas/historial`),
            fetch(`${API_URL}/huespedes`)
        ]);

        if (!resHab.ok || !resRes.ok) throw new Error("Fallo en servidor");

        state.habitaciones = await resHab.json();
        state.reservasActivas = await resRes.json();
        state.productos = resProd.ok ? await resProd.json() : [];
        state.historialLlegadas = resLlegadas.ok ? await resLlegadas.json() : [];
        state.directorioHuespedes = resHuespedes.ok ? await resHuespedes.json() : [];

        statusBadge.className = "flex items-center gap-2 text-xs font-medium bg-google-greenLight text-google-green px-3 py-1.5 rounded-full";
        statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-google-green"></span> En línea`;

        if (state.vistaActual === "tablero") renderizarMapaHabitaciones();
        else if (state.vistaActual === "checkin") poblarSelectHabitacionesDisponibles();
        else if (state.vistaActual === "llegadas") renderizarTablaLlegadas();
        else if (state.vistaActual === "huespedes") renderizarTablaHuespedes();
    } catch (error) {
        console.error(error);
        statusBadge.className = "flex items-center gap-2 text-xs font-medium bg-google-redLight text-google-red px-3 py-1.5 rounded-full";
        statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-google-red"></span> Sin conexión`;
    }
}

export async function cargarVista(nombreVista, callbackPosterior = null) {
    state.vistaActual = nombreVista;
    const contenedor = document.getElementById("app-contenedor");

    const res = await fetch(`/static/html/${nombreVista}.html`);
    contenedor.innerHTML = await res.text();

    document.querySelectorAll(".nav-tab").forEach(btn => {
        btn.className = btn.dataset.vista === nombreVista
            ? "nav-tab flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium bg-google-surface text-google-blue shadow-sm transition"
            : "nav-tab flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium text-google-textSec hover:text-google-text transition";
    });

    if (nombreVista === "tablero") inicializarTablero();
    else if (nombreVista === "checkin") inicializarCheckin();
    else if (nombreVista === "llegadas") inicializarLlegadas();
    else if (nombreVista === "huespedes") inicializarHuespedes();

    if (callbackPosterior) callbackPosterior();
}

// Convierte un input en campo de moneda con puntos de miles en vivo (ej: 10.000)
export function activarFormatoMonedaInput(input) {
    if (!input) return;
    input.addEventListener("input", () => {
        const soloDigitos = input.value.replace(/\D/g, "");
        input.value = soloDigitos ? parseInt(soloDigitos, 10).toLocaleString("es-CO") : "";
    });
}

// Lee el valor numérico limpio de un campo formateado con puntos (ej: "10.000" -> 10000)
export function leerMoneda(idElemento) {
    const el = document.getElementById(idElemento);
    if (!el) return 0;
    const soloDigitos = String(el.value).replace(/\D/g, "");
    return soloDigitos ? parseFloat(soloDigitos) : 0;
}

// Asigna un número a un input mostrándolo con puntos de miles
export function escribirMoneda(idElemento, valor) {
    const el = document.getElementById(idElemento);
    if (!el) return;
    const num = Math.round(Number(valor) || 0);
    el.value = num > 0 ? num.toLocaleString("es-CO") : (el.readOnly ? "0" : "");
}