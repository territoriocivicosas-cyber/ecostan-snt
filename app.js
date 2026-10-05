/* ==========================================
   CONFIGURACIÓN DEL SERVIDOR LOCAL (POSTGRESQL)
========================================== */
const API_URL = 'http://localhost:3000/api';

let gpsLat = null;
let gpsLng = null;
let mapInstance = null;
let markerInstance = null;
let clusterReportes = null;

/* ==========================================
   CAMBIAR SECCIONES DE NAVEGACIÓN
========================================== */
function mostrarSeccion(nombre, boton) {
    const secciones = document.querySelectorAll(".seccion");
    secciones.forEach(function(seccion) {
        seccion.classList.remove("activa");
    });

    const seccionSeleccionada = document.getElementById(nombre);
    if (seccionSeleccionada) {
        seccionSeleccionada.classList.add("activa");
    }

    cambiarTitulo(nombre);

    if (nombre === "mis-reportes") {
        cargarReportes();
    }

    if (nombre === "inicio" || nombre === "rutas" || nombre === "mapa") {
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
            if (mapInstance) {
                mapInstance.invalidateSize();
            }
        }, 200);
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function cambiarTitulo(nombre) {
    const titulo = document.getElementById("tituloPagina");
    const titulos = {
        "inicio": "Ciudad Limpia",
        "rutas": "Rutas de recolección",
        "avisos": "Avisos",
        "mis-reportes": "Reportes generales",
        "educacion": "Educación ambiental"
    };

    if (titulo) {
        titulo.textContent = titulos[nombre] || "Ciudad Limpia";
    }
}

/* ==========================================
   CARRUSEL DE BANNERS
========================================== */
let bannerIndiceActual = 0;
let bannerIntervalo = null;

const BANNER_POR_DEFECTO = [{
    titulo: 'Ayudemos a mantener <strong>Bucaramanga limpia</strong>',
    descripcion: 'Consulta las rutas de recolección, avisos y recibe información de interés ambiental.',
    texto_boton: '🌱 Ver iniciativas',
    enlace: null,
    color_fondo: null,
    icono: '♻'
}];

async function cargarBanners() {
    const track = document.getElementById('bannerTrack');
    const dotsContenedor = document.getElementById('bannerDots');
    if (!track || !dotsContenedor) return;

    let banners = BANNER_POR_DEFECTO;

    try {
        const respuesta = await fetch(`${API_URL}/banners`);
        const data = await respuesta.json();

        if (Array.isArray(data) && data.length > 0) {
            banners = data;
        }
    } catch (e) {
        console.warn('Usando banner por defecto:', e);
    }

    track.innerHTML = banners.map((banner) => {
        return `
            <div class="banner-slide">
                <div class="banner-texto">
                    <span class="badge">PLATAFORMA CIUDADANA</span>
                    <h2>${banner.titulo || ''}</h2>
                    <p>${banner.descripcion || ''}</p>
                    ${banner.texto_boton ? `<button type="button" class="banner-btn" onclick="mostrarSeccion('educacion')">${banner.texto_boton}</button>` : ''}
                </div>
            </div>
        `;
    }).join('');

    dotsContenedor.innerHTML = banners.map((_, i) =>
        `<button type="button" class="banner-dot${i === 0 ? ' activo' : ''}" onclick="irABanner(${i})"></button>`
    ).join('');

    bannerIndiceActual = 0;

    if (bannerIntervalo) clearInterval(bannerIntervalo);
    if (banners.length > 1) {
        bannerIntervalo = setInterval(() => {
            irABanner((bannerIndiceActual + 1) % banners.length);
        }, 6000);
    }
}

function irABanner(indice) {
    const track = document.getElementById('bannerTrack');
    if (!track) return;
    bannerIndiceActual = indice;
    track.scrollTo({ left: track.clientWidth * indice, behavior: 'smooth' });
}

/* ==========================================
   INICIALIZACIÓN Y MAPA
========================================== */
document.addEventListener("DOMContentLoaded", async () => {
    cargarReportes();
    inicializarMapa();
    cargarBanners();
    obtenerUbicacionGPS();
});

function obtenerUbicacionGPS() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve(false);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                gpsLat = position.coords.latitude;
                gpsLng = position.coords.longitude;
                if (mapInstance) {
                    mapInstance.setView([gpsLat, gpsLng], 14);
                    L.marker([gpsLat, gpsLng]).addTo(mapInstance).bindPopup("<b>Tu ubicación GPS</b>").openPopup();
                }
                resolve(true);
            },
            () => resolve(false),
            { enableHighAccuracy: true, timeout: 10000 }
        );
    });
}

function inicializarMapa() {
    const contenedorMapa = document.getElementById('mapa-container');
    if (contenedorMapa && !contenedorMapa._leaflet_id) {
        mapInstance = L.map('mapa-container').setView([7.1254, -73.1198], 13);
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            attribution: 'Tiles &copy; Esri'
        }).addTo(mapInstance);

        clusterReportes = L.markerClusterGroup({ maxClusterRadius: 60 });
        mapInstance.addLayer(clusterReportes);
        actualizarMarcadoresMapa();
    }
}

async function actualizarMarcadoresMapa() {
    if (!mapInstance || !clusterReportes) return;
    try {
        const respuesta = await fetch(`${API_URL}/reportes`);
        const reportes = await respuesta.json();
        if (!Array.isArray(reportes)) return;

        clusterReportes.clearLayers();
        reportes.forEach(reporte => {
            if (reporte.lat && reporte.lng) {
                const marcador = L.marker([reporte.lat, reporte.lng]).bindPopup(`<b>${reporte.tipo}</b><br>${reporte.direccion}`);
                clusterReportes.addLayer(marcador);
            }
        });
    } catch (e) {
        console.error('Error al cargar marcadores en el mapa:', e);
    }
}

async function cargarReportes() {
    const contenedor = document.getElementById("listaReportes");
    if (!contenedor) return;

    try {
        const respuesta = await fetch(`${API_URL}/reportes`);
        const reportes = await respuesta.json();
        
        if (!Array.isArray(reportes) || reportes.length === 0) {
            contenedor.innerHTML = `<div class="empty"><div>📋</div><h3>No hay reportes todavía</h3></div>`;
            return;
        }

        contenedor.innerHTML = reportes.map(r => `
            <div style="border: 1px solid var(--borde); padding: 16px; margin-bottom: 12px; border-radius: 12px; background: #fff;">
                <strong>${r.tipo}</strong> (${r.ticket || 'BGA'})<br>
                <span>📍 ${r.direccion}</span><br>
                <span>📝 ${r.descripcion}</span>
            </div>
        `).join('');
    } catch (e) {
        console.error('Error al obtener los reportes:', e);
        contenedor.innerHTML = `<div class="empty"><div>⚠️</div><h3>Error al cargar los reportes</h3></div>`;
    }
}

/* ==========================================
   AUTENTICACIÓN Y REGISTRO DE USUARIOS
========================================== */

async function registrarUsuario(event) {
    if (event) event.preventDefault();

    const nombre = document.getElementById('regNombre')?.value;
    const email = document.getElementById('regEmail')?.value;
    const password = document.getElementById('regPassword')?.value;

    try {
        const respuesta = await fetch(`${API_URL}/registro`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, email, password })
        });

        const resultado = await respuesta.json();

        if (respuesta.ok) {
            alert('¡Registro exitoso! Revisa tu correo para confirmar la cuenta.');
            mostrarSeccion('inicio');
        } else {
            alert('Error en el registro: ' + (resultado.error || 'Inténtalo de nuevo.'));
        }
    } catch (error) {
        console.error('Error de red al registrar:', error);
        alert('No se pudo conectar con el servidor.');
    }
}

async function iniciarSesion(event) {
    if (event) event.preventDefault();

    const email = document.getElementById('loginEmail')?.value;
    const password = document.getElementById('loginPassword')?.value;

    try {
        const respuesta = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const resultado = await respuesta.json();

        if (respuesta.ok) {
            alert('¡Bienvenido de nuevo, ' + resultado.usuario.nombre + '!');
            localStorage.setItem('usuarioLogueado', JSON.stringify(resultado.usuario));
            mostrarSeccion('inicio');
        } else {
            alert('Credenciales incorrectas: ' + (resultado.mensaje || 'Verifica tus datos.'));
        }
    } catch (error) {
        console.error('Error de red al iniciar sesión:', error);
        alert('No se pudo conectar con el servidor.');
    }
}

function verificarSesionParaReportar() {
    const usuario = localStorage.getItem('usuarioLogueado');
    if (!usuario) {
        alert('Debes iniciar sesión para poder crear un reporte.');
        // Descomenta la siguiente línea si tienes una sección o vista llamada "login"
        // mostrarSeccion('login');
        return false;
    }
    return true;
}

/* ==========================================
   CREACIÓN DE REPORTES CIUDADANOS
========================================== */

async function enviarReporte(event) {
    if (event) event.preventDefault();

    // Validar si el usuario inició sesión antes de dejarlo reportar
    if (!verificarSesionParaReportar()) return;

    const tipo = document.getElementById('tipoReporte')?.value;
    const descripcion = document.getElementById('descripcionReporte')?.value;
    const direccion = document.getElementById('direccionReporte')?.value;

    // Usar la ubicación GPS obtenida o valores por defecto en Bucaramanga
    const lat = gpsLat || 7.1254;
    const lng = gpsLng || -73.1198;

    try {
        const respuesta = await fetch(`${API_URL}/reportes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo, descripcion, direccion, lat, lng })
        });

        const resultado = await respuesta.json();

        if (respuesta.ok) {
            alert('¡Reporte guardado con éxito!');
            document.getElementById('formReporte')?.reset();
            cargarReportes();
            actualizarMarcadoresMapa();
            mostrarSeccion('mis-reportes');
        } else {
            alert('Error al guardar el reporte: ' + (resultado.error || 'Inténtalo de nuevo.'));
        }
    } catch (error) {
        console.error('Error de red al enviar reporte:', error);
        alert('No se pudo conectar con el servidor para enviar el reporte.');
    }
}