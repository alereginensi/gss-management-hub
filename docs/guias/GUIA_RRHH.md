# Guía de Recursos Humanos (RRHH)

El módulo de Recursos Humanos tiene cuatro funcionalidades principales: la **Agenda Web** para la entrega y seguimiento de uniformes, **Jornales** para el control de días trabajados del personal, **Citaciones Laborales** para la gestión de audiencias ante el MTSS y el Juzgado, y **Registro de Licencias** para certificaciones médicas, PAP, lactancia y otras licencias del personal.

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

---

## 7. Citaciones Laborales

Desde el hub `/rrhh` hacé clic en la tarjeta **"Citaciones Laborales"**. Es el expediente digital de cada audiencia laboral (MTSS o Juzgado), con el detalle del reclamo, el acuerdo transaccional si lo hubo y las facturas del abogado asociadas al caso.

### 7.1. Panel principal

Arriba tenés tarjetas de resumen con: total de expedientes, pendientes, en curso, cerrados, total reclamado, total pagado en acuerdos y total de honorarios facturados.

Debajo, cuatro pestañas para filtrar rápido: **Todas**, **Pendientes**, **En curso** y **Cerradas**. Además una barra con búsqueda por empresa o trabajador y un filtro para ver solo MTSS o solo Juzgado.

### 7.2. Crear una citación nueva

1. Hacé clic en **"+ Nueva citación"** (esquina superior derecha).
2. Se abre un panel lateral con el formulario. Empresa y fecha de audiencia son obligatorios.
3. **(Opcional, recomendado)** En el primer bloque podés **subir el PDF de la citación**: hacé clic en **"Elegir PDF"** y seleccioná el archivo. El sistema va a leerlo y autocompletar todos los campos que detecte (empresa, trabajador, fecha, hora, sede, abogado, rubros, monto reclamado, organismo MTSS/Juzgado). Los campos autocompletados aparecen listados en un cartelito verde. Si algún dato no sale bien, lo corregís a mano — el PDF queda adjunto al expediente de todas formas.
4. Completá datos de la citación: organismo (MTSS o Juzgado), hora, dirección/sede, trabajador, abogado de parte, rubros reclamados, total reclamado, estado y motivo.
4. Si corresponde, llená la sección **"Acuerdo transaccional"** con el detalle y el monto pagado.
5. Agregá las **facturas del abogado** una por una con el botón **"+ Agregar factura"**: número, concepto (asistencia MTSS, contestación demanda, acuerdo, asistencia juzgado, otros) y monto.
6. Opcionalmente, observaciones libres.
7. Hacé clic en **"Guardar cambios"**.

### 7.3. Editar un expediente

En la tabla, hacé clic en la fila para abrir el panel lateral con todos los datos ya cargados. Cambiá lo que necesites y guardá. Si el expediente tenía un PDF adjunto lo vas a ver arriba, con botones **Ver** (abre el PDF en otra pestaña), **Reemplazar** y **Quitar**.

### 7.4. Cerrar un expediente

Desde la acción de la fila hacé clic en **"Cerrar expediente"**. El estado pasa a **Cerrado** y el caso se mueve a la pestaña correspondiente. Se mantiene en la tabla para consulta futura.

### 7.5. Exportar a Excel

El botón **"↓ Excel"** descarga un archivo `.xlsx` con todas las citaciones visibles según los filtros actuales (empresa, trabajador, organismo, fecha, estado, montos, acuerdos, facturas).

### 7.6. Quién puede usarlo

Mismo criterio que Jornales: solo **Administrador** o **RRHH**.

---

## 8. Registro de Licencias

Planilla del área para llevar el registro de licencias del personal: certificaciones médicas, PAP, lactancia, licencia por estudio, donación de sangre y otras. Replica el Excel que se llevaba a mano, con la ventaja de que **se edita directo en la tabla como en Excel** y los cambios se guardan solos.

### 8.1. Cómo acceder

Desde el hub `/rrhh` hacé clic en la tarjeta **"Registro de Licencias"**.

### 8.2. La tabla

Cada fila es una licencia con estas columnas:

- **Remitente**: quien reporta la licencia (persona de RRHH).
- **Padrón**: número del funcionario.
- **Funcionario**: nombre.
- **Servicio**: cliente donde trabaja.
- **Sector**: Staff / Tercerizado / Limpieza / Seguridad.
- **Tipo**: Certificación médica / Donación de sangre / PAP / Licencia por estudio / Lactancia / Otro.
- **Desde** y **Hasta**: rango de fechas.
- **Suplente**: si lo hubo.
- **Notif** / **Sup** / **Cert** / **Plan**: los 4 checks de seguimiento.
- **Observaciones**: notas libres.

Las filas con los **4 checks en verde** se pintan de fondo verde (licencia completamente tramitada). Las que tienen algún check en gris van con fondo amarillo (pendiente).

### 8.3. Edición inline (estilo Excel)

Todo se edita directo en la tabla:
- **Texto, padrón, observaciones**: click en la celda, escribís, y cuando salís (click afuera) se guarda.
- **Sector, tipo**: menú desplegable, click → elegís → guarda.
- **Fechas**: selector de fecha.
- **Checks (Notif, Sup, Cert, Plan)**: click en el círculo — si está verde pasa a gris, si está gris pasa a verde. Guarda al instante.

No hace falta apretar "Guardar" en ningún lado. Una barra azul animada a la izquierda de la fila indica que está guardando, y desaparece apenas termina.

### 8.4. Agregar una licencia nueva

Botón **"+ Nueva"** arriba a la derecha. Se abre un formulario chico con los 3 campos obligatorios: remitente, funcionario y tipo. El resto (suplente, observaciones, checks, servicio) se completa después directo en la tabla.

### 8.5. Filtros y búsqueda

Arriba de la tabla hay:
- Búsqueda por nombre o padrón.
- Filtro por sector.
- Filtro por tipo de licencia.
- Filtro por estado: Todas / Solo pendientes / Solo completas.

Las 4 tarjetas de arriba (Total / Completas / Pendientes / tipo más frecuente) se actualizan según los filtros actuales.

### 8.6. Exportar a Excel

Botón **"↓ Excel"** descarga un `.xlsx` con las columnas exactas del Excel original, manteniendo el formato `TRUE`/`FALSE` para los 4 checks. Incluye solo las filas visibles según los filtros activos.

### 8.7. Importar histórico (solo admin)

Si tenías un Excel previo con licencias ya registradas, podés subirlo de una:

1. Botón **"↑ Importar"** (solo visible para admin).
2. Arrastrá el Excel o elegilo del explorador.
3. **Año**: el Excel original tiene fechas como "17-Jul" sin año. Elegí el año al que corresponden (default: año actual).
4. **Estrategia**:
   - **Agregar al final** (recomendado): mantiene lo que ya hay y suma las filas nuevas.
   - **Reemplazar TODO**: borra toda la tabla y la reemplaza con el Excel. Usar con cuidado.
5. Click **Importar**. Al final muestra cuántas filas se insertaron, cuántas se descartaron (por faltar datos obligatorios) y un detalle de errores si los hay.

### 8.8. Eliminar una licencia

Columna última de la fila: icono de papelera. Click → confirmación → se elimina.

### 8.9. Quién puede usarlo

- **Ver, editar, crear, eliminar**: Administrador o RRHH.
- **Importar Excel histórico**: solo Administrador.
