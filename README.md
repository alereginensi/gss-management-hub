# GSS Ticket Portal - Demo

Este es un prototipo funcional de la aplicación web para el sistema de tickets de **GSS Facility Services**.

## Características Incluidas
*   **Diseño Corporativo:** Colores y estilos alineados con la marca GSS.
*   **Dashboard:** Vista general con KPIs y últimos tickets.
*   **Mis Tickets:** Listado de tickets con filtros visuales.
*   **Nuevo Ticket:** Formulario completo para la creación de solicitudes.
*   **Detalle de Ticket:** Vista de conversación y estado.

## Cómo Ejecutar con Docker (Recomendado)

Este proyecto está preparado para ejecutarse en contenedores Docker, lo cual garantiza consistencia y facilita la integración en el portal GSS.

**Requisitos:** Docker y Docker Compose.

1. Construir e iniciar el contenedor:
   ```bash
   docker compose up -d --build
   ```
2. Acceder al portal en [http://localhost:3000](http://localhost:3000)

La base de datos (`tickets.db`) se persiste automáticamente mediante un volumen de Docker.

## Cómo Ejecutar Localmente (Desarrollo)

1.  Abre una terminal en esta carpeta.
2.  Instala las dependencias:
    ```bash
    npm install
    ```
3.  Ejecuta el servidor de desarrollo:
    *   **Opción A (PowerShell):** Haz clic derecho en el archivo `run_demo.ps1` y selecciona "Ejecutar con PowerShell".
    *   **Opción B (Estándar):**
        ```bash
        npm run dev
        ```
4.  Abre tu navegador en: [http://localhost:3000](http://localhost:3000)

## Estructura del Proyecto
*   `/app`: Rutas y páginas (Next.js App Router).
*   `/app/components`: Componentes reutilizables (Sidebar, Header).
*   `/app/globals.css`: Variables de diseño y estilos globales.
