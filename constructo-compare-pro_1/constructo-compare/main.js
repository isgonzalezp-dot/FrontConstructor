"use strict";
/*
 * ============================================================
 * ConstructoCompare PRO — main.ts
 * Modulo principal de la aplicacion de comparacion de precios
 *
 * Arquitectura:
 *   Este archivo implementa toda la logica de la interfaz principal:
 *   busqueda de productos, filtrado por categoria, gestion del panel
 *   de cotizacion, calculo de totales y exportacion a PDF.
 *
 *   La comunicacion con el backend esta abstraida en el objeto FakeAPI,
 *   cuyos metodos simulan las respuestas del servidor con datos estaticos.
 *   Cada metodo incluye el comentario del endpoint FastAPI que lo reemplazara.
 *
 * Integracion futura:
 *   Para conectar con el backend real basta con:
 *     1. Cambiar CONFIG.USE_MOCK = false
 *     2. Asignar CONFIG.API_BASE_URL a la URL del servidor FastAPI
 *     3. Reemplazar el cuerpo de cada funcion de FakeAPI por fetch()
 * ============================================================
 */
// ─── ESTADO GLOBAL DE LA APLICACION ──────────────────────────
/**
 * AppState centraliza el estado mutable de la aplicacion.
 * Actua como fuente unica de verdad para todos los componentes de la UI.
 * Las funciones de renderizado leen de este objeto para actualizar el DOM.
 */
const AppState = {
    productos: [], // Catalogo completo cargado desde la API
    filteredProductos: [], // Subconjunto filtrado por busqueda y categoria
    quoteItems: [], // Items actuales del panel de cotizacion
    proyectos: [], // Proyectos guardados por el usuario
    currentProyecto: null,
    ufValue: 37500, // Valor UF vigente obtenido desde la API
    searchQuery: "", // Texto de busqueda ingresado por el usuario
    selectedCategory: "Todos", // Categoria activa en el filtro de chips
    isLoading: false,
    quoteOpen: false, // Estado de visibilidad del panel lateral
};
// ─── CONFIGURACION ────────────────────────────────────────────
/**
 * Parametros de configuracion global de la aplicacion.
 * USE_MOCK controla si se utilizan datos simulados o se llama al backend real.
 * MOCK_DELAY simula la latencia de red para un prototipo mas realista.
 */
const CONFIG = {
    API_BASE_URL: "https://api.constructocompare.cl/v1",
    USE_MOCK: true,
    MOCK_DELAY: 600,
    TIENDAS: ["Sodimac", "Easy", "Imperial"],
    CATEGORIAS: [
        "Todos",
        "Cementos y Morteros",
        "Revestimientos",
        "Estructura y Acero",
        "Pinturas",
        "Albanileria",
        "Maderas y Tableros",
        "Gasfiteria",
        "Ferreteria",
        "Impermeabilizacion",
        "Aislacion",
    ],
};
// ─── CAPA DE ACCESO A DATOS (FakeAPI) ─────────────────────────
/**
 * FakeAPI simula las respuestas del backend FastAPI utilizando
 * archivos JSON estaticos y retardos configurables.
 *
 * Cada metodo esta documentado con el endpoint REST equivalente
 * para facilitar la migracion cuando el backend este disponible.
 */
const FakeAPI = {
    /**
     * getProducts(query?, categoria?)
     * ───────────────────────────────────────────────────────────
     * Obtiene la lista de productos del catalogo, opcionalmente filtrada
     * por texto de busqueda y/o categoria.
     *
     * El filtro por texto busca coincidencias parciales (insensibles a
     * mayusculas) en el nombre y la categoria del producto.
     *
     * Integracion futura: GET /api/v1/products?q={query}&categoria={categoria}
     *
     * @param query     - Texto de busqueda opcional
     * @param categoria - Nombre de categoria para filtrar, o undefined para todas
     * @returns         - Array de productos que cumplen los criterios de filtrado
     */
    async getProducts(query, categoria) {
        await delay(CONFIG.MOCK_DELAY);
        const response = await fetch("data/products.json");
        let productos = await response.json();
        if (query && query.trim()) {
            const q = query.toLowerCase();
            productos = productos.filter((p) => p.nombre.toLowerCase().includes(q) ||
                p.categoria.toLowerCase().includes(q));
        }
        if (categoria && categoria !== "Todos") {
            productos = productos.filter((p) => p.categoria === categoria);
        }
        return productos;
    },
    /**
     * getUFValue()
     * ───────────────────────────────────────────────────────────
     * Obtiene el valor vigente de la Unidad de Fomento (UF).
     * En produccion deberia consultar diariamente la API del CMF
     * o una fuente equivalente como mindicador.cl.
     *
     * Integracion futura: GET /api/v1/uf/current
     *   Alternativa directa: GET https://mindicador.cl/api/uf
     *
     * @returns - Objeto con el valor numerico de la UF y la fecha de vigencia
     */
    async getUFValue() {
        await delay(300);
        return {
            valor: 37842.5,
            fecha: new Date().toLocaleDateString("es-CL"),
        };
    },
    /**
     * saveProyecto(proyecto)
     * ───────────────────────────────────────────────────────────
     * Persiste un proyecto de cotizacion en el servidor.
     * En la fase simulada solo retorna un objeto de confirmacion.
     *
     * Integracion futura: POST /api/v1/quotes
     *   Header: Authorization: Bearer <token>
     *   Body: objeto Proyecto serializado
     *
     * @param proyecto - Objeto de proyecto a guardar
     * @returns        - Objeto con flag de exito e ID asignado
     */
    async saveProyecto(proyecto) {
        await delay(400);
        return { success: true, id: proyecto.id };
    },
};
// ─── FUNCIONES UTILITARIAS ────────────────────────────────────
/**
 * delay(ms)
 * Crea una promesa que se resuelve tras el numero de milisegundos indicado.
 * Se utiliza para simular la latencia de red en el modo de datos simulados.
 *
 * @param ms - Milisegundos de espera
 */
function delay(ms) {
    return new Promise((res) => setTimeout(res, ms));
}
/**
 * formatCLP(valor)
 * Formatea un valor numerico como moneda chilena (CLP) utilizando
 * la configuracion regional 'es-CL'. El resultado incluye el simbolo
 * de peso, separadores de miles y sin decimales.
 *
 * Ejemplo: 19990 -> "$19.990"
 *
 * @param valor - Cantidad en pesos chilenos
 * @returns     - Cadena formateada como moneda CLP
 */
function formatCLP(valor) {
    return new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency: "CLP",
        minimumFractionDigits: 0,
    }).format(valor);
}
/**
 * formatUF(valorCLP)
 * Convierte un monto en pesos chilenos a Unidades de Fomento (UF)
 * utilizando el valor almacenado en AppState.ufValue.
 * Muestra el resultado con 2 decimales.
 *
 * Ejemplo: 37842 (con ufValue=37842.5) -> "1.00 UF"
 *
 * @param valorCLP - Monto en pesos chilenos a convertir
 * @returns        - Cadena con el equivalente en UF
 */
function formatUF(valorCLP) {
    const uf = valorCLP / AppState.ufValue;
    return `${uf.toFixed(2)} UF`;
}
/**
 * getBestPrice(producto)
 * Determina la tienda con el menor precio disponible para un producto.
 * Solo considera tiendas con stock disponible. Si ninguna tienda tiene
 * stock, retorna la primera tienda del array como fallback.
 *
 * @param producto - Objeto de producto con array de precios por tienda
 * @returns        - Objeto TiendaInfo correspondiente al mejor precio disponible
 */
function getBestPrice(producto) {
    const disponibles = producto.tiendas.filter((t) => t.stock);
    if (disponibles.length === 0)
        return producto.tiendas[0];
    return disponibles.reduce((a, b) => (a.precio < b.precio ? a : b));
}
/**
 * getTiendaColor(tienda)
 * Retorna el color corporativo asociado a cada cadena de tiendas.
 * Estos colores se usan en los badges, botones de tienda y etiquetas
 * de la cotizacion para identificacion visual rapida.
 *
 * @param tienda - Nombre de la tienda
 * @returns      - Codigo de color hexadecimal
 */
function getTiendaColor(tienda) {
    const colors = {
        Sodimac: "#e53935",
        Easy: "#43a047",
        Imperial: "#1565c0",
    };
    return colors[tienda] || "#666";
}
/**
 * generateId()
 * Genera un identificador unico basado en la marca de tiempo actual
 * y un numero aleatorio codificados en base 36.
 * Se utiliza para asignar IDs a proyectos nuevos.
 *
 * @returns - Cadena alfanumerica unica
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
// ─── FUNCIONES DE COTIZACION ──────────────────────────────────
/**
 * addToQuote(producto, tienda, cantidad)
 * Agrega un producto al panel de cotizacion desde una tienda especifica.
 * Si el mismo producto ya existe en la cotizacion desde la misma tienda,
 * incrementa la cantidad en lugar de crear un item duplicado.
 * Tras actualizar el estado, refresca el panel de cotizacion y el contador
 * del boton del navbar, y muestra un mensaje de confirmacion al usuario.
 *
 * @param producto  - Producto a agregar
 * @param tienda    - Tienda seleccionada con su precio
 * @param cantidad  - Cantidad inicial (por defecto: 1)
 */
function addToQuote(producto, tienda, cantidad = 1) {
    const existing = AppState.quoteItems.find((item) => item.producto.id === producto.id &&
        item.tiendaSeleccionada.tienda === tienda.tienda);
    if (existing) {
        existing.cantidad += cantidad;
    }
    else {
        AppState.quoteItems.push({ producto, tiendaSeleccionada: tienda, cantidad });
    }
    renderQuote();
    showToast("Producto agregado a la cotizacion");
    updateQuoteButton();
}
/**
 * removeFromQuote(index)
 * Elimina un item de la cotizacion a partir de su indice en el array.
 * Tras la eliminacion refresca el panel y el contador del navbar.
 *
 * @param index - Indice del item a eliminar dentro de AppState.quoteItems
 */
function removeFromQuote(index) {
    AppState.quoteItems.splice(index, 1);
    renderQuote();
    updateQuoteButton();
}
/**
 * updateQuantity(index, delta)
 * Modifica la cantidad de un item de la cotizacion.
 * El valor minimo permitido es 1; no se pueden agregar cantidades negativas
 * ni reducir por debajo de la unidad.
 * Tras el cambio refresca el panel de cotizacion.
 *
 * @param index - Indice del item a modificar
 * @param delta - Incremento o decremento (+1 o -1)
 */
function updateQuantity(index, delta) {
    const item = AppState.quoteItems[index];
    if (!item)
        return;
    item.cantidad = Math.max(1, item.cantidad + delta);
    renderQuote();
}
/**
 * calculateTotal()
 * Calcula el monto total de la cotizacion segun los precios
 * de las tiendas seleccionadas actualmente para cada item.
 * Multiplica precio unitario por cantidad para cada item y suma los subtotales.
 *
 * @returns - Objeto con el total en CLP (numerico) y en UF (cadena formateada)
 */
function calculateTotal() {
    const total = AppState.quoteItems.reduce((sum, item) => sum + item.tiendaSeleccionada.precio * item.cantidad, 0);
    return { clp: total, uf: formatUF(total) };
}
/**
 * calculateOptimizedTotal()
 * Calcula el total de la cotizacion si se compra cada producto
 * en la tienda con el mejor precio disponible, independientemente
 * de la tienda que el usuario haya seleccionado para cada item.
 * Tambien calcula el ahorro potencial respecto al total actual.
 *
 * Este calculo permite mostrar al usuario cuanto podria ahorrar
 * si optimiza completamente su compra por tienda.
 *
 * @returns - Objeto con total optimizado en CLP, en UF y monto de ahorro potencial
 */
function calculateOptimizedTotal() {
    const originalTotal = AppState.quoteItems.reduce((sum, item) => sum + item.tiendaSeleccionada.precio * item.cantidad, 0);
    const bestTotal = AppState.quoteItems.reduce((sum, item) => {
        const best = getBestPrice(item.producto);
        return sum + best.precio * item.cantidad;
    }, 0);
    return {
        clp: bestTotal,
        uf: formatUF(bestTotal),
        ahorro: originalTotal - bestTotal,
    };
}
// ─── FUNCIONES DE RENDERIZADO ─────────────────────────────────
/**
 * renderProducts(productos)
 * Genera y muestra en el DOM la grilla de tarjetas de productos.
 * Si el array esta vacio, muestra un estado de "sin resultados".
 * Tras insertar el HTML, adjunta los eventos a los botones de
 * agregar al mejor precio y a los botones de tienda individual.
 *
 * @param productos - Array de productos a renderizar en la grilla
 */
function renderProducts(productos) {
    const grid = document.getElementById("products-grid");
    const count = document.getElementById("results-count");
    count.textContent = `${productos.length} producto${productos.length !== 1 ? "s" : ""} encontrado${productos.length !== 1 ? "s" : ""}`;
    if (productos.length === 0) {
        grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">-</div>
        <h3>Sin resultados</h3>
        <p>No se encontraron productos para la busqueda realizada</p>
      </div>`;
        return;
    }
    grid.innerHTML = productos.map((p) => renderProductCard(p)).join("");
    /* Adjuntar eventos al boton de agregar al mejor precio */
    grid.querySelectorAll(".btn-add-best").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            const target = e.currentTarget;
            const id = target.dataset.id;
            const producto = AppState.productos.find((p) => p.id === id);
            const best = getBestPrice(producto);
            addToQuote(producto, best);
        });
    });
    /* Adjuntar eventos a los botones de tienda individual */
    grid.querySelectorAll(".tienda-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            const target = e.currentTarget;
            const pid = target.dataset.pid;
            const tiendaNom = target.dataset.tienda;
            const producto = AppState.productos.find((p) => p.id === pid);
            const tiendaInfo = producto.tiendas.find((t) => t.tienda === tiendaNom);
            if (tiendaInfo.stock)
                addToQuote(producto, tiendaInfo);
        });
    });
}
/**
 * renderProductCard(producto)
 * Genera el HTML de una tarjeta de producto individual.
 * La tarjeta muestra: categoria, ahorro potencial, imagen, nombre,
 * precio optimo con equivalente en UF, lista de precios por tienda
 * con indicador del mejor precio, y boton de accion principal.
 *
 * @param producto - Producto a representar como tarjeta HTML
 * @returns        - Cadena de HTML de la tarjeta
 */
function renderProductCard(producto) {
    const best = getBestPrice(producto);
    const maxPrice = Math.max(...producto.tiendas.map((t) => t.precio));
    const savings = maxPrice - best.precio;
    const tiendasHTML = producto.tiendas
        .map((t) => {
        const isBest = t.tienda === best.tienda && t.precio === best.precio;
        return `
        <button class="tienda-btn ${!t.stock ? "out-of-stock" : ""} ${isBest ? "is-best" : ""}"
                data-pid="${producto.id}" data-tienda="${t.tienda}"
                ${!t.stock ? "disabled title='Sin stock en esta tienda'" : ""}>
          <span class="tienda-dot" style="background:${getTiendaColor(t.tienda)}"></span>
          <span class="tienda-name">${t.tienda}</span>
          <span class="tienda-price">${formatCLP(t.precio)}</span>
          ${isBest ? '<span class="best-badge">MEJOR</span>' : ""}
          ${!t.stock ? '<span class="stock-badge">Sin stock</span>' : ""}
        </button>`;
    })
        .join("");
    return `
    <article class="product-card" data-id="${producto.id}" role="listitem">
      <div class="card-header">
        <span class="category-chip">${producto.categoria}</span>
        ${savings > 0 ? `<span class="savings-chip">Ahorra ${formatCLP(savings)}</span>` : ""}
      </div>
      <div class="card-image">
        <img src="${producto.imagen}" alt="${producto.nombre}" loading="lazy"/>
      </div>
      <div class="card-body">
        <h3 class="product-name">${producto.nombre}</h3>
        <p class="product-unit">Por ${producto.unidad}</p>
        <div class="price-highlight">
          <span class="best-price-label">Mejor precio</span>
          <span class="best-price-value">${formatCLP(best.precio)}</span>
          <span class="best-price-uf">${formatUF(best.precio)}</span>
        </div>
        <div class="tiendas-list">${tiendasHTML}</div>
      </div>
      <div class="card-footer">
        <button class="btn-add-best" data-id="${producto.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Agregar al mejor precio
        </button>
      </div>
    </article>`;
}
/**
 * renderQuote()
 * Actualiza el contenido del panel lateral de cotizacion con el estado
 * actual de AppState.quoteItems. Muestra un estado vacio si no hay items,
 * o bien la lista de items con controles de cantidad, precios y totales.
 * Tambien actualiza la visualizacion del ahorro total si corresponde.
 */
function renderQuote() {
    const container = document.getElementById("quote-items");
    const totalEl = document.getElementById("quote-total");
    const ufTotalEl = document.getElementById("quote-total-uf");
    const savingsEl = document.getElementById("quote-savings");
    if (AppState.quoteItems.length === 0) {
        container.innerHTML = `
      <div class="quote-empty">
        <div class="quote-empty-icon">-</div>
        <p>La cotizacion esta vacia</p>
        <small>Agregue productos desde el catalogo</small>
      </div>`;
        totalEl.textContent = formatCLP(0);
        ufTotalEl.textContent = "0.00 UF";
        savingsEl.style.display = "none";
        return;
    }
    const { clp, uf, ahorro } = calculateOptimizedTotal();
    container.innerHTML = AppState.quoteItems
        .map((item, i) => `
      <div class="quote-item">
        <div class="quote-item-info">
          <span class="quote-item-name">${item.producto.nombre}</span>
          <span class="quote-item-store" style="color:${getTiendaColor(item.tiendaSeleccionada.tienda)}">
            ${item.tiendaSeleccionada.tienda}
          </span>
        </div>
        <div class="quote-item-controls">
          <button class="qty-btn" onclick="updateQuantity(${i}, -1)">-</button>
          <span class="qty-value">${item.cantidad}</span>
          <button class="qty-btn" onclick="updateQuantity(${i}, 1)">+</button>
        </div>
        <div class="quote-item-price">
          ${formatCLP(item.tiendaSeleccionada.precio * item.cantidad)}
        </div>
        <button class="quote-item-remove" onclick="removeFromQuote(${i})" title="Eliminar item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>`)
        .join("");
    totalEl.textContent = formatCLP(clp);
    ufTotalEl.textContent = uf;
    if (ahorro > 0) {
        savingsEl.style.display = "flex";
        savingsEl.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
        <polyline points="17 6 23 6 23 12"/>
      </svg>
      Ahorro total respecto al precio mayor: ${formatCLP(ahorro)}`;
    }
    else {
        savingsEl.style.display = "none";
    }
}
/**
 * updateQuoteButton()
 * Actualiza el badge numerico del boton de cotizacion en el navbar.
 * Muestra la cantidad de items distintos en la cotizacion, o lo oculta
 * si la cotizacion esta vacia.
 */
function updateQuoteButton() {
    const btn = document.getElementById("quote-toggle");
    const count = AppState.quoteItems.length;
    const badge = btn.querySelector(".quote-badge");
    if (badge)
        badge.textContent = count > 0 ? String(count) : "";
    badge.style.display = count > 0 ? "flex" : "none";
}
/**
 * showToast(msg)
 * Muestra un mensaje de notificacion temporal en la parte inferior
 * de la pantalla. El toast aparece con animacion, permanece visible
 * 2.5 segundos y desaparece con una transicion de salida.
 *
 * @param msg - Texto a mostrar en la notificacion
 */
function showToast(msg) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add("toast-show"), 10);
    setTimeout(() => {
        toast.classList.remove("toast-show");
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}
// ─── EXPORTACION A PDF ────────────────────────────────────────
/**
 * exportToPDF()
 * Genera una cotizacion en formato PDF imprimible a partir del estado
 * actual del panel de cotizacion. Construye un documento HTML completo
 * con los datos de la cotizacion y lo abre en una ventana nueva,
 * activando el dialogo de impresion del navegador para guardar como PDF.
 *
 * Si la cotizacion esta vacia, muestra una notificacion informativa
 * sin abrir la ventana de impresion.
 */
function exportToPDF() {
    if (AppState.quoteItems.length === 0) {
        showToast("Agregue productos antes de exportar la cotizacion");
        return;
    }
    const { clp, uf } = calculateOptimizedTotal();
    const date = new Date().toLocaleDateString("es-CL");
    const rows = AppState.quoteItems
        .map((item) => `
      <tr>
        <td>${item.producto.nombre}</td>
        <td>${item.tiendaSeleccionada.tienda}</td>
        <td style="text-align:center">${item.cantidad}</td>
        <td style="text-align:right">${formatCLP(item.tiendaSeleccionada.precio)}</td>
        <td style="text-align:right">${formatCLP(item.tiendaSeleccionada.precio * item.cantidad)}</td>
      </tr>`)
        .join("");
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Cotizacion ConstructoCompare PRO</title>
<style>
  body { font-family: Arial, sans-serif; padding: 40px; color: #1E3A5F; }
  h1 { color: #1E3A5F; }
  span.orange { color: #F57C00; }
  table { width: 100%; border-collapse: collapse; margin-top: 24px; }
  th { background: #1E3A5F; color: #fff; padding: 10px 12px; text-align: left; }
  td { padding: 9px 12px; border-bottom: 1px solid #eee; }
  tr:nth-child(even) td { background: #f8f9fb; }
  .total-row td { font-weight: bold; background: #FFF3E0; color: #E65100; font-size: 1.1em; }
  .footer { margin-top: 32px; font-size: 0.85em; color: #888; }
</style>
</head>
<body>
<h1>ConstructoCompare <span class="orange">PRO</span></h1>
<p><strong>Fecha de cotizacion:</strong> ${date}</p>
<p><strong>Valor UF del dia:</strong> ${formatCLP(AppState.ufValue)}</p>
<table>
  <thead>
    <tr><th>Producto</th><th>Tienda</th><th>Cantidad</th><th>P. Unitario</th><th>Subtotal</th></tr>
  </thead>
  <tbody>
    ${rows}
    <tr class="total-row">
      <td colspan="4">TOTAL</td>
      <td>${formatCLP(clp)} / ${uf}</td>
    </tr>
  </tbody>
</table>
<div class="footer">
  Cotizacion generada por ConstructoCompare PRO.<br/>
  Los precios son referenciales. Verifique disponibilidad y precio vigente en cada tienda.
</div>
</body></html>`;
    const win = window.open("", "_blank");
    if (win) {
        win.document.write(html);
        win.document.close();
        win.print();
    }
}
// ─── INICIALIZACION ───────────────────────────────────────────
/**
 * init()
 * Funcion principal de inicializacion de la aplicacion.
 * Se ejecuta una sola vez al cargar el DOM y realiza las siguientes acciones:
 *   1. Renderiza los chips de filtro de categoria en la barra superior.
 *   2. Obtiene el valor UF desde FakeAPI y lo muestra en el navbar.
 *   3. Carga el catalogo inicial de productos.
 *   4. Registra todos los listeners de eventos de la interfaz:
 *      - Busqueda con debounce de 300ms.
 *      - Apertura y cierre del panel de cotizacion.
 *      - Exportacion a PDF.
 *      - Guardado de cotizacion (requiere sesion activa).
 *      - Vaciado de cotizacion.
 *   5. Renderiza el estado inicial del panel de cotizacion (vacio).
 */
async function init() {
    renderCategoryFilters();
    /* Obtener valor UF actualizado */
    const ufData = await FakeAPI.getUFValue();
    AppState.ufValue = ufData.valor;
    const ufEl = document.getElementById("uf-value");
    if (ufEl)
        ufEl.textContent = `${formatCLP(ufData.valor)}`;
    /* Cargar productos iniciales */
    await loadProducts();
    /* Listener de busqueda con debounce para optimizar rendimiento */
    const searchInput = document.getElementById("search-input");
    searchInput?.addEventListener("input", debounce(async () => {
        AppState.searchQuery = searchInput.value;
        await loadProducts();
    }, 300));
    /* Apertura del panel de cotizacion */
    document.getElementById("quote-toggle")?.addEventListener("click", () => {
        AppState.quoteOpen = !AppState.quoteOpen;
        document.getElementById("quote-panel")?.classList.toggle("open", AppState.quoteOpen);
        document.getElementById("overlay")?.classList.toggle("visible", AppState.quoteOpen);
    });
    /* Cierre del panel al hacer clic en el overlay semitransparente */
    document.getElementById("overlay")?.addEventListener("click", () => {
        AppState.quoteOpen = false;
        document.getElementById("quote-panel")?.classList.remove("open");
        document.getElementById("overlay")?.classList.remove("visible");
    });
    /* Boton de cierre dentro del panel de cotizacion */
    document.getElementById("close-quote")?.addEventListener("click", () => {
        AppState.quoteOpen = false;
        document.getElementById("quote-panel")?.classList.remove("open");
        document.getElementById("overlay")?.classList.remove("visible");
    });
    /* Exportacion de la cotizacion a PDF */
    document.getElementById("export-pdf")?.addEventListener("click", exportToPDF);
    /* Vaciado completo de la cotizacion */
    document.getElementById("clear-quote")?.addEventListener("click", () => {
        if (confirm("Esta accion eliminara todos los items de la cotizacion. Desea continuar?")) {
            AppState.quoteItems = [];
            renderQuote();
            updateQuoteButton();
        }
    });
    /*
     * Guardado de cotizacion en el historial personal del usuario.
     * Requiere sesion activa. Si no hay sesion, redirige al login.
     * El nombre del proyecto se solicita mediante un prompt al usuario.
     */
    document.getElementById("save-quote")?.addEventListener("click", () => {
        if (AppState.quoteItems.length === 0) {
            showToast("Agregue productos antes de guardar la cotizacion");
            return;
        }
        const authModule = window.Auth;
        if (!authModule?.isLoggedIn?.()) {
            showToast("Debe iniciar sesion para guardar cotizaciones");
            setTimeout(() => { window.location.href = "login.html"; }, 1200);
            return;
        }
        const { clp, uf } = calculateOptimizedTotal();
        const nombre = prompt("Ingrese un nombre para identificar este proyecto:") || "Cotizacion sin nombre";
        const quoteData = {
            nombre,
            items: AppState.quoteItems.map(item => ({
                nombre: item.producto.nombre,
                tienda: item.tiendaSeleccionada.tienda,
                precio: item.tiendaSeleccionada.precio,
                cantidad: item.cantidad,
                color: getTiendaColor(item.tiendaSeleccionada.tienda),
            })),
            total: clp,
            totalUF: uf,
        };
        authModule?.saveQuote?.(quoteData);
        showToast("Cotizacion guardada correctamente en su historial");
    });
    renderQuote();
}
/**
 * loadProducts()
 * Obtiene los productos desde FakeAPI aplicando los filtros actuales
 * del AppState (searchQuery y selectedCategory), actualiza el catalogo
 * en el estado global y dispara el renderizado de la grilla.
 * Muestra un indicador de carga mientras espera la respuesta.
 * En caso de error muestra un estado de error en la grilla.
 */
async function loadProducts() {
    const grid = document.getElementById("products-grid");
    grid.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>Cargando productos...</p>
    </div>`;
    try {
        const productos = await FakeAPI.getProducts(AppState.searchQuery, AppState.selectedCategory);
        AppState.productos = productos;
        renderProducts(productos);
    }
    catch (err) {
        grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">!</div>
        <h3>Error de conexion</h3>
        <p>No se pudieron cargar los productos. Intente nuevamente.</p>
      </div>`;
    }
}
/**
 * renderCategoryFilters()
 * Genera los chips de filtro de categoria a partir de CONFIG.CATEGORIAS
 * y los inyecta en el contenedor correspondiente del DOM.
 * Adjunta un listener a cada chip para actualizar la categoria seleccionada
 * y recargar el catalogo filtrado al hacer clic.
 */
function renderCategoryFilters() {
    const container = document.getElementById("category-filters");
    container.innerHTML = CONFIG.CATEGORIAS.map((cat) => `
    <button class="filter-chip ${cat === "Todos" ? "active" : ""}" data-cat="${cat}">
      ${cat}
    </button>`).join("");
    container.querySelectorAll(".filter-chip").forEach((btn) => {
        btn.addEventListener("click", async () => {
            container.querySelectorAll(".filter-chip").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            AppState.selectedCategory = btn.dataset.cat;
            await loadProducts();
        });
    });
}
/**
 * debounce(fn, ms)
 * Retorna una version de la funcion indicada que retrasa su ejecucion
 * hasta que transcurran los milisegundos especificados desde la ultima
 * invocacion. Se utiliza en el campo de busqueda para evitar llamadas
 * excesivas a la API mientras el usuario escribe.
 *
 * @param fn - Funcion a aplicar el debounce
 * @param ms - Tiempo de espera en milisegundos
 * @returns  - Funcion envuelta con control de debounce
 */
function debounce(fn, ms) {
    let timer;
    return ((...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    });
}
// ─── EXPOSICION DE FUNCIONES GLOBALES ─────────────────────────
/*
 * Las siguientes funciones se exponen en el objeto window porque
 * son invocadas desde atributos onclick generados dinamicamente
 * en el HTML de los items de cotizacion. Esto es necesario porque
 * TypeScript compila el modulo en un ambito cerrado.
 */
window.updateQuantity = updateQuantity;
window.removeFromQuote = removeFromQuote;
// ─── PUNTO DE ENTRADA ─────────────────────────────────────────
/**
 * Punto de entrada de la aplicacion.
 * Se ejecuta cuando el DOM esta completamente cargado y disponible.
 */
document.addEventListener("DOMContentLoaded", init);
//# sourceMappingURL=main.js.map