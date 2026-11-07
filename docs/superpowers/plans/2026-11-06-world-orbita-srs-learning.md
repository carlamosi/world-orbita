# Fase 4: repetición espaciada correcta, sincronizada y bien diseñada para aprender

> **Para agentes:** SUB-SKILL OBLIGATORIA: superpowers:subagent-driven-development. Los pasos usan checkboxes (`- [ ]`).

**Estado:** aprobado por la usuaria (2026-11-06): alcance completo 17-23; Speed no toca FSRS; tras un error se espera a Next; rama `fix/srs-learning` apilada sobre `fix/sync-client` (PR contra `main` cuando se fusione el #5).

**Origen:** auditoría del 6 nov sobre la rama `fix/sync-client` (Fase 3): tres auditorías de solo lectura (algoritmo, sync del estado FSRS y diseño pedagógico), una comprobación con los datos reales de producción por MCP y una ejecución contra ts-fsrs 5.4.1. Informes completos en el scratchpad de la sesión (`srs-audit/`).

## Diagnóstico

### Lo que está bien (verificado)
- El estado FSRS hace la ida y vuelta completa entre Dexie, el payload, Postgres y el pull, sin pérdida: fechas en ms ↔ timestamptz exactas, `learning_steps` persistido (FSRS-1 arreglado), nulls de tarjetas New.
- Los pasos de aprendizaje funcionan: New+Good → 10 min → Good → Review a 2 días; Again → Relearning 10 min.
- Una sola nota FSRS por concepto y sesión; revelar la respuesta cuenta como Again.
- Prioridad correcta en la cola: Relearning, Learning, Review vencidas y después nuevas, con cupo diario.
- Todo el juego es práctica de recuperación (testing effect) y el espaciado usa FSRS-6 con retención objetivo 0,9.
- FSRS-2, FSRS-3 y FSRS-4 arreglados en la Fase 1.

### Lo que falla (por impacto)

| # | Problema | Prueba | Gravedad |
|---|---|---|---|
| 1 | **Responder rápido da Easy** (`assessment.ts:137-139`). Una tarjeta nueva acertada en menos de 1,5-2,5 s salta los pasos de aprendizaje: Review a 8 días y difficulty mínima (1,0). Cada Easy el mismo día multiplica la estabilidad ×1,5. | **Producción:** 6 de tus 10 aciertos fueron Easy en su primera respuesta. **ts-fsrs:** New+Easy → Review S 8,3 D 1,0 a 8 días; 3 Easy el mismo día → S 8,3 → 29,6 (30 días). | Alta |
| 2 | **Se confunde reconocer con recordar.** Name/Locate y España comparten tarjeta entre opción múltiple y escritura. Review pregunta en opción múltiple las capitales aprendidas escribiendo, y la tarjeta del mapa la pregunta con una bandera. | `LocatePage.tsx:91,131`, `SpainPage.tsx:252`, `ReviewPage.tsx:361-371, 453-474, 710` | Alta |
| 3 | **Speed escribe en FSRS mal:** Easy por velocidad, tarjeta equivocada (bandera → tarjeta del mapa), ids que no existen (la nota se pierde), repeticiones y doble clic que califica la pregunta siguiente; sin corrección tras fallar. | `speedRuntimeStore.ts:226-279, 372-392` | Alta |
| 4 | **Una fila con difficulty null congela la sesión** (ts-fsrs lanza y `submit` no lo captura). | ts-fsrs: `FSRSValidationError Invalid memory state`; `adapter.ts:121-132`, `useSession.ts:688` | Media |
| 5 | **El corrector acepta otro país real:** Iraq por Iran, Gambia por Zambia; escribir "Nigeria" se envía como correcto al llegar a "Niger"; no acepta nombres alternativos. | `fuzzy.ts:40`, `HardInput.tsx:85,91` | Media |
| 6 | **Reloj del dispositivo sin límite en el servidor:** un dispositivo con la hora adelantada bloquea la tarjeta para los demás. | `baseline_v2.sql:143, 448-468` | Media (raro) |
| 7 | **Feedback pobre tras un error:** temporizador fijo de 2,8 s sin botón, sin contraste ("elegiste X, es Y"), sin contexto (región, vecinos), sin `aria-live` (WCAG 2.2.1 y 4.1.3). Los fallos en las 3 últimas preguntas no se repiten. | `useAutoAdvance.ts:27`, `FeedbackBar.tsx`, `useSession.ts:757` | Media |
| 8 | **Carga y progreso poco honestos:** 10 nuevas por bucket (~130/día) y el modo Complete se salta el cupo; nuevas en orden alfabético; "dominado" = retrievability ≥ 0,8 (casi automático); el resumen llama "mastered" a las acertadas a la primera; tarjetas que fallan una y otra vez (leeches) sin tratamiento; distractores aleatorios en vez de vecinos. | `newCardLimit.ts`, `useSession.ts:440-490`, `ProgressPage.tsx:31-68`, `unlocks.ts:78-86`, `SessionEnd.tsx` | Media |
| 9 | Ruido: `next()` sin guarda (salta preguntas, `recordSessionEnd` doble); `migration.ts` muerto y peligroso; comentarios que dicen "sin Easy" y "5 años"; historial con grade 0-3 en vez de Rating 1-4; el test de contrato no comprueba stability/difficulty/reps/lapses; `elapsed_days` negativo con reloj atrasado. | varios | Baja |

Límite de diseño que se acepta: con dos dispositivos que repasan la misma tarjeta desde el mismo estado, gana la review más reciente y el efecto de la otra se pierde (queda en el historial). Arreglarlo exige reconstruir el estado desde el historial; no compensa.

## Tareas propuestas

Rama `fix/srs-learning`. Orden por impacto. Restricciones globales de la Fase 3 (texto de interfaz en inglés y sin "—", typecheck limpio, sin red a Supabase en tests).

### Task 17: notas FSRS honestas (#1, #4, parte de #9)
- `assess`: un acierto es Good y nunca Easy por velocidad; un acierto muy lento sigue siendo Hard; un acierto aceptado por errata (fuzzy, no exacto) es Hard (`softCorrect` llega por fin a `assess`).
- `rowToCard` sanea difficulty/stability inválidas en estados no New; `submit` captura el error, lo registra y deja avanzar.
- "Practice anyway" no incluye tarjetas en Learning/Relearning que aún no vencen.
- `next()` con guarda; comentarios del adaptador corregidos (incluido que `grade` del historial es Rating − 1, 0-3; no se cambia su significado para no mezclar filas).
- Tests: acierto rápido → Good; errata → Hard; fila con difficulty null no congela; doble `next()` no salta preguntas.

### Task 18: Speed deja de escribir en FSRS (#3)
- Se quita el bloque de escritura FSRS de `speedRuntimeStore.ts`; Speed queda como juego de fluidez con su propia puntuación.
- Tras un fallo se muestra la opción correcta ~800 ms.

### Task 19: cada tarjeta se practica y se repasa en su formato (#2)
- Name/Locate y España: tarjetas distintas para opción múltiple y escritura (como ya hace Flags), y la escritura pasa `retrievalMode: "hard"`.
- Review elige la entrada por el tipo de tarjeta: escritura para las tarjetas escritas, el globo con el país resaltado para la tarjeta del mapa.
- Las filas mezcladas existentes se quedan como están.

### Task 20: corrector de respuestas escritas (#5)
- Se rechaza una respuesta que coincide exactamente con otro país o capital.
- No hay auto-envío mientras lo escrito es prefijo del nombre de otra entidad.
- Se aceptan nombres alternativos de los datos.

### Task 21: feedback que enseña (#7)
- Tras un error: "You chose X · Answer: Y" más una línea de contexto (subregión, vecinos) con bandera y ubicación, y se espera a Next (Enter/Espacio). Los aciertos siguen avanzando solos.
- `role="status" aria-live="polite"` en la barra de feedback.
- Un fallo cerca del final se repite al final de la sesión.

### Task 22: carga y progreso honestos (#8)
- Cupo global de nuevas por día (20) además del de cada bucket; Complete lo respeta.
- Las nuevas se introducen de fáciles a difíciles (`difficulty` de los datos).
- "Dominado" = Review con estabilidad ≥ 21 días, en Progress, desbloqueos y resumen de sesión; el resumen dice "correct first try".
- Tarjetas con lapses ≥ 4 se listan como "tricky" al final de la sesión.
- Distractores de opción múltiple primero de vecinos y misma subregión.

### Task 23: sync del estado FSRS más robusto (#6, parte de #9)
- Migración nueva: `sync_push` acota `fsrs_last_review` a `now() + 5 min`. **La aplica la usuaria en producción** con un runbook corto.
- Cliente: `elapsed_days` nunca negativo; `recordConceptAttempt` pone `client_id`.
- Test de contrato: comprueba los diez campos FSRS tras el pull, el caso de dos dispositivos y el de reloj adelantado.
- Se borra `migration.ts` (código muerto que machacaría el progreso si se activara).

### Fuera de alcance (anotado)
Valoración de confianza por la usuaria; reconstruir el estado desde el historial; cambiar la regla de rachas y el texto de salida ("don't you want to see a smile…"), que es decisión de producto; tarjeta country→flag propia; alternativa de teclado para el globo.

## Cierre
- [ ] `npm run typecheck`, `npx vitest run --exclude "src/__audit__/**"`, `npm run build`.
- [ ] Revisión por tarea y revisión final de la rama.
- [ ] Prueba en la preview con una cuenta de prueba; comprobación por MCP de que las tarjetas nuevas acertadas quedan en Learning y no en Review.
