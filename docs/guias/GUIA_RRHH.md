# Guía de Recursos Humanos (RRHH)

El módulo de Recursos Humanos tiene dos funcionalidades principales: la **Agenda Web** para la entrega y seguimiento de uniformes y el módulo de **Jornales** para el control de días trabajados del personal.

---

## 1. Cómo acceder al módulo

En el menú lateral, hacé clic en **"RRHH"** o **"Recursos Humanos"**.

---

## 2. Qué hace este módulo

El módulo de RRHH es el punto de entrada del área para gestionar los uniformes del personal. Desde acá podés acceder a la **Agenda Web de Uniformes**, que es el sistema donde se registran las entregas de ropa de trabajo a cada empleado.

---

## 3. Cómo usar la Agenda Web desde RRHH

Al entrar al módulo, vas a ver la opción **"Agenda Web"**. Hacé clic para acceder.

La Agenda Web funciona igual que la Logística en cuanto a uniformes — es la misma herramienta. Desde acá podés:

### Buscar a un empleado

1. Ingresá el número de documento (cédula) del empleado en el campo de búsqueda.
2. Hacé clic en **"Buscar"**.
3. Si el empleado está en el sistema, vas a ver su ficha con el historial de uniformes recibidos.

### Ver el historial de entregas de un empleado

En la ficha del empleado vas a ver una tabla con todo lo que recibió:
- Qué prendas le entregaron.
- En qué fecha.
- En qué talla.

Esto te permite saber si un empleado ya recibió cierta prenda y cuándo fue.

### Registrar una entrega de uniforme

1. Con la ficha del empleado abierta, hacé clic en **"Nueva entrega"** o **"Registrar entrega"**.
2. Seleccioná las prendas y las tallas correspondientes.
3. Confirmá la fecha de entrega.
4. Guardá el registro.

---

## 4. Solicitudes de uniformes

Si el personal necesita uniformes y la solicitud viene por otra vía (por ejemplo, desde Operaciones Limpieza o Seguridad Electrónica), RRHH puede coordinar con el área de Logística para procesarlas. Las solicitudes se gestionan directamente en el módulo de Logística.

---

## 5. Preguntas frecuentes

**¿Qué diferencia hay entre gestionar uniformes desde RRHH y desde Logística?**
Es el mismo sistema (Agenda Web). El acceso desde RRHH es para el equipo de recursos humanos, mientras que el de Logística es para el equipo de logística. Ambos pueden ver y registrar las mismas entregas.

**¿Quién puede acceder a este módulo?**
Solo los usuarios con tipo **RRHH** o **Administrador** tienen acceso al módulo de Recursos Humanos.

---

## 6. Jornales

El submódulo de **Jornales** permite controlar cuántos días trabajó cada funcionario a partir de los archivos de marcas que exporta el sistema de asistencia. El objetivo es identificar a los funcionarios que ya alcanzaron la cantidad de días necesarios para pasar a efectividad.

### 6.1. Cómo acceder

Desde el hub `/rrhh` hacé clic en la tarjeta **"Jornales"**. Vas a ver cinco pestañas: **Resultados**, **Personal**, **Agregar marcas**, **Altas** y **Bajas**.

Toda la información (personal, marcas, altas y bajas) queda guardada en la base de datos — al recargar la página no se pierde nada y cualquier otro usuario de RRHH/Admin ve lo mismo.

### 6.2. Personal

Listado de los funcionarios que controla el módulo. Cada fila muestra padrón, nombre, cédula, jornales acumulados y si tiene **efectividad autorizada**.

- **Cargar listado desde Excel**: subí un archivo con las columnas `Padron` y `Nombre` (opcionales: `Apellido`, `Cedula`). **Atención**: esta operación reemplaza el personal existente en el módulo.
- **Efectividad autorizada (checkbox)**: marcar a una persona como "efectividad autorizada" fija su estado en *Efectividad autorizada*. Los Excel nuevos ya no le suman jornales, pero la cantidad que acumuló hasta ese momento se mantiene visible.
- **Dar de baja**: botón rojo por fila; pide confirmación.

### 6.3. Agregar marcas

Subí archivos Excel con columnas `Número de empleado`, `Fecha` y `Lugar`. El sistema:

- **Ignora duplicados** — una persona, una fecha y un lugar sólo suman una vez aunque estén en archivos distintos.
- **Ignora archivos repetidos** — si ya subiste un archivo con el mismo nombre y tamaño, lo salta.
- Deja registrado cada archivo cargado como un "chip" abajo. Si clickeás la **×** del chip se borran sólo las marcas de ese archivo.
- Si necesitás empezar de cero, usá **"Limpiar todas las marcas"**.

### 6.4. Altas

Dos formas de agregar personal sin reemplazar el listado:

- **Pegar texto**: formato `padrón<TAB>nombre<TAB>apellido<TAB>cédula`, una persona por línea.
- **Subir Excel**: mismo formato que el listado general (`Padron`, `Nombre`, opcionales).

Primero muestra una **vista previa** indicando cuáles ya existen en el sistema, y recién confirmás con **"Confirmar altas"** para persistirlas.

### 6.5. Bajas

Tres modos para dar de baja funcionarios:

- **Buscar por nombre**: escribí parte del nombre o padrón y seleccioná con los checkboxes.
- **Pegar padrones**: un padrón por línea, o separados por comas o espacios.
- **Subir Excel**: archivo con columna `Padrón` o `Número de empleado`.

Antes de confirmar muestra una vista previa con las personas que va a dar de baja (los padrones no encontrados quedan marcados como tal y no se procesan).

### 6.6. Resultados

Tabla final ordenada con los funcionarios clasificados según sus jornales acumulados:

- **Sin marcas** (0 jornales).
- **En curso** (entre 1 y 99 jornales).
- **Efectivo** (≥ 100 jornales).
- **Ef. autorizada** — estado fijo marcado manualmente desde la pestaña Personal.

Permite filtrar por texto y por estado, y exportar todo a Excel.
