# Guía de Actualización: Refactorización del Frontend

## Cambios Realizados

### 1. Instalación de Dependencias
Se agregó `react-router-dom@6.22.0` para enrutamiento moderno.

**Antes:**
```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  }
}
```

**Después:**
```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.22.0"
  }
}
```

### 2. Nuevos Componentes

#### `src/components/Layout.jsx`
- Envuelve toda la aplicación con navegación persistente
- Incluye Sidebar colapsable con iconos y etiquetas
- Header responsivo que muestra el módulo actual
- Navegación activa marcada con colores distintos
- Totalmente responsivo (sidebar se adapta a móvil)

**Features:**
- Toggle para colapsar/expandir sidebar
- Animaciones suave (transiciones de 300ms)
- Paleta corporativa: Azul marino oscuro (#111827) + Blanco
- Indicadores de notificación y perfil en header

### 3. Nuevas Páginas

#### `src/pages/DashboardPage.jsx`
- **Cambio principal**: El contenido de `src/pages/Dashboard.jsx` fue movido aquí
- Mantiene el mismo comportamiento (resumen + tabla de préstamos)
- Ahora integrada dentro del Layout

#### `src/pages/ClientesPage.jsx`
- Página vacía pero enrutada correctamente
- Estructura lista para agregar gestión de clientes
- Botón "Nuevo Cliente" listo para implementar

#### `src/pages/PrestamosPage.jsx`
- Página vacía pero enrutada correctamente
- Estructura lista para agregar gestión de préstamos
- Botón "Nuevo Préstamo" listo para implementar

#### `src/pages/PagosPage.jsx`
- Página vacía pero enrutada correctamente
- Estructura lista para agregar gestión de pagos
- Botón "Registrar Pago" listo para implementar

### 4. Actualización de App.jsx

**Antes:**
```jsx
import Dashboard from './pages/Dashboard'

function App() {
  return <Dashboard />
}

export default App
```

**Después:**
```jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import ClientesPage from './pages/ClientesPage'
import PrestamosPage from './pages/PrestamosPage'
import PagosPage from './pages/PagosPage'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Layout><DashboardPage /></Layout>} />
        <Route path="/clientes" element={<Layout><ClientesPage /></Layout>} />
        <Route path="/prestamos" element={<Layout><PrestamosPage /></Layout>} />
        <Route path="/pagos" element={<Layout><PagosPage /></Layout>} />
        <Route path="*" element={<Layout><NotFound /></Layout>} />
      </Routes>
    </Router>
  )
}
```

## Cómo Actualizar tu Entorno

### Paso 1: Instalar nuevas dependencias
```bash
cd frontend
npm install
```

### Paso 2: Limpiar cache (opcional)
```bash
rm -rf node_modules/.vite
```

### Paso 3: Reiniciar servidor de desarrollo
```bash
npm run dev
```

La aplicación debe estar disponible en `http://localhost:3000` con la nueva interfaz.

## Navegación

El sidebar ahora contiene:
- 📊 Dashboard → `/dashboard`
- 👥 Clientes → `/clientes`
- 💰 Préstamos → `/prestamos`
- 💳 Pagos → `/pagos`

Puedes colapsar/expandir el sidebar con el botón ◀ / ▶.

## Estructura de Archivos Actual

```
frontend/src/
├── components/
│   ├── Layout.jsx         ← NUEVO
│   ├── Card.jsx
│   └── LoansTable.jsx
├── pages/
│   ├── DashboardPage.jsx  ← MOVIDO (antes era Dashboard.jsx)
│   ├── ClientesPage.jsx   ← NUEVO
│   ├── PrestamosPage.jsx  ← NUEVO
│   └── PagosPage.jsx      ← NUEVO
├── data/
│   └── mockData.js
├── utils/
│   └── helpers.js
├── App.jsx                ← ACTUALIZADO
├── index.css
└── main.jsx
```

## Integración con API

El proxy de Vite ya está configurado en `vite.config.js`:
```javascript
proxy: {
  '/api': {
    target: 'http://localhost:8000',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ''),
  },
}
```

Para conectar cada página con la API, reemplaza los datos mock:

```jsx
// Ejemplo en ClientesPage.jsx
const [clients, setClients] = useState([])

useEffect(() => {
  fetch('/api/clients/')
    .then(res => res.json())
    .then(data => setClients(data))
}, [])
```

## Personalización

### Cambiar colores
Edita `tailwind.config.js`:
```javascript
theme: {
  extend: {
    colors: {
      "navy": {
        900: "#111827",  // Oscuro
        700: "#0f2438",  // Sidebar
        // ...
      }
    }
  }
}
```

### Agregar más rutas
En `App.jsx`:
```jsx
<Route path="/nueva" element={<Layout><NuevaPage /></Layout>} />
```

En `Layout.jsx`, agrega al array `navItems`:
```javascript
{ path: '/nueva', label: '🆕 Nueva', icon: '🆕' }
```

## Troubleshooting

### Error: "Cannot find module 'react-router-dom'"
```bash
npm install react-router-dom
```

### La navegación no funciona
Verifica que `App.jsx` está correctamente importando `BrowserRouter` y `Routes`.

### Sidebar no aparece
Asegúrate que `Layout.jsx` está importado en `App.jsx` y que cada ruta lo envuelve.

### Estilos Tailwind rotos
```bash
npm run dev
# Si persiste:
rm -rf node_modules package-lock.json
npm install
```

## Próximos Pasos Recomendados

1. **Completar módulo Clientes**
   - Crear formulario de creación
   - Listar clientes desde API
   - Editar/eliminar clientes

2. **Completar módulo Préstamos**
   - Crear formulario de préstamo
   - Integración con evaluador de riesgo (`/riesgo/evaluar`)
   - Listar préstamos desde API

3. **Completar módulo Pagos**
   - Formulario de registro de pago
   - Integración con endpoint `/pagos/registrar`
   - Listar pagos por préstamo

4. **Agregar autenticación**
   - Formulario de login
   - Manejo de tokens JWT
   - Protección de rutas

5. **Mejorar UX**
   - Agregar toasts/notificaciones
   - Modal de confirmación
   - Validación de formularios con Zod

---

✅ Refactorización completada. El frontend está listo para desarrollo modular.
