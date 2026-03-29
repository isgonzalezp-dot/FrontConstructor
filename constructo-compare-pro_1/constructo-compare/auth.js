/*
 * ============================================================
 * ConstructoCompare PRO — auth.js
 * Modulo compartido de autenticacion y gestion de sesiones
 *
 * Este modulo implementa el patron IIFE (Immediately Invoked
 * Function Expression) para encapsular la logica de autenticacion
 * y exponer unicamente las funciones publicas necesarias.
 *
 * En la fase actual el almacenamiento se realiza en:
 *   - localStorage:    usuarios registrados, cotizaciones guardadas,
 *                      preferencias de sesion (recordar email).
 *   - sessionStorage:  sesion activa del usuario y del administrador.
 *
 * Integracion futura con backend FastAPI:
 *   Cada funcion incluye el comentario del endpoint REST que la
 *   reemplazara. El procedimiento de migracion consiste en:
 *     1. Cambiar CONFIG.USE_MOCK = false en main.js.
 *     2. Sustituir la logica local por fetch() al endpoint indicado.
 *     3. Almacenar el JWT retornado en sessionStorage bajo 'cc_token'.
 *     4. Incluir el header Authorization: Bearer <token> en cada
 *        peticion autenticada.
 * ============================================================
 */

const Auth = (() => {

  /*
   * Claves utilizadas para el almacenamiento en localStorage y sessionStorage.
   * Centralizar estas constantes facilita el cambio de nombres si es necesario.
   */
  const USERS_KEY   = 'cc_registered_users'; // Array de usuarios registrados en localStorage
  const SESSION_KEY = 'cc_user_session';      // Objeto de sesion del cliente en sessionStorage
  const ADMIN_KEY   = 'admin_session';        // Objeto de sesion del administrador en sessionStorage

  /*
   * Usuarios de demostracion precargados.
   * Permiten explorar la plataforma sin necesidad de registro previo.
   * Estos registros se combinan con los usuarios almacenados en localStorage
   * evitando duplicados por direccion de correo electronico.
   *
   * Integracion futura: estos datos seran devueltos directamente por el backend.
   * No se requiere logica adicional en el cliente.
   */
  const DEMO_USERS = [
    {
      id:            'U_DEMO1',
      nombre:        'Usuario Demo',
      email:         'usuario@demo.cl',
      password:      'demo123',
      empresa:       'Constructora Demo',
      telefono:      '+56912345678',
      tipo:          'Profesional',
      avatar:        'UD',
      fechaRegistro: '2024-01-01',
      cotizaciones:  0
    }
  ];

  /*
   * getRegisteredUsers()
   * ─────────────────────────────────────────────────────────────
   * Recupera el listado completo de usuarios disponibles en el sistema.
   * Combina los usuarios almacenados en localStorage con los usuarios
   * de demostracion precargados, evitando duplicados por email.
   *
   * En caso de error al leer o parsear localStorage (por ejemplo,
   * si los datos estan corruptos), retorna unicamente los usuarios demo.
   *
   * Integracion futura: GET /api/v1/admin/users  (requiere JWT de admin)
   *
   * @returns {Array} Lista de objetos de usuario
   */
  function getRegisteredUsers() {
    try {
      const stored       = localStorage.getItem(USERS_KEY);
      const stored_users = stored ? JSON.parse(stored) : [];
      const all          = [...DEMO_USERS];
      stored_users.forEach(u => {
        if (!all.find(d => d.email === u.email)) all.push(u);
      });
      return all;
    } catch {
      return [...DEMO_USERS];
    }
  }

  /*
   * saveUser(userData)
   * ─────────────────────────────────────────────────────────────
   * Persiste un nuevo usuario en el array almacenado en localStorage.
   * Se invoca al completar exitosamente el formulario de registro.
   * Tras guardar el usuario, la funcion login() debe ser llamada
   * para crear la sesion de forma automatica.
   *
   * Integracion futura: POST /api/v1/auth/register
   *   Body: { nombre, email, password, empresa, telefono, tipo }
   *   Respuesta: { user, access_token }
   *
   * @param  {Object}  userData - Objeto con los datos del nuevo usuario
   * @returns {boolean} true si el guardado fue exitoso, false si hubo error
   */
  function saveUser(userData) {
    try {
      const stored = localStorage.getItem(USERS_KEY);
      const users  = stored ? JSON.parse(stored) : [];
      users.push(userData);
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      return true;
    } catch {
      return false;
    }
  }

  /*
   * getUserByEmail(email)
   * ─────────────────────────────────────────────────────────────
   * Busca y retorna un usuario a partir de su direccion de correo
   * electronico. La comparacion se realiza sin distinguir mayusculas
   * de minusculas para mayor tolerancia al ingreso de datos.
   *
   * Se utiliza durante el proceso de registro para verificar si el
   * email ya esta en uso, y durante el login para encontrar la cuenta.
   *
   * Integracion futura: GET /api/v1/users/by-email?email={email}
   *   (solo disponible para administradores o internamente)
   *
   * @param  {string} email - Direccion de correo electronico a buscar
   * @returns {Object|null} Objeto de usuario si existe, null si no se encuentra
   */
  function getUserByEmail(email) {
    return getRegisteredUsers().find(
      u => u.email.toLowerCase() === email.toLowerCase()
    ) || null;
  }

  /*
   * getSession()
   * ─────────────────────────────────────────────────────────────
   * Recupera el objeto de sesion activa del usuario cliente desde
   * sessionStorage. Retorna null si no existe sesion o si el valor
   * almacenado no puede ser parseado como JSON valido.
   *
   * El objeto de sesion contiene: id, nombre, email, empresa, avatar,
   * tipo de usuario y fecha/hora de inicio de sesion.
   *
   * Integracion futura: la sesion se verificara validando el JWT
   * almacenado en sessionStorage contra el endpoint:
   *   GET /api/v1/auth/me  (Header: Authorization: Bearer <token>)
   *
   * @returns {Object|null} Objeto de sesion del cliente o null
   */
  function getSession() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    } catch {
      return null;
    }
  }

  /*
   * getAdminSession()
   * ─────────────────────────────────────────────────────────────
   * Recupera el objeto de sesion activa del administrador desde
   * sessionStorage. Las sesiones de cliente y administrador son
   * completamente independientes y utilizan claves distintas.
   *
   * Se utiliza en admin-panel.html como guard de autenticacion:
   * si no existe sesion de admin, se redirige al login.
   *
   * @returns {Object|null} Objeto de sesion del administrador o null
   */
  function getAdminSession() {
    try {
      return JSON.parse(sessionStorage.getItem(ADMIN_KEY) || 'null');
    } catch {
      return null;
    }
  }

  /*
   * isLoggedIn()
   * ─────────────────────────────────────────────────────────────
   * Verifica si existe una sesion de usuario cliente activa.
   * Se utiliza como guard en paginas que requieren autenticacion
   * y para actualizar el navbar de forma dinamica.
   *
   * @returns {boolean} true si hay sesion activa, false en caso contrario
   */
  function isLoggedIn() {
    return getSession() !== null;
  }

  /*
   * login(email, password)
   * ─────────────────────────────────────────────────────────────
   * Ejecuta el proceso de autenticacion para usuarios clientes.
   * Busca el usuario por email y compara la contrasena directamente.
   *
   * En caso de exito, crea el objeto de sesion en sessionStorage
   * con los datos del usuario (sin incluir la contrasena).
   *
   * Codigos de error retornados:
   *   'email_not_found' - No existe cuenta con ese email
   *   'wrong_password'  - El email existe pero la contrasena no coincide
   *
   * Integracion futura: POST /api/v1/auth/login
   *   Body: { email, password }
   *   Respuesta exitosa: { access_token, token_type, user }
   *   La contrasena nunca debe enviarse en texto plano en produccion;
   *   el backend debe utilizar bcrypt para la verificacion.
   *
   * @param  {string} email    - Correo electronico del usuario
   * @param  {string} password - Contrasena en texto plano (solo en fase demo)
   * @returns {Object} { success: boolean, user?: Object, error?: string }
   */
  function login(email, password) {
    const user = getUserByEmail(email);
    if (!user)                  return { success: false, error: 'email_not_found' };
    if (user.password !== password) return { success: false, error: 'wrong_password' };

    const session = {
      id:      user.id,
      nombre:  user.nombre,
      email:   user.email,
      empresa: user.empresa || '',
      avatar:  user.avatar,
      tipo:    user.tipo,
      loginAt: new Date().toISOString()
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { success: true, user: session };
  }

  /*
   * logout()
   * ─────────────────────────────────────────────────────────────
   * Cierra la sesion del usuario cliente eliminando su objeto de sesion
   * de sessionStorage y redirigiendo a la pagina principal de la plataforma.
   *
   * Integracion futura: POST /api/v1/auth/logout
   *   Invalida el JWT en el servidor (lista negra o revocacion de token).
   *   Luego eliminar el token de sessionStorage y redirigir.
   */
  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = 'landing.html';
  }

  /*
   * saveQuote(quoteData)
   * ─────────────────────────────────────────────────────────────
   * Guarda una cotizacion en el historial personal del usuario activo.
   * Las cotizaciones se almacenan en localStorage bajo una clave
   * especifica por email: 'cc_quotes_{email}'.
   * Cada cotizacion nueva se inserta al inicio del array para que
   * la mas reciente aparezca primero en el historial.
   *
   * Requiere que exista una sesion activa para poder guardar.
   *
   * Integracion futura: POST /api/v1/quotes
   *   Header: Authorization: Bearer <token>
   *   Body: { nombre, items, total, totalUF }
   *   Respuesta: { id, fecha, ...quoteData }
   *
   * @param  {Object}  quoteData - Objeto con nombre, items, total y totalUF
   * @returns {boolean} true si se guardo correctamente, false si no hay sesion o hubo error
   */
  function saveQuote(quoteData) {
    const session = getSession();
    if (!session) return false;
    const key = 'cc_quotes_' + session.email;
    try {
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.unshift({
        ...quoteData,
        id:    'COT-' + Date.now(),
        fecha: new Date().toLocaleDateString('es-CL')
      });
      localStorage.setItem(key, JSON.stringify(existing));
      return true;
    } catch {
      return false;
    }
  }

  /*
   * getUserQuotes()
   * ─────────────────────────────────────────────────────────────
   * Recupera el historial de cotizaciones del usuario con sesion activa.
   * Las cotizaciones estan ordenadas de mas reciente a mas antigua.
   *
   * Si no existe sesion activa o si ocurre un error al leer localStorage,
   * retorna un array vacio para evitar errores en el componente de historial.
   *
   * Integracion futura: GET /api/v1/quotes
   *   Header: Authorization: Bearer <token>
   *   Respuesta: Array de objetos de cotizacion del usuario autenticado
   *
   * @returns {Array} Lista de cotizaciones guardadas, o array vacio
   */
  function getUserQuotes() {
    const session = getSession();
    if (!session) return [];
    try {
      return JSON.parse(
        localStorage.getItem('cc_quotes_' + session.email) || '[]'
      );
    } catch {
      return [];
    }
  }

  /*
   * deleteQuote(quoteId)
   * ─────────────────────────────────────────────────────────────
   * Elimina una cotizacion del historial personal del usuario activo,
   * identificandola por su campo 'id'. Filtra el array existente
   * y persiste el resultado sin el elemento eliminado.
   *
   * Integracion futura: DELETE /api/v1/quotes/{quoteId}
   *   Header: Authorization: Bearer <token>
   *   El backend debe verificar que la cotizacion pertenece al usuario
   *   autenticado antes de eliminarla.
   *
   * @param  {string}  quoteId - Identificador unico de la cotizacion a eliminar
   * @returns {boolean} true si se elimino correctamente, false si hubo error
   */
  function deleteQuote(quoteId) {
    const session = getSession();
    if (!session) return false;
    const key = 'cc_quotes_' + session.email;
    try {
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const updated  = existing.filter(q => q.id !== quoteId);
      localStorage.setItem(key, JSON.stringify(updated));
      return true;
    } catch {
      return false;
    }
  }

  /*
   * getInitials(nombre)
   * ─────────────────────────────────────────────────────────────
   * Genera las iniciales del nombre de un usuario para mostrar
   * en el avatar circular del navbar y del panel de administracion.
   * Toma la primera letra de cada palabra y retorna un maximo de 2 caracteres
   * en mayusculas. Si el nombre esta vacio, retorna la letra 'U'.
   *
   * @param  {string} nombre - Nombre completo del usuario
   * @returns {string} Iniciales en mayusculas (1 o 2 caracteres)
   */
  function getInitials(nombre) {
    return (nombre || 'U')
      .split(' ')
      .map(n => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  /*
   * renderNavAuth(containerId)
   * ─────────────────────────────────────────────────────────────
   * Inyecta dinamicamente el componente de autenticacion en el navbar
   * de la aplicacion principal. El contenido varia segun el estado de sesion:
   *
   *   Sin sesion activa:
   *     Muestra los botones "Ingresar" y "Registrarse gratis".
   *
   *   Con sesion activa:
   *     Muestra el avatar del usuario, su nombre y un menu desplegable
   *     con accesos a "Mis cotizaciones" y "Cerrar sesion".
   *
   * El menu desplegable se abre y cierra mediante un listener de clic.
   * Un segundo listener en el documento cierra el menu al hacer clic fuera de el.
   *
   * @param {string} containerId - ID del elemento HTML donde se insertara el componente
   */
  function renderNavAuth(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const session = getSession();

    if (session) {
      /* Estado autenticado: mostrar avatar y menu de usuario */
      container.innerHTML = `
        <div class="nav-user-menu" id="nav-user-menu">
          <button class="nav-user-btn" id="nav-user-btn" type="button">
            <div class="nav-avatar">${session.avatar || getInitials(session.nombre)}</div>
            <span class="nav-user-name">${session.nombre.split(' ')[0]}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <div class="nav-dropdown" id="nav-dropdown">
            <div class="nav-dropdown-header">
              <div class="nav-dropdown-avatar">${session.avatar || getInitials(session.nombre)}</div>
              <div>
                <div class="nav-dropdown-name">${session.nombre}</div>
                <div class="nav-dropdown-email">${session.email}</div>
              </div>
            </div>
            <div class="nav-dropdown-divider"></div>
            <a class="nav-dropdown-item" href="mis-cotizaciones.html">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              Mis cotizaciones
            </a>
            <div class="nav-dropdown-divider"></div>
            <button class="nav-dropdown-item danger" onclick="Auth.logout()" type="button">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Cerrar sesion
            </button>
          </div>
        </div>`;

      /* Listener para abrir/cerrar el menu desplegable */
      document.getElementById('nav-user-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('nav-dropdown')?.classList.toggle('open');
      });

      /* Listener global para cerrar el menu al hacer clic fuera de el */
      document.addEventListener('click', () => {
        document.getElementById('nav-dropdown')?.classList.remove('open');
      });

    } else {
      /* Estado sin sesion: mostrar acciones de ingreso y registro */
      container.innerHTML = `
        <a href="login.html"    class="nav-auth-btn ghost">Ingresar</a>
        <a href="register.html" class="nav-auth-btn primary">Registrarse gratis</a>`;
    }
  }

  /*
   * API publica del modulo Auth.
   * Solo las funciones listadas aqui son accesibles desde fuera del modulo.
   * El resto de funciones internas permanecen encapsuladas.
   */
  return {
    getSession,
    getAdminSession,
    isLoggedIn,
    login,
    logout,
    saveUser,
    getUserByEmail,
    getRegisteredUsers,
    saveQuote,
    getUserQuotes,
    deleteQuote,
    getInitials,
    renderNavAuth
  };

})();
