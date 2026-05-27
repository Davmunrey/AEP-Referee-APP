# Requirements — v1.1 AEP Referee APP Full Feature Upgrade

## Cross-Zone Judge Selection

- [ ] **ZONE-01**: Delegado puede marcar un slot como "solicitar juez de fuera de zona"
- [ ] **ZONE-02**: Roster builder muestra badge visual en jueces asignados de otra zona
- [ ] **ZONE-03**: Filtro de jueces incluye opción "Todas las zonas" independientemente del rol
- [ ] **ZONE-04**: Super_admin/delegado_jueces puede asignar juez de cualquier zona a cualquier campeonato
- [ ] **ZONE-05**: Delegado_zona puede solicitar cross-zona (queda pendiente aprobación)
- [ ] **ZONE-06**: API valida y registra `cross_zone` flag en roster_assignments

## Schedule Builder

- [ ] **SCHED-01**: Usuario puede crear sesiones manualmente (nombre, día, hora pesaje, hora inicio)
- [ ] **SCHED-02**: Plantilla de tarima editable directamente sin importar PDF
- [ ] **SCHED-03**: Cambios en plantilla persisten en DB como template por campeonato
- [ ] **SCHED-04**: Parser PDF mejorado reconoce más variantes de formato AEP

## Import Improvements

- [ ] **IMP-01**: Import Excel reconoce campos: localidad, telefono, genero, antiguedad, notas
- [ ] **IMP-02**: Import muestra preview con todos los campos antes de confirmar
- [ ] **IMP-03**: Parser horario PDF reconoce eventos multi-día correctamente
- [ ] **IMP-04**: Warnings claros cuando campos no se pueden parsear

## Judge Availability

- [ ] **AVAIL-01**: Juez tiene campo de disponibilidad por rango de fechas
- [ ] **AVAIL-02**: Roster builder muestra jueces no disponibles en fecha del campeonato
- [ ] **AVAIL-03**: Filtro por disponibilidad en selector de jueces

## Analytics & Dashboard

- [ ] **ANAL-01**: Estadísticas muestran actividad cross-zona (jueces fuera de zona)
- [ ] **ANAL-02**: Dashboard muestra cobertura por zona en próximas competiciones
- [ ] **ANAL-03**: Export CSV desde analytics

## UX Refinements

- [ ] **UX-01**: Badge de nivel en selector de jueces más visible
- [ ] **UX-02**: Warning cuando juez lleva muchos campeonatos consecutivos
- [ ] **UX-03**: Búsqueda de jueces por iniciales además de nombre
