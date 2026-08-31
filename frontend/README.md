# DLHB Core - Frontend

Frontend en React + TailwindCSS para el sistema de gestión de préstamos DLHB Core.

## Instalación

```bash
npm install
```

## Desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

## Compilación

```bash
npm run build
```

## Características

- **Enrutamiento**: React Router v6 para navegación entre módulos
- **Sidebar Colapsable**: Navegación persistente con animaciones
- **Dashboard** principal con resumen de métricas
- **Tabla interactiva** de préstamos con formato condicional
- **Diseño responsivo** con TailwindCSS
- **Paleta corporativa** azul marino y blanco
- **Datos mock** para desarrollo

## Estructura

```
src/
├── components/     # Componentes React reutilizables
│   ├── Layout.jsx      # Componente principal con Sidebar y Header
│   ├── Card.jsx        # Tarjetas de métricas
│   └── LoansTable.jsx  # Tabla de préstamos
├── pages/          # Páginas principales
│   ├── DashboardPage.jsx   # Dashboard con resumen
│   ├── ClientesPage.jsx    # Gestión de clientes
│   ├── PrestamosPage.jsx   # Gestión de préstamos
│   └── PagosPage.jsx       # Gestión de pagos
├── data/           # Datos mock
│   └── mockData.js
├── utils/          # Funciones auxiliares
│   └── helpers.js
├── App.jsx         # Configuración de rutas
├── index.css       # Estilos Tailwind
└── main.jsx
```

## Rutas Disponibles

| Ruta | Descripción |
|------|-------------|
| `/` | Redirige a `/dashboard` |
| `/dashboard` | Panel principal con resumen y métricas |
| `/clientes` | Gestión de clientes (en desarrollo) |
| `/prestamos` | Gestión de préstamos (en desarrollo) |
| `/pagos` | Gestión de pagos (en desarrollo) |

## Componentes Principales

### Layout

Envuelve todas las páginas con:
- **Sidebar colapsable**: Navegación con iconos y etiquetas
- **Header responsivo**: Muestra título de página actual
- **Indicador de ruta activa**: Resalta el módulo actual
- **Animaciones suaves**: Transiciones de 300ms

**Props:**
- `children`: Contenido de la página

**Features:**
- Sidebar se adapta a dispositivos móviles
- Toggle para colapsar/expandir
- Navegación con `useLocation` de React Router
- Paleta: Azul marino oscuro (#111827) + Blanco/Gris

### DashboardPage

Página principal con:
- 3 tarjetas de resumen (Ganancias, Capital Recuperado, Capital en la Calle)
- Tabla interactiva de préstamos activos
- Formato condicional para préstamos vencidos
- Indicador de carga

### ClientesPage, PrestamosPage, PagosPage

Páginas vacías pero enrutadas correctamente. Listas para agregar contenido.

## Dependencias

- `react@18.3.1` - Librería de UI
- `react-dom@18.3.1` - Renderizado en DOM
- `react-router-dom@6.22.0` - Enrutamiento
- `tailwindcss@3.4.1` - Framework CSS
- `vite@5.1.0` - Build tool

## Enrutamiento Avanzado

El proyecto utiliza **React Router v6** con:
- Enrutamiento anidado a través del Layout
- Redirección automática (raíz → dashboard)
- useLocation para detección de ruta activa
- Manejo de 404 personalizado

**Agregar una nueva ruta:**

1. Crear componente en `src/pages/NuevaPage.jsx`
2. Importar en `App.jsx`
3. Agregar `<Route>` con Layout:

```jsx
<Route
  path="/nueva"
  element={
    <Layout>
      <NuevaPage />
    </Layout>
  }
/>
```

4. Agregar item en `navItems` del Layout

## Próximos pasos

- Integrar con la API FastAPI en `http://localhost:8000`
- Implementar formularios para crear/editar datos
- Agregar validación de formularios
- Implementar paginación y búsqueda en tablas
- Agregar gráficos de análisis
- Módulo de autenticación
- Modal de confirmación para acciones críticas

## Tailwind Config

Paleta personalizada disponible en `tailwind.config.js`:
- Navy: Tonos de azul marino (#0a1929 a #f0f4f8)
- Colores estándar: Gray, Blue, Red, Green, etc.

## Tips de Desarrollo

- Usar `npm run dev` para desarrollo con Hot Module Replacement (HMR)
- Las rutas se definen en `App.jsx`
- Importar componentes desde `react-router-dom` según sea necesario
- El Layout es singleton para toda la app (no se remonta al cambiar de ruta)
- Usar `useNavigate()` para navegación programática

