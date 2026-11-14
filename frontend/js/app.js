import { inicializarTablero } from "./tablero.js";
import { inicializarCheckin } from "./checkin.js";
import { inicializarLlegadas } from "./llegadas.js";
import { inicializarHuespedes } from "./huespedes.js";

export const API_URL = "http://127.0.0.1:8000";

export const state = {
    habitaciones: [],
    reservasActivas: [],
    historialLlegadas: [],
    directorioHuespedes: [],
    productos: []
};

const MODOS_TEMA = ["system", "light", "dark"];

document.addEventListener("DOMContentLoaded", async () => {
    inicializarTema();

    document.querySelectorAll(".nav-tab").forEach(btn => {
        btn.addEventListener("click", () => cargarVista(btn.dataset.vista));
    });

    await cargarDatos();
    await cargarVista("tablero");
});

// ==============================================================================
// CONTROL DE TEMA (SISTEMA / CLARO / OSCURO)
// ==============================================================================
export function inicializarTema() {
    const modoGuardado = localStorage.getItem("hotel_tema") || "system";
    aplicarTema(modoGuardado);

    const btn = document.getElementById("btn-cambiar-tema");
    if (btn) {
        btn.addEventListener("click", () => {
            const actual = localStorage.getItem("hotel_tema") || "system";
            const siguiente = MODOS_TEMA[(MODOS_TEMA.indexOf(actual) + 1) % MODOS_TEMA.length];
            localStorage.setItem("hotel_tema", siguiente);
            aplicarTema(siguiente);
        });
    }

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
        if ((localStorage.getItem("hotel_tema") || "system") === "system") {
            aplicarTema("system");
        }
    });
}

function aplicarTema(modo) {
    const html = document.documentElement;
    const icono = document.getElementById("icono-tema");
    const texto = document.getElementById("texto-tema");

    const prefiereOscuroSistema = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const activarOscuro = modo === "dark" || (modo === "system" && prefiereOscuroSistema);

    html.classList.toggle("dark", activarOscuro);

    if (icono && texto) {
        if (modo === "system") {
            icono.textContent = "contrast";
            texto.textContent = "Sistema";
        } else if (modo === "light") {
            icono.textContent = "light_mode";
            texto.textContent = "Claro";
        } else {
            icono.textContent = "dark_mode";
            texto.textContent = "Oscuro";
        }
    }
}

// ==============================================================================
// CARGA DE DATOS Y VISTAS
// ==============================================================================
export async function cargarDatos() {
    const badge = document.getElementById("status-api");
    try {
        const [resHab, resActivas, resHistorial, resHuesp, resProd] = await Promise.all([
            fetch(`${API_URL}/habitaciones`),
            fetch(`${API_URL}/reservas/activas`),
            fetch(`${API_URL}/reservas/historial`),
            fetch(`${API_URL}/huespedes`),
            fetch(`${API_URL}/productos`)
        ]);

        state.habitaciones = await resHab.json();
        state.reservasActivas = await resActivas.json();
        state.historialLlegadas = await resHistorial.json();
        state.directorioHuespedes = await resHuesp.json();
        state.productos = await resProd.json();

        if (badge) {
            badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-google-green"></span> En línea`;
        }
    } catch (error) {
        console.error("Error cargando datos:", error);
        if (badge) {
            badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-google-red"></span> Sin conexión`;
        }
    }
}

export async function cargarVista(nombreVista, callbackPosterior = null) {
    const contenedor = document.getElementById("app-contenedor");
    if (!contenedor) return;

    document.querySelectorAll(".nav-tab").forEach(btn => {
        btn.className = btn.dataset.vista === nombreVista
            ? "nav-tab flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium bg-google-surface text-google-blue shadow-sm transition"
            : "nav-tab flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium text-google-textSec hover:text-google-text transition";
    });

    const res = await fetch(`/static/html/${nombreVista}.html?t=${Date.now()}`);
    contenedor.innerHTML = await res.text();

    if (nombreVista === "tablero") inicializarTablero();
    else if (nombreVista === "checkin") inicializarCheckin();
    else if (nombreVista === "llegadas") inicializarLlegadas();
    else if (nombreVista === "huespedes") inicializarHuespedes();

    if (callbackPosterior) callbackPosterior();
}

// ==============================================================================
// UTILIDADES DE FORMATO (FECHAS Y MONEDA CON PUNTOS DE MILES)
// ==============================================================================
export function formatearFechaHora(fechaIso) {
    if (!fechaIso) return "—";
    const fecha = new Date(fechaIso);
    return fecha.toLocaleString("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

export function activarFormatoMonedaInput(input) {
    if (!input) return;
    input.addEventListener("input", () => {
        const soloDigitos = input.value.replace(/\D/g, "");
        input.value = soloDigitos ? parseInt(soloDigitos, 10).toLocaleString("es-CO") : "";
    });
}

export function leerMoneda(idElemento) {
    const el = document.getElementById(idElemento);
    if (!el) return 0;
    const soloDigitos = String(el.value).replace(/\D/g, "");
    return soloDigitos ? parseFloat(soloDigitos) : 0;
}

export function escribirMoneda(idElemento, valor) {
    const el = document.getElementById(idElemento);
    if (!el) return;
    const num = Math.round(Number(valor) || 0);
    el.value = num > 0 ? num.toLocaleString("es-CO") : (el.readOnly ? "0" : "");
}