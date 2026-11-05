# Auditoría World Orbita · 2026-11-05

Workflow: 5 auditores (FSRS, Supabase SQL, sync, DB local/auth, bugs) + 4 verificadores adversariales. 58 hallazgos brutos, 49 tras deduplicar.
Línea base: typecheck OK · 94/94 tests · build OK · lint 24.710 problemas (24.658 autofixables).

## Verificados

| ID | Sev. | Veredicto | Hallazgo | Ubicación |
|---|---|---|---|---|
| FSRS-1 | critica | **CONFIRMED** | Card.learning_steps no se persiste: las tarjetas en Learning nunca se gradúan con Good (se quedan en un bucle de 10 min) | `src/lib/fsrs/adapter.ts:115` |
| FSRS-2 | critica | **CONFIRMED** | Práctica rápida (modo planner) deja de introducir tarjetas nuevas al llegar a N filas y se queda en blanco sin salida | `src/features/engine/useSession.ts:274` |
| FSRS-3 | critica | **CONFIRMED** | queue y conceptQueue se desalinean: la calificación se escribe en otro concepto (Spain provincias/CCAA) | `src/features/engine/useSession.ts:322` |
| SQL-1 | critica | **CONFIRMED** | sync_push castea last_seen_at a numeric pero el cliente envía ISO string: todo push de country_progress falla y acaba en 'dead' | `supabase/migrations/20260906162149_update_sync_push_question_history.sql:93` |

## Sin test (por límite de verificadores, o media/baja)

| ID | Sev. | Estado | Hallazgo | Ubicación | Duplicados |
|---|---|---|---|---|---|
| SYNC-01 | critica | **CONFIRMED (controller)** | recoverInFlight y purgeBrokenOpIds se ejecutan sobre la BD invitada (orbita-local), nunca sobre la del usuario: los in_flight tras cerrar la pestaña se quedan atascados para siempre | `src/lib/sync/workers.ts:359` |  |
| SYNC-03 | critica | pendiente | El pull de country_progress pisa sin condiciones las filas locales (dirty y con skill_versions mayores): 'Force full resync' devuelve el progreso local al estado antiguo del servidor | `src/lib/sync/workers.ts:258` |  |
| SYNC-04 | critica | pendiente | Los fallos de red transitorios mandan TODO el lote a dead-letter tras unos 5 minutos, sin reintento automático y sin aviso en la UI; 'Clear dead letter' lo borra definitivamente | `src/lib/sync/workers.ts:203` |  |
| SYNC-05 | critica | pendiente | Cambiar de usuario o cerrar sesión a mitad de un push o pull escribe los datos de A en la BD activa (invitado o B) y borra ids del outbox de otra BD: fuga de progreso entre cuentas | `src/lib/sync/workers.ts:249` | DB-01 |
| BUG-02 | critica | pendiente | queue y conceptQueue se desalinean cuando un concepto planificado no existe en el dataset: la nota FSRS se escribe en otro concepto (CCAA en vez de provincia) | `src/features/engine/useSession.ts:327` |  |
| BUG-03 | critica | **CONFIRMED (controller)** | ChallengeRunner llama hooks despues de un return condicional: al terminar el Daily/Weekly la pantalla rompe y la sesion no se registra | `src/features/challenges/ChallengesPage.tsx:415` |  |
| FSRS-4 | alta | pendiente | Review de capToCountry: el enunciado muestra la capital y las opciones también son capitales, así que la respuesta es trivial | `src/features/review/ReviewPage.tsx:194` |  |
| FSRS-5 | alta | pendiente | ConceptIds antiguos de 2 partes en el servidor nunca se migran en el pull ni en una BD nueva de usuario: el progreso se duplica o queda invisible | `src/lib/db/orbita-db.ts:295` | DB-08 |
| SQL-2 | alta | pendiente | El cast op_id::uuid está fuera del bloque EXCEPTION: un solo op_id inválido aborta todo el lote | `supabase/migrations/20260906162149_update_sync_push_question_history.sql:48` | SYNC-09 |
| SQL-3 | alta | pendiente | sync_pull pagina con cursor `updated_at > cursor` y LIMIT: pierde para siempre las filas empatadas en el límite de página | `supabase/migrations/20260809234100_add_srs_sync.sql:350` | SYNC-07 |
| SQL-6 | alta | pendiente | La resolución de conflictos compara contadores 'version' locales entre dispositivos e invitado: descarta repasos más recientes y acepta otros más antiguos | `supabase/migrations/20260906162149_update_sync_push_question_history.sql:147` |  |
| SYNC-06 | alta | pendiente | Una respuesta local aún no subida se descarta: el pull y el canonical sobrescriben concept_progress dirty, y el 'version' es un contador que empata entre dispositivos | `src/lib/sync/workers.ts:289` |  |
| SYNC-08 | alta | pendiente | La fusión de invitado en una BD de usuario no vacía nunca encola nada: el progreso del invitado se queda solo en local, y luego un pull puede pisarlo | `src/lib/auth/migrateGuestProgress.ts:46` | DB-04 |
| DB-02 | alta | pendiente | Un push en curso durante el swap marca o borra filas del outbox de OTRA BD por id autoincremental, y las del usuario original se quedan en in_flight | `src/lib/sync/workers.ts:112` | SYNC-10 |
| DB-03 | alta | pendiente | migrateGuestProgress borra la BD de invitado aunque las copias hayan fallado en silencio (pérdida definitiva del progreso de invitado) | `src/lib/auth/migrateGuestProgress.ts:127` |  |
| BUG-04 | alta | pendiente | start() concurrente sin token de generacion: una sesion antigua pisa a la nueva y las notas se escriben en el subMode equivocado | `src/features/engine/useSession.ts:332` |  |
| FSRS-6 | media | pendiente | assess() da Rating.Easy por velocidad en opción múltiple, en contra de la política conservadora documentada | `src/lib/fsrs/assessment.ts:137` |  |
| FSRS-7 | media | pendiente | Speed Round califica la tarjeta equivocada (name) o ninguna (flag) | `src/features/speed/speedRuntimeStore.ts:236` | BUG-05 |
| FSRS-8 | media | pendiente | Speed: reposición sin exclusión repite conceptos y no hay bloqueo de entrada (doble clic se califica en la siguiente pregunta) | `src/features/speed/speedRuntimeStore.ts:372` |  |
| FSRS-9 | media | pendiente | rowToCard no valida difficulty/stability en estados no New: ts-fsrs lanza una excepción y submit deja la sesión colgada | `src/lib/fsrs/adapter.ts:122` |  |
| FSRS-11 | media | pendiente | Migraciones legado→FSRS nunca se ejecutan, y seedFsrsFromSm2 machacaría el progreso FSRS si se activara | `src/lib/fsrs/migration.ts:85` |  |
| SQL-4 | media | pendiente | Cursor por now() y orden de commit: transacciones concurrentes pueden quedar por detrás de un cursor ya avanzado | `supabase/migrations/20260906162149_update_sync_push_question_history.sql:158` |  |
| SQL-5 | media | pendiente | Read-modify-write sin bloqueo en concept_progress y country_progress: se pierden actualizaciones concurrentes aunque ambas se den por 'accepted' | `supabase/migrations/20260906162149_update_sync_push_question_history.sql:126` |  |
| SQL-7 | media | pendiente | sync_pull no devuelve question_history: el historial nunca se restaura en otro dispositivo | `supabase/migrations/20260809234100_add_srs_sync.sql:308` |  |
| SQL-8 | media | pendiente | concept_progress no guarda fsrs_elapsed_days ni fsrs_scheduled_days: el pull los pierde | `supabase/migrations/20260809234100_add_srs_sync.sql:7` |  |
| SQL-9 | media | pendiente | daily_summary se fusiona sumando: no es idempotente ante reintentos ni ante envíos de totales | `supabase/migrations/20260906162149_update_sync_push_question_history.sql:206` |  |
| SQL-10 | media | pendiente | Entidades desconocidas o sin rama se aceptan sin escribir nada (profiles perdió su rama) | `supabase/migrations/20260906162149_update_sync_push_question_history.sql:244` |  |
| SQL-11 | media | pendiente | delete_account no es atómico con el borrado de auth.users y no revoca EXECUTE de PUBLIC | `supabase/migrations/20260809234100_add_srs_sync.sql:62` |  |
| SYNC-11 | media | pendiente | El pull avanza el cursor aunque fallen las escrituras en Dexie (errores silenciados con .catch(() => {})): esas filas no se vuelven a pedir | `src/lib/sync/workers.ts:331` |  |
| DB-05 | media | pendiente | swap(uid) se lanza varias veces en paralelo: fusiones duplicadas, outbox duplicado e instancias Dexie abiertas que nunca se cierran | `src/routes/__root.tsx:187` |  |
| DB-06 | media | pendiente | Nadie se suscribe a onSwap: las vistas con useLiveQuery([]) siguen mostrando la BD anterior (datos del usuario anterior tras un logout en otra pestaña, o progreso vacío al recargar con sesión) | `src/features/progress/ProgressPage.tsx:19` |  |
| DB-07 | media | pendiente | createOrbitaDb sobrescribe meta.prefs con {} cada vez que se abre una BD (en cada carga y en cada swap) | `src/lib/db/orbita-db.ts:352` |  |
| BUG-06 | media | pendiente | Due Today ignora la duracion de sesion guardada y no reinicia la sesion al cambiarla | `src/features/review/ReviewPage.tsx:329` |  |
| BUG-07 | media | pendiente | localStorage sin try/catch en inicializadores de estado: la pagina de juego entera rompe con el almacenamiento bloqueado | `src/features/engine/ContinentSelect.tsx:12` |  |
| FSRS-10 | baja | pendiente | next() sin guarda: doble Next o Next + autoavance salta preguntas y duplica recordSessionEnd | `src/features/engine/useSession.ts:586` |  |
| FSRS-12 | baja | pendiente | Locate 'name' fácil (opción múltiple) y difícil (escritura) comparten tarjeta, y la escritura se evalúa con umbrales de 'easy' | `src/features/locate/LocatePage.tsx:131` |  |
| FSRS-13 | baja | pendiente | Ruido: grade en historial 0-3 frente a Rating 1-4, y comentario de maximum_interval incorrecto | `src/features/engine/useSession.ts:505` |  |
| SQL-12 | baja | pendiente | challenge_attempts: la restricción única natural no la cubre ON CONFLICT (op_id) y genera un bucle de reintentos hasta 'dead' | `supabase/migrations/20260906162149_update_sync_push_question_history.sql:80` |  |
| SQL-13 | baja | pendiente | hardcore_exam_progress: PK de texto global predecible y user_id anulable; un tercero puede ocupar el id de otro usuario | `supabase/migrations/20260810110000_add_hardcore_exam_progress.sql:3` |  |
| SQL-14 | baja | pendiente | coalesce(...,0) en fsrs_due y fsrs_last_review convierte payloads inválidos en fechas de 1970 en vez de rechazarlos | `supabase/migrations/20260906162149_update_sync_push_question_history.sql:152` |  |
| SYNC-12 | baja | pendiente | swap(uid) se lanza dos veces en paralelo en SIGNED_IN y al restaurar sesión: doble merge y doble encolado, y una conexión Dexie que nunca se cierra | `src/routes/__root.tsx:198` |  |
| DB-09 | baja | pendiente | La upgrade v1→v2 cambia la clave primaria de countryProgress, y Dexie 4.4.3 lanza UpgradeError: una BD que siga en v1 no puede abrirse | `src/lib/db/orbita-db.ts:196` |  |
| DB-10 | baja | pendiente | Al borrar la cuenta, la BD local orbita-<uid> (progreso, historial y outbox) se queda en el dispositivo | `src/routes/_authenticated/account.tsx:58` |  |
| BUG-08 | baja | pendiente | Review (SSR activo) lee localStorage en el render inicial: desajuste de hidratacion del continente | `src/routes/review.tsx:4` |  |
| BUG-09 | baja | pendiente | HardcoreRunner: el boton Skip en estado 'wrong' no hace nada y las respuestas reveladas no se guardan en answers | `src/features/challenges/HardcoreRunner.tsx:257` |  |

## Detalle

### FSRS-1 · Card.learning_steps no se persiste: las tarjetas en Learning nunca se gradúan con Good (se quedan en un bucle de 10 min)

- **Severidad:** critica
- **Ubicación:** `src/lib/fsrs/adapter.ts:115`
- **Evidencia:** En ts-fsrs 5.4.1, Card incluye `learning_steps: number` (node_modules/ts-fsrs/dist/index.d.ts:52), que BasicLearningStepsStrategy usa para saber en qué paso de aprendizaje va la tarjeta. rowToCard (adapter.ts:114-138) parte de createEmptyCard() (learning_steps=0) y nunca lo restaura. cardToRowUpdates (adapter.ts:174-195) no lo guarda, y ConceptProgressRow, el payload de progressRepo.ts:59-74 y la tabla SQL tampoco tienen esa columna. Lo comprobé con node contra node_modules/ts-fsrs simulando el ida y vuelta de la app (scratchpad/t/r.mjs). En memoria: Again→Learning(step0,+1m)→Good→Learning(step1,+10m)→Good→Review(+1 día). Con persistencia: Again→Learning +1m→Good→Learning(step1)+10m→Good→Learning(step1)+10m→Good→Learning +10m, sin fin. Lo mismo pasa con New→Hard→Good→Good. Solo una respuesta 'easy' (respuesta muy rápida) gradúa la tarjeta.
- **Reproducción:** 1) Usuario nuevo, Capitales countryToCap: responde bien a Francia a velocidad normal (assess→'good'). La fila queda en fsrs_state=1 (Learning) con due a +10 min. 2) Pasados 10 min, abre Review y vuelve a responder bien a velocidad normal: rowToCard pone learning_steps=0, ts-fsrs la trata como paso 0 y la deja en Learning a +10 min. 3) Se repite en cada repaso. La tarjeta nunca llega a Review, getRetrievability la limita a 0,45 (adapter.ts:299-303) y el contador Due Today se llena de tarjetas Learning cada 10 min. Test de vitest: crear una fila, aplicar processReview(Good) → cardToRowUpdates → rowToCard → processReview(Good) y comprobar que state === State.Review (hoy falla).
- **Propuesta:** Añadir fsrs_learning_steps a ConceptProgressRow, a cardToRowUpdates/rowToCard, al payload del outbox, a la normalización del pull y a la columna SQL de concept_progress (migración nueva + sync_push/sync_pull). Para filas antiguas en Learning/Relearning sin el campo, deducirlo de scheduled_days/due-last_review (≥10 min ⇒ paso 1) o usar 1 por defecto. Añadir un test de regresión del ida y vuelta.
- **Verificación (CONFIRMED, test vitest (C:\Users\carla\Desktop\Projects\world-orbita\src\__audit__\FSRS-1.test.ts), ejecutado con npx vitest run src/__audit__/FSRS-1.test.ts):** Confirmado. La causa es la que describe el hallazgo.

1. rowToCard (src/lib/fsrs/adapter.ts:114-138) parte de createEmptyCard(), que deja learning_steps=0, y nunca restaura ese campo desde la fila.
2. cardToRowUpdates (adapter.ts:174-195) no guarda learning_steps.
3. En el resto de src y supabase no aparece ninguna columna learning_steps: el grep solo encuentra relearning_steps en useSession.ts, que es un parámetro de la configuración, no un estado de la tarjeta.
4. Card de ts-fsrs 5.4.1 sí declara learning_steps (node_modules/ts-fsrs/dist/index.d.ts:52).

Todas las respuestas reales de la app pasan por ese ida y vuelta de fila a tarjeta y de tarjeta a fila:
- src/features/engine/useSession.ts:488 y :497
- src/features/speed/speedRuntimeStore.ts:253 y :263

El test reproduce exactamente ese camino:
- New → Good deja la tarjeta en Learning.
- Con la tarjeta en memoria, un segundo Good la gradúa a Review. Es el control y pasa.
- Tras cardToRowUpdates → rowToCard, el segundo Good la deja en Learning (state 1).
- En 5 repasos Good seguidos, cada uno al cumplirse el due, la tarjeta se queda siempre en Learning: [1,1,1,1,1].

En consecuencia, las tarjetas en Learning no se gradúan con respuestas 'good' a lo largo de sesiones. No se pierden datos, pero la función principal de repetición espaciada no funciona para estas tarjetas: hay repasos cada ~10 min sin fin y la retrievability queda limitada a 0,45 en adapter.ts:299-303.

Sobre la severidad: el hallazgo la marca como crítica. Encaja en «la función principal no funciona», no en pérdida de datos.

El único archivo creado es C:\Users\carla\Desktop\Projects\world-orbita\src\__audit__\FSRS-1.test.ts.

### FSRS-2 · Práctica rápida (modo planner) deja de introducir tarjetas nuevas al llegar a N filas y se queda en blanco sin salida

- **Severidad:** critica
- **Ubicación:** `src/features/engine/useSession.ts:274`
- **Evidencia:** Solo se generan conceptos nuevos si `pool.length < questions` (useSession.ts:274), y solo hasta completar `questions` (281). Las filas de Dexie nunca están en State.New porque solo se guardan tras responder, así que generateSessionQueue (planner.ts:145-157) solo devuelve las tarjetas vencidas. Con ≥10 filas y ninguna vencida, la cola sale vacía: q=[], index 0, endedAt=null. En CapitalsPage.tsx:160 todo, incluida la barra de herramientas para cambiar continente o modo, depende de `!finished && current && valid`, y SessionEnd tiene show=false. Lo mismo ocurre en Flags, Locate y Spain en modo quick.
- **Reproducción:** 1) BD vacía, ir a /capitals (countryToCap, All) y jugar las 10 preguntas acertando (Good → Learning +10 min). 2) Pulsar Replay (o recargar) antes de 10 min: el pool tiene 10 filas (≥10), no se crean semillas y ninguna está vencida, así que la cola queda vacía y la página sale en blanco sin selector. 3) Aunque haya vencidas, la sesión solo contiene esas filas y nunca entra un país nuevo de ese submodo/continente. Test de vitest con fake-indexeddb: sembrar 10 filas Review con due futuro, llamar a store.start({}) y comprobar queue.length === 0.
- **Propuesta:** Separar las vencidas del cupo de nuevas: tras el planner, rellenar hasta sessionSize con entidades del dataset sin fila en el pool (respetando continente y submodo), con un límite diario de nuevas por día local. En la UI, si la cola queda vacía, mostrar un estado vacío con la barra de herramientas visible.
- **Verificación (CONFIRMED, test vitest (src/__audit__/FSRS-2.test.ts). fake-indexeddb no está instalado, así que db() de @/lib/db/orbita-db se sustituye por un doble en memoria con where().equals().toArray(). progressRepo, repo y audio también van con mock. Llamo a createSessionStore({mode:'capital', skill:'capital'}).start({continent: undefined, subMode:'countryToCap'}), que es la misma llamada que hace CapitalsPage.):** El test lo confirma. Siembra 10 filas capital:countryToCap en State.Learning con fsrs_due = ahora + 10 min, que es lo que queda tras acertar las 10 preguntas de una sesión. Después llama a start() en modo planner, que es lo que hacen CapitalsPage y el botón Replay. El resultado es queue=[], index=0, endedAt=null y current()=null.

Cadena de causas:
1) En useSession.ts:274 solo se crean semillas nuevas si pool.length < questions, y con 10 filas no se crea ninguna.
2) planner.ts:145-157 descarta las filas que no son New y no están vencidas (isConceptDue). Las filas de Dexie solo existen tras responder, así que nunca están en New y bucketNew queda vacío.
3) generateSessionQueue devuelve [].
4) En CapitalsPage.tsx:160 la barra de herramientas y la pregunta dependen de !finished && current && valid. El bloque de la línea 194 exige current. SessionEnd tiene show={finished}=false. Por tanto la página no muestra nada: ni pregunta, ni selector de continente o modo, ni Replay.

El modo locator tiene el mismo patrón (línea 126). Que Flags, Locate y Spain fallen igual no lo he ejecutado, aunque comparten createSessionStore y el mismo camino de start(). Tampoco he verificado el punto 3 del hallazgo: que con vencidas nunca entre un país nuevo. Por el código (línea 274) se deduce cuando pool ≥ 10, pero no lo he probado.

No hay pérdida ni corrupción de datos. La función principal (práctica rápida) queda inutilizable durante al menos el intervalo de aprendizaje. Además deja de introducir países nuevos de forma permanente en cuanto existen ≥10 filas del submodo, así que encaja como crítica/alta. La navegación global de la app, si existe fuera de la página, permite salir.

### FSRS-3 · queue y conceptQueue se desalinean: la calificación se escribe en otro concepto (Spain provincias/CCAA)

- **Severidad:** critica
- **Ubicación:** `src/features/engine/useSession.ts:322`
- **Evidencia:** En modo planner (320-328) y en el modo conceptRows (189-196), un concepto cuyo entityId no está en el dataset se salta en `q`, pero `cq = plannedConcepts` lo conserva entero, así que los índices se desplazan. submit usa `s.conceptQueue[s.index]` (356) para calificar mientras la pantalla muestra `s.queue[s.index]`. En SpainPage, las sesiones de CCAA y de provincias comparten domain='spain' y skill (SpainPage.tsx:51-106). El filtro del pool es solo `startsWith('spain:')` + `endsWith(':find')` (useSession.ts:251, 270), así que una sesión quick de provincias incluye filas CCAA ('spain:ES-AN:location:find'). ES-AN no está en SPAIN_PROVINCES (los ids son disjuntos, data.ts), con lo que se cae de q pero se queda en cq.
- **Reproducción:** 1) /spain, Locate, nivel CCAA: jugar (modo completo, 19 filas spain:ES-xx:location:find). 2) Nivel Provincias, sesión quick (sin seeding porque el pool ya tiene ≥10). Si hay filas de provincias y alguna CCAA vencida, q=[P1,P2,…] y cq=[CCAA1,P1,…]. Al responder P1, el acierto o fallo se aplica con processReview a CCAA1, P1 recibe la nota de P2, y así sucesivamente. Si solo hay filas CCAA, la cola sale vacía y la página queda en blanco. Test de vitest con fake-indexeddb: sembrar una fila CCAA vencida y una fila de provincia, start({subMode:'find'}) en un store con dataset SPAIN_PROVINCES y comprobar que queue[i] y conceptQueue[i] tienen el mismo entityId.
- **Propuesta:** Construir q y cq juntos, descartando el par completo cuando el item no se resuelve: `for (c of planned) { const it = lookup(c); if (it) { q.push(it); cq.push(c); } }`. Filtrar además el pool por los ids del dataset activo, no solo por el prefijo de dominio. Añadir un assert en submit de que entityId(conceptQueue[i]) === resolveId(queue[i]).
- **Verificación (CONFIRMED, test vitest (C:\Users\carla\Desktop\Projects\world-orbita\src\__audit__\FSRS-3.test.ts). fake-indexeddb no está instalado, así que el test sustituye db() de @/lib/db/orbita-db por un almacén en memoria con vi.mock y también mockea recordConceptAttempt, recordSessionEnd y playAnswerSound. Se ejecutan sin mock createSessionStore, generateSessionQueue, parseConceptId y los datasets SPAIN_CCAA y SPAIN_PROVINCES.):** El hallazgo se confirma con una demostración. En /spain, con nivel Provincias y sesión quick, SpainPage.tsx:256 llama a start({subMode}) y la sesión entra en modo planner (useSession.ts:244-328). El pool solo se filtra por el prefijo `spain:` (251) y el sufijo `:find` (270), así que incluye las filas CCAA 'spain:ES-xx:location:find' que deja una sesión CCAA. Ese store comparte domain='spain' y skill='location' (SpainPage.tsx:51-65). Los ids de CCAA no existen en SPAIN_PROVINCES (el test lo comprueba), por eso se descartan en q (321-325), pero cq = plannedConcepts (327) los conserva y los índices se desplazan.

submit toma s.conceptQueue[s.index] (356) mientras la pantalla muestra s.queue[s.index], y llama a processReview/recordConceptAttempt sobre el concepto equivocado (488-512). Con 3 CCAA vencidas y 10 provincias, al acertar ES-AL (Almería) se grabó la revisión en spain:ES-AN:location:find (Andalucía). La provincia ES-AL recibiría después la nota de la pregunta que en realidad muestra ES-CA, y así sucesivamente. Además, las provincias que quedan al final de cq nunca se muestran.

Esto corrompe de forma persistente el estado FSRS (y lo que se sincroniza a Supabase) en filas que no se respondieron, así que la severidad crítica está justificada. El mismo patrón está en el modo conceptRows (189-196). No lo he reproducido con test, pero el código es idéntico.

Archivo creado: C:\Users\carla\Desktop\Projects\world-orbita\src\__audit__\FSRS-3.test.ts.

### SQL-1 · sync_push castea last_seen_at a numeric pero el cliente envía ISO string: todo push de country_progress falla y acaba en 'dead'

- **Severidad:** critica
- **Ubicación:** `supabase/migrations/20260906162149_update_sync_push_question_history.sql:93`
- **Evidencia:** Estado final de sync_push: insert usa `to_timestamp(coalesce((payload->>'last_seen_at')::numeric, 0) / 1000.0)` (línea 93) y el update `to_timestamp(coalesce((payload->>'last_seen_at')::numeric, 0) / 1000.0)` (línea 111). El cast se introdujo en 20260809234100_add_srs_sync.sql:154/169 (la versión original 20260616184030:229/244 hacía ::timestamptz). El cliente envía ISO: src/lib/db/repo.ts:83 `last_seen_at: new Date(row.lastSeenAt).toISOString()` y src/lib/db/dbProvider.ts:115 igual. `'2026-11-05T10:00:00.000Z'::numeric` lanza 'invalid input syntax for type numeric', capturado por el `exception when others` (línea 247-248) -> rejected sin canonical. En src/lib/sync/workers.ts:133-150 un rechazo sin canonical se reintenta con backoff y a los 10 intentos pasa a status 'dead' (y clearDeadLetter, workers.ts:422-424, lo borra).
- **Reproducción:** Razonamiento SQL estático: con cualquier payload que genere updateSkillProgress (repo.ts:76-85), evaluar `select ('2026-11-05T10:00:00.000Z')::numeric` -> ERROR 22P02. Con vitest: mockear syncPush para que devuelva {accepted:[],rejected:[{op_id,reason:'invalid input syntax for type numeric: "2026-..."'}],canonical:[]} y llamar runPushOnce 10 veces con fake-indexeddb: el item de country_progress acaba en status 'dead'. Efecto real: desde la migración de agosto ningún progreso por país (skills/skill_versions) llega a Supabase; en otro dispositivo solo se ve lo anterior a agosto.
- **Propuesta:** Nueva migración que acepte ambos formatos, p.ej. `case when jsonb_typeof(payload->'last_seen_at')='number' then to_timestamp((payload->>'last_seen_at')::numeric/1000.0) else (payload->>'last_seen_at')::timestamptz end`, o unificar el contrato (ms en todas las fechas) en el cliente. Añadir test de contrato que compare los payloads de repo.ts/dbProvider.ts con los casts del RPC, y revivir los items 'dead' de country_progress tras desplegar.
- **Verificación (CONFIRMED, Análisis SQL estático más lectura del código TS. No se creó ningún test vitest: fake-indexeddb no está instalado (node_modules/fake-indexeddb no existe) y la prueba de fondo es un cast de Postgres, que no se puede ejecutar sin base de datos.):** Confirmado: la cadena de razonamiento es concluyente línea a línea. La versión vigente de sync_push (20260906162149) castea last_seen_at a numeric en el INSERT (:93) y en el UPDATE (:111). Todos los caminos del cliente que encolan country_progress envían un ISO string (repo.ts:83 y dbProvider.ts:115), y nada en queue.ts ni en sync.functions.ts lo transforma.

En PostgreSQL, un texto ISO-8601 nunca se convierte a numeric: falla con 22P02. El `exception when others` (:247) lo convierte en un rechazo sin canonical, y workers.ts:133-150 lo reintenta hasta 10 veces y lo marca 'dead'. Si la usuaria pulsa el botón de limpiar en account.sync, la operación se borra del outbox.

Efecto: desde 20260809234100 ningún push de country_progress puede guardarse en Supabase, ni en fila nueva ni en una existente. El progreso por país solo vive en IndexedDB del dispositivo, y en otro dispositivo solo se ve lo que se sincronizó antes de esa migración. La severidad crítica está justificada.

Matices:
- El progreso local no se corrompe: la fila sigue en IndexedDB con dirty=1. Lo que se pierde es la réplica en el servidor y las operaciones del outbox cuando se limpian los 'dead'.
- No pude ejecutarlo contra una base real porque está prohibido conectarse. La conclusión se apoya en la semántica estándar del cast text→numeric de Postgres, que no tiene excepciones para este formato.

### SYNC-01 · recoverInFlight y purgeBrokenOpIds se ejecutan sobre la BD invitada (orbita-local), nunca sobre la del usuario: los in_flight tras cerrar la pestaña se quedan atascados para siempre

- **Severidad:** critica
- **Ubicación:** `src/lib/sync/workers.ts:359`
- **Evidencia:** startSyncWorkers() (workers.ts:345-362) lanza Promise.all([purgeBrokenOpIds(), recoverInFlight()]) en cuanto se monta RootComponent (__root.tsx:149-151). Ambas llaman a db() en ese momento; db() (orbita-db.ts:539-548) crea y fija 'orbita-local' si aún no hay BD actual. El swap a 'orbita-<uid>' llega después: getSession().then(...swap(uid)) (__root.tsx:177-188), y swap solo fija state.current tras esperar a mergeLocalIntoUserDb (dbProvider.ts:56-69). Las dos funciones no se exportan ni se vuelven a llamar desde onSwap o desde ningún otro sitio, y `started` (workers.ts:346) impide repetirlas. runPushOnce solo coge items 'pending' (workers.ts:90-95), y refreshQueued solo cuenta 'pending' (workers.ts:38), así que la UI muestra que todo está sincronizado.
- **Reproducción:** 1) Inicia sesión y responde una pregunta. Se crean 2 items en el outbox de orbita-<uid>. 2) Corta la red justo después de que runPushOnce ejecute modify({status:'in_flight'}) (workers.ts:104), o cierra la pestaña mientras syncPush está en curso. 3) Vuelve a abrir la app con la sesión ya iniciada. recoverInFlight hace el modify sobre orbita-local, y en orbita-<uid> los items siguen 'in_flight'. 4) No se vuelven a enviar nunca, SyncPill no los cuenta y la respuesta no llega a Supabase. Con vitest y fake-indexeddb: crea la BD 'orbita-u1' con un item in_flight, llama a startSyncWorkers() sin swap previo y luego a swap('u1'). El item sigue in_flight.
- **Propuesta:** Ejecutar purge y recover en cada swap (registrar onSwap en startSyncWorkers) y en el primer runPushOnce de cada BD. Mejor aún, sustituir el estado 'in_flight' persistido por un lease (in_flight_until = now+60s) que cualquier push trate como pending al caducar. Así el atasco no depende de que el arranque coincida con la BD correcta.
- **Verificación:** Confirmado por el controller (lectura de __root.tsx:149 y workers.ts:359)

### SYNC-03 · El pull de country_progress pisa sin condiciones las filas locales (dirty y con skill_versions mayores): 'Force full resync' devuelve el progreso local al estado antiguo del servidor

- **Severidad:** critica
- **Ubicación:** `src/lib/sync/workers.ts:258`
- **Evidencia:** Para country_progress, runPullOnce hace db().countryProgress.put({... skills: row.skills, skill_versions: row.skill_versions, dirty: 0}) sin comparar dirty ni skill_versions (workers.ts:254-268). Lo mismo ocurre con unlocks (269-280). forceFullResync borra todos los cursores (workers.ts:409-419), así que el siguiente pull devuelve todas las filas del servidor. Por SYNC-02, desde agosto el servidor no recibe ninguna actualización de country_progress, de modo que sus filas son antiguas. El canonical de country_progress (workers.ts:161-173) también sobrescribe la fila local completa aunque haya cambios hechos mientras el push estaba en curso.
- **Reproducción:** 1) Usuaria con filas antiguas de country_progress en Supabase (de antes de agosto) y progreso local más reciente (skill_versions.capital=7, frente a 2 en el servidor). 2) En /account/sync pulsa 'Force full resync'. 3) runPullOnce aplica las filas del servidor con put y la fila local queda con skill_versions.capital=2 y las estadísticas antiguas, con dirty=0. El progreso SM-2 y el dominio mostrado retroceden, y los ops del outbox que lo contenían ya están 'dead'. Con vitest: mockea syncPull para que devuelva una fila con versiones menores y comprueba que Dexie queda con la versión menor.
- **Propuesta:** Fusionar por skill en el cliente igual que hace el servidor: para cada skill, quedarse con la versión mayor. No pisar filas con dirty=1 ni con ops pendientes en el outbox para la misma clave. Aplicar el canonical con la misma fusión. Para unlocks, usar max(progress).

### SYNC-04 · Los fallos de red transitorios mandan TODO el lote a dead-letter tras unos 5 minutos, sin reintento automático y sin aviso en la UI; 'Clear dead letter' lo borra definitivamente

- **Severidad:** critica
- **Ubicación:** `src/lib/sync/workers.ts:203`
- **Evidencia:** En el catch del push (workers.ts:198-211), cualquier error (fetch fallido, 401 por token caducado, 500, 'unauthenticated') incrementa attempts en todos los items y los marca status 'dead' si attempts >= MAX_ATTEMPTS (10, línea 19). El backoff (30-33) suma 2+4+8+16+32+60*4 ≈ 302 s. El guard !navigator.onLine (83-86) solo protege contra el offline declarado, no contra una red móvil que no responde o un portal cautivo. Nada vuelve a pasar los 'dead' a pending: forceSync solo toca los pending (397-400). refreshQueued solo cuenta pending (38), así que SyncPill (SyncPill.tsx:37-42) deja de mostrar nada. clearDeadLetter (421-429) hace un delete definitivo.
- **Reproducción:** 1) En el móvil, con red mala pero navigator.onLine=true (o con el refresh del token fallando), responde 20 preguntas. 2) Durante unos 5 min cada push falla con 'Failed to fetch' o 401. 3) Los 40 items pasan a 'dead'. Cuando vuelve la red ya no se envían y la píldora no indica nada. 4) Si la usuaria pulsa 'Clear dead letter' en /account/sync, se borran sin haber llegado a Supabase. Con vitest: mockea syncPush para que lance 10 veces y avanza Date.now. Todos los items quedan 'dead'.
- **Propuesta:** Separar los errores de transporte y autenticación (no consumen intentos, o tienen un tope muy alto con backoff limitado) de los rechazos por item. Reservar 'dead' para rechazos deterministas del servidor. Reiniciar el backoff en 'online' y en 'visibilitychange'. Mostrar en SyncPill el recuento de dead. Que 'Clear dead letter' pida confirmación o pase a 'Retry dead', reponiendo attempts=0.

### SYNC-05 · Cambiar de usuario o cerrar sesión a mitad de un push o pull escribe los datos de A en la BD activa (invitado o B) y borra ids del outbox de otra BD: fuga de progreso entre cuentas

- **Severidad:** critica
- **Ubicación:** `src/lib/sync/workers.ts:249`
- **Evidencia:** runPullOnce comprueba signedIn solo al entrar (244-246). Después de await syncPull(...) (250) escribe con db() (258-333), que resuelve la BD actual en ese momento, no la de cuando se lanzó la petición. Además fija los cursores de A en esa BD (331-333). runPushOnce lee 'due' de la BD de A (90-95) y, tras await syncPush (112), hace db().outbox.delete(r.id) / update(r.id) por id autoincremental (122-155, 200-208) y aplica el canonical (157-195) sobre la BD que haya entonces. handleSignOut hace signOut() y swap(null) sin parar ni esperar a los workers (AccountMenu.tsx:67-73), y swap cambia state.current sin coordinarse con ellos (dbProvider.ts:46-74). Después, si B inicia sesión con su BD vacía, mergeLocalIntoUserDb copia orbita-local a la BD de B y encola todo a la nube de B (dbProvider.ts:56-58, 76-165).
- **Reproducción:** 1) A ha iniciado sesión en el móvil. Al volver a la pestaña (visibilitychange) arranca un pull lento con 500 filas de concept_progress. 2) Antes de que responda, A pulsa 'Sign out' y swap(null) pone orbita-local como actual. 3) Llega la respuesta: las filas de A se escriben en orbita-local (user_id=null) y se guardan los cursores de A en ella. Si había un push en vuelo, sus ids se borran o actualizan en orbita-local y en la BD de A quedan 'in_flight' (ver SYNC-01). 4) B inicia sesión en el mismo dispositivo. swap(B) copia orbita-local en orbita-B y encola concept_progress y country_progress con el progreso de A hacia la cuenta de B. Con vitest y fake-indexeddb: mockea syncPull con una promesa que resuelves después de swap(null) y comprueba que orbita-local contiene las filas.
- **Propuesta:** Capturar la instancia de BD y el userId al empezar cada ciclo (const d = db(); const uid = activeUserId()) y usar solo esa instancia. Tras cada await, abortar si currentDbName() cambió o si la sesión de Supabase ya no es de ese uid. En sign-out, llamar a stopSyncWorkers o esperar a los ciclos en curso (con un AbortController) antes de swap. No hacer merge a la BD de B de nada que no se escribiera siendo invitado (marca de origen en orbita-local).

### BUG-02 · queue y conceptQueue se desalinean cuando un concepto planificado no existe en el dataset: la nota FSRS se escribe en otro concepto (CCAA en vez de provincia)

- **Severidad:** critica
- **Ubicación:** `src/features/engine/useSession.ts:327`
- **Evidencia:** useSession.ts:320-328: `plannedItems` omite los conceptos cuya entidad no esta en itemMap, pero luego hace `cq = plannedConcepts` sin filtrar. Lo mismo ocurre con conceptRows en las lineas 188-196. Despues submit() usa `s.conceptQueue[s.index]` (linea 356) junto a `s.queue[s.index]`. En Espana, las 7 stores comparten domain 'spain' y skill (SpainPage.tsx:52-106), y el filtro de dominio (linea 251, `startsWith('spain:')`) mete conceptos de CCAA (ES-AN...) en el pool de provincias. Reproducido en vitest: con 3 conceptos de CCAA en Relearning, start({subMode:'find'}) en la store de provincias da `queue 7 conceptQueue 10`, item0=ES-AL (Almeria) y concept0=spain:ES-AN:location:find; tras submit(true) se escribe en `spain:ES-AN:location:find`. Si solo hay conceptos de CCAA (19 o mas), queue=0 y conceptQueue=10, y en SpainPage:389 la barra de herramientas desaparece, asi que no se puede volver a CCAA sin salir de la pagina.
- **Reproducción:** 1) /spain?skill=locate en nivel CCAA (siempre modo completo con 19 items): fallar 2-3 comunidades. 2) Cambiar el nivel a Provincias en modo rapido. 3) El primer prompt es una provincia (p. ej. Almeria), pero al responder se actualiza el FSRS de Andalucia (ES-AN), y todas las posiciones siguientes quedan desplazadas. Con un historial solo de CCAA, la pantalla de provincias queda vacia y sin controles.
- **Propuesta:** Construir queue y conceptQueue a la vez, a partir de pares {item, concept}, y descartar juntos los conceptos sin item. Filtrar el pool por las entidades del dataset activo (validIds de activeDataset) siempre, no solo cuando hay continente. Anadir un assert en dev: queue.length === conceptQueue.length. Para la ruta de conceptRows (Review), aplicar el mismo filtrado conjunto.

### BUG-03 · ChallengeRunner llama hooks despues de un return condicional: al terminar el Daily/Weekly la pantalla rompe y la sesion no se registra

- **Severidad:** critica
- **Ubicación:** `src/features/challenges/ChallengesPage.tsx:415`
- **Evidencia:** ChallengesPage.tsx:415 `if (finished) { return (<SessionEnd .../>) }` va antes de useCallback(pick) en 433, useCallback(next) en 477, useMemo en 482, useAnswerHotkeys en 489, useSkipHotkey/useCallback en 490 y useAutoAdvance en 495. ChallengeRunner no se remonta, porque se renderiza sin key en la linea 126. Cuando index llega a items.length, el render tiene menos hooks que el anterior y React lanza 'Rendered fewer hooks than expected'. Como ese render no llega a hacer commit, el useEffect de recordSessionEnd (394-413) no se ejecuta. ESLint lo confirma con 7 errores react-hooks/rules-of-hooks en las lineas 433, 477, 482, 489, 490(x2) y 495.
- **Reproducción:** 1) /challenges y empezar el Daily 10. 2) Responder las 10 preguntas. 3) Tras el auto-advance de la ultima, en lugar de SessionEnd aparece el error de la ruta o una pantalla rota. No se guarda la sesion en gameSessions/sessions_log y 'Your best' no se actualiza. Comprobable en local con `npx eslint src/features/challenges/ChallengesPage.tsx --rule 'prettier/prettier: off'`.
- **Propuesta:** Mover todos los hooks por encima del early return (con guardas internas `if (!current) return`), o separar la vista final en un componente aparte que se renderice desde el padre cuando active.index >= items.length.
- **Verificación:** Confirmado por el controller (6 hooks después del return en ChallengesPage.tsx:433-495)

### FSRS-4 · Review de capToCountry: el enunciado muestra la capital y las opciones también son capitales, así que la respuesta es trivial

- **Severidad:** alta
- **Ubicación:** `src/features/review/ReviewPage.tsx:194`
- **Evidencia:** McQuestion etiqueta las opciones con `skill === 'capital' ? (opt.capital ?? opt.name) : opt.name` (194), sin mirar el subMode. Para subMode 'capToCountry' el prompt es 'Which country's capital is ${current.capital}?' y el visual muestra current.capital en grande (413-424). La opción correcta tiene el mismo texto que se muestra. Como la respuesta es rápida, assess() la puntúa 'easy' (Rating.Easy) y ts-fsrs alarga mucho el intervalo sin que haya habido recuerdo.
- **Reproducción:** 1) Jugar Capitales en Cap → Country y fallar algunas (filas X:capital:capToCountry). 2) Al vencer, abrir /review: aparece 'Which country's capital is Paris?' con 'Paris' grande y opciones Paris/Berlin/Rome/Madrid. Pulsar 'Paris' acierta. Con <2,5 s el resultado es 'easy' → Rating.Easy (Review a +7 días o más).
- **Propuesta:** En McQuestion, usar opt.name como etiqueta cuando subMode === 'capToCountry' (y para los equivalentes de Spain). Mejor todavía: elegir el renderizado por subMode con una tabla única compartida con las páginas de juego.

### FSRS-5 · ConceptIds antiguos de 2 partes en el servidor nunca se migran en el pull ni en una BD nueva de usuario: el progreso se duplica o queda invisible

- **Severidad:** alta
- **Ubicación:** `src/lib/db/orbita-db.ts:295`
- **Evidencia:** La migración v9 (orbita-db.ts:295-316, commit eff5ddf del 2026-08-22) renombra 'FRA:capital'→'FRA:capital:countryToCap' solo en local, sin marcar dirty ni encolar en el outbox, así que el servidor conserva las filas de 2 partes subidas entre el 9 y el 22 de agosto (sync desde bde6a8c). El upgrade de Dexie no se ejecuta al crear una BD nueva (orbita-<uid> en otro dispositivo o en un login nuevo). El pull (workers.ts:281-305) inserta conceptId tal cual, sin normalizar. Después, el filtro del planner `endsWith(':countryToCap')` (useSession.ts:270) no ve esas filas y el juego crea una tarjeta nueva de 3 partes. Review sí las ve (parseConceptId 2 partes), con lo que el mismo hecho tiene dos tarjetas FSRS.
- **Reproducción:** 1) Usuario que sincronizó entre el 9 y el 22 de agosto (servidor con concept_id 'FRA:capital'). 2) Login en un dispositivo nuevo: se crea la BD orbita-<uid> en la versión actual y el pull escribe 'FRA:capital'. 3) En /capitals, Francia sale como nueva (sin progreso); en /review sale 'FRA:capital' como tarjeta aparte. Comprobable con fake-indexeddb ejecutando el handler de pull con una fila de 2 partes y luego el start() del planner.
- **Propuesta:** Normalizar conceptId en el pull (y en migrateGuestProgress) con la misma tabla de la v9, fusionando con la fila de 3 partes si ya existe (quedarse con la de mayor fsrs_last_review). Encolar el renombrado hacia el servidor y escribir una migración SQL que renombre o fusione las filas de 2 partes.

### SQL-2 · El cast op_id::uuid está fuera del bloque EXCEPTION: un solo op_id inválido aborta todo el lote

- **Severidad:** alta
- **Ubicación:** `supabase/migrations/20260906162149_update_sync_push_question_history.sql:48`
- **Evidencia:** `op_id_v := (m->>'op_id')::uuid;` (línea 48) se ejecuta antes del `begin` del subbloque (línea 50), así que su excepción no la captura `exception when others` (línea 247) y aborta la función entera. El server fn solo valida `op_id: z.string().min(1)` (src/lib/sync/sync.functions.ts:7). En el cliente, cualquier error de la RPC entra en el catch de workers.ts:198-208, que suma un intento a TODOS los items del lote (hasta 50) y los marca 'dead' al llegar a 10. purgeBrokenOpIds (workers.ts:70-78) solo se ejecuta al arrancar (workers.ts:359), no antes de cada push.
- **Reproducción:** Encolar en la misma sesión un item con op_id 'abc:cp' (el formato antiguo) junto a 49 items válidos sin recargar: la RPC lanza 'invalid input syntax for type uuid', los 50 items reciben attempts+1 y a los 10 ciclos quedan todos 'dead', aunque fueran válidos. Estático: `select ('x:cp')::uuid` fuera de un bloque con EXCEPTION propaga el error.
- **Propuesta:** Mover el cast dentro del `begin ... exception` (o validar con regex y rechazar ese item con reason 'invalid_op_id'), y en el server fn usar `z.string().uuid()` para rechazar ese item antes de llamar a la RPC.

### SQL-3 · sync_pull pagina con cursor `updated_at > cursor` y LIMIT: pierde para siempre las filas empatadas en el límite de página

- **Severidad:** alta
- **Ubicación:** `supabase/migrations/20260809234100_add_srs_sync.sql:350`
- **Evidencia:** Estado final de sync_pull (no se redefine después): `from (select * from public.concept_progress where user_id = uid and updated_at > cur order by updated_at asc limit _limit) t` y cursor = `max(updated_at)` (líneas 348-351). Igual para country_progress (327), daily_summary (365) y el resto. sync_push pone `updated_at = now()` (20260906162149:142, 158), y now() es el instante de inicio de la transacción, así que todas las filas de un mismo lote (hasta 50, workers.ts:20) tienen el MISMO updated_at. No hay desempate por clave.
- **Reproducción:** Usuario con más de 500 conceptos subidos en lotes mixtos (p.ej. el primer lote con 37 country_progress + 3 unlocks + 10 concept_progress, después lotes de 50). Primer pull en un dispositivo nuevo: página 1 = 10 + 9x50 = 460 filas y luego 40 de las 50 del grupo siguiente (mismo updated_at T). Cursor = T. Segundo pull: `updated_at > T` salta las 10 filas restantes de T. Nunca llegan a ese dispositivo; forceFullResync (workers.ts:409) reproduce el mismo corte. Estático: basta con 501 filas con el mismo updated_at y _limit=500.
- **Propuesta:** Cursor compuesto (updated_at, pk): `where (updated_at, concept_id) > (cur_ts, cur_id) order by updated_at, concept_id limit n`, devolviendo ambos en el cursor; índice (user_id, updated_at, concept_id). Usar clock_timestamp() no basta para el empate. Alternativa: una columna bigserial/seq por fila (ver SQL-4).

### SQL-6 · La resolución de conflictos compara contadores 'version' locales entre dispositivos e invitado: descarta repasos más recientes y acepta otros más antiguos

- **Severidad:** alta
- **Ubicación:** `supabase/migrations/20260906162149_update_sync_push_question_history.sql:147`
- **Evidencia:** `if inc_ver > cur_ver then update ... else rejected 'version conflict' + canonical` (147-178). version es un contador por dispositivo (cardToRowUpdates: `version: currentVersion + 1`, src/lib/fsrs/adapter.ts). El cliente, al recibir rechazo con canonical, BORRA el item del outbox (workers.ts:127-133) y sobrescribe la fila local con la del servidor (workers.ts:174-190). La fusión invitado->usuario elige por fsrs_reps (src/lib/auth/migrateGuestProgress.ts:45 en el archivo, `guest.fsrs_reps > ex.fsrs_reps`), no por versión, así que la fila fusionada conserva la versión del invitado.
- **Reproducción:** 1) Dispositivo A (versión 3) y B (versión 3) repasan offline la misma tarjeta; A sube la versión 4 primero; B (versión 4, repaso posterior) recibe 'version conflict' y su estado FSRS se descarta en local y en servidor (solo queda question_history). 2) Invitado con 9 repasos (versión 9) de una tarjeta que el usuario tiene en el servidor con versión 3 pero last_review más reciente: el push del invitado gana y pisa el estado más nuevo. 3) Al revés: invitado con versión 2 y más reps que la fila local fusionada; el siguiente repaso sube la versión 3, el servidor tiene 5 -> rechazo, y el canonical reemplaza la fila con más reps.
- **Propuesta:** No usar un contador local como reloj global. Opciones: el servidor asigna la versión (`version = cur_ver + 1`) y el cliente envía `base_version`; si base_version < cur_ver, desempatar por fsrs_last_review (el repaso más reciente gana) o rebasar reaplicando el ReviewLog de question_history. Como mínimo, desempatar por fsrs_last_review cuando las versiones empatan o vienen de otro client_id.

### SYNC-06 · Una respuesta local aún no subida se descarta: el pull y el canonical sobrescriben concept_progress dirty, y el 'version' es un contador que empata entre dispositivos

- **Severidad:** alta
- **Ubicación:** `src/lib/sync/workers.ts:289`
- **Evidencia:** El pull aplica la fila del servidor si serverVersion > local.version, sin mirar dirty ni el outbox (workers.ts:286-309). El servidor acepta solo si inc_ver > cur_ver. Si no, rechaza con canonical (migración 20260906:146-178). El cliente borra el op y pisa la fila local con el canonical sin comprobar si hay una versión local más nueva (workers.ts:127-133, 174-190). La versión es currentVersion+1 (adapter.ts:193), así que dos dispositivos que parten de v1 generan ambos v2. onOnline lanza push y pull a la vez (386-389). LWW no usa reloj del cliente, sino un contador que no ordena entre dispositivos.
- **Reproducción:** 1) El móvil está offline con FRA:capital:countryToCap en v1. Responde y queda en v2, dirty=1, op pendiente. 2) En el portátil responde la misma tarjeta (v2) y la sube. 3) El móvil recupera la red. onOnline lanza el pull, que no pisa (2 > 2 es falso), y el push, que el servidor rechaza con 'version conflict' y canonical. El cliente borra el op y sustituye su FSRS por el del portátil. La revisión del móvil desaparece del estado FSRS (solo queda en question_history). Variante: si el portátil hizo 2 revisiones (v3), el pull pisa directamente la fila dirty del móvil. Con vitest: fila local dirty v2, mock de syncPull con v3. La fila local queda v3 y dirty=0.
- **Propuesta:** No aplicar el pull ni el canonical sobre filas con dirty=1 o con ops pendientes para el mismo conceptId. Encolarlos como conflicto y resolverlos al confirmar el push. Para FSRS, la resolución correcta es rehacer el estado reproduciendo question_history (ordenado por answered_at del servidor) o, como mínimo, quedarse con el mayor fsrs_last_review en lugar de la versión. Aplicar el canonical solo si su version >= la local.

### SYNC-08 · La fusión de invitado en una BD de usuario no vacía nunca encola nada: el progreso del invitado se queda solo en local, y luego un pull puede pisarlo

- **Severidad:** alta
- **Ubicación:** `src/lib/auth/migrateGuestProgress.ts:46`
- **Evidencia:** migrateGuestProgress escribe concept_progress, gameSessions y countryProgress con dirty:1 (líneas 46, 74, 90, 102) y copia question_history (63), pero no crea ninguna fila en el outbox. Ningún código consulta dirty (grep: no hay where/filter sobre dirty). mergeLocalIntoUserDb, la única que encola, aborta si la BD destino ya tiene datos (dbProvider.ts:82-86) y no encola nunca question_history ni sessions. Después migrateGuestProgress borra la BD invitada (125-127), incluido su outbox. handleSignedInSync solo hace push si migrated>0 (workers.ts:443-445), y lo que hay en el outbox no incluye esas filas. El toast dice 'merged into your account' (__root.tsx:169-173).
- **Reproducción:** 1) La usuaria ha usado su cuenta en este dispositivo (orbita-<uid> no vacía). 2) Cierra sesión, juega como invitada y responde 30 tarjetas nuevas. 3) Vuelve a iniciar sesión. mergeLocalIntoUserDb aborta y migrateGuestProgress copia las filas con dirty=1 y borra orbita-local. Aparece el toast 'Saved N items'. 4) El outbox no contiene esas filas: nunca llegan a Supabase y en otro dispositivo no aparecen. Si el servidor ya tenía alguno de esos conceptId con una versión mayor, el siguiente pull (workers.ts:289) pisa la fila del invitado. Con vitest y fake-indexeddb: siembra las dos BD, llama a migrateGuestProgress y comprueba que el outbox queda vacío.
- **Propuesta:** En migrateGuestProgress, encolar en la misma transacción un op por cada concept_progress/countryProgress/unlock fusionado y por cada question_history/sessions (reutilizando el op_id de question_history). Poner version = max(local, invitado)+1 para que el servidor lo acepte. Borrar la BD invitada solo cuando el outbox esté escrito. Eliminar la ruta duplicada de mergeLocalIntoUserDb o unificar ambas.

### DB-02 · Un push en curso durante el swap marca o borra filas del outbox de OTRA BD por id autoincremental, y las del usuario original se quedan en in_flight

- **Severidad:** alta
- **Ubicación:** `src/lib/sync/workers.ts:112`
- **Evidencia:** runPushOnce marca un lote como in_flight en la BD activa (workers.ts:104) y espera `await syncPush(...)` (workers.ts:112). Después hace `db().outbox.delete(r.id!)` y `db().outbox.update(r.id!, ...)` (workers.ts:125, 132, 138, 144, 153, 202) usando ids `++id` que se numeran por separado en cada BD. Si entre medias ocurre swap(null) o swap(uid), se borran o modifican filas con esos ids en la BD nueva: por ejemplo, las que acaba de encolar mergeLocalIntoUserDb (dbProvider.ts:165), que empiezan en id 1 en una BD de usuario recién creada. Mientras tanto, las filas originales siguen in_flight en la BD anterior. recoverInFlight solo se ejecuta una vez en startSyncWorkers (workers.ts:365-372, protegido por `started`), así que tras volver a iniciar sesión sin recargar se quedan atascadas. Además, setSignedIn(true) se ejecuta antes de que termine swap(uid) (__root.tsx:196-197), así que un push del intervalo de 4 s puede enviar el outbox de invitado con el token del usuario mientras la fusión está en curso.
- **Reproducción:** fake-indexeddb: 1) En orbita-A, encolar 3 filas (ids 1-3) y signedIn=true. 2) Mockear syncPush diferido y lanzar runPushOnce(). 3) await swap('B') con orbita-local con datos (mergeLocalIntoUserDb encola en orbita-B con ids 1..n). 4) Resolver syncPush con accepted=[op_ids de A]. 5) Comprobar que las filas 1-3 de orbita-B.outbox han desaparecido (nunca se envían) y que las de orbita-A siguen con status 'in_flight'.
- **Propuesta:** Igual que en DB-01: capturar la instancia `d` al principio del push y operar solo sobre ella, borrando por op_id (índice único &op_id) en lugar de por id. Hacer recoverInFlight en cada swap (en onSwap) y no solo al arrancar. Poner setSignedIn(true) después de que swap(uid) termine.

### DB-03 · migrateGuestProgress borra la BD de invitado aunque las copias hayan fallado en silencio (pérdida definitiva del progreso de invitado)

- **Severidad:** alta
- **Ubicación:** `src/lib/auth/migrateGuestProgress.ts:127`
- **Evidencia:** Los pasos 2-5 tragan los errores: `userDb.question_history.bulkPut(guestHistory).catch(() => {})` (l.63), gameSessions (l.76), countryProgress (l.105) y unlocks (l.120). Después se ejecuta siempre `await Dexie.delete(GUEST_DB_NAME)` (l.126-127). No hay transacción, aunque el comentario de la cabecera dice 'atomically merged' (l.5). Si falla un bulkPut por QuotaExceededError, por un BulkError de ConstraintError (índice único &op_id en gameSessions, orbita-db.ts:236) o porque la BD se cierra por versionchange, la BD de invitado se borra igualmente y esos datos se pierden para siempre. Además, `migrated` cuenta como migradas filas que no se han escrito (l.64, 77), y el toast «Saved N items» (__root.tsx:166-170) informa de algo falso.
- **Reproducción:** vitest + fake-indexeddb: crear orbita-local con 5 question_history y 3 gameSessions. Hacer vi.spyOn(userDb.gameSessions,'bulkPut').mockRejectedValue(new Error('QuotaExceededError')) y llamar migrateGuestProgress(userDb,'u1'). Resultado: devuelve migrated=8, Dexie.exists('orbita-local') es false y userDb.gameSessions.count()==0.
- **Propuesta:** Hacer todas las escrituras en una sola `userDb.transaction('rw', [concept_progress, question_history, gameSessions, countryProgress, unlocks, outbox], ...)` sin .catch internos. Borrar la BD de invitado solo si la transacción hace commit. Ante un error, conservar orbita-local y marcar en sync_meta que hay que reintentar.

### BUG-04 · start() concurrente sin token de generacion: una sesion antigua pisa a la nueva y las notas se escriben en el subMode equivocado

- **Severidad:** alta
- **Ubicación:** `src/features/engine/useSession.ts:332`
- **Evidencia:** useSession.ts:154-349: start() hace await sobre db().concept_progress (lineas 207 y 246) y luego `set({queue, conceptQueue,...})` sin comprobar si se ha llamado a otro start() mientras tanto (speedRuntimeStore ya usa currentStartToken para esto). Al montar, CapitalsPage.tsx:55-59 y FlagsPage.tsx:53-56 llaman a start() con el subMode por defecto, y getPref (CapitalsPage:47-49, FlagsPage:41-47) cambia sub de forma asincrona, lo que provoca un segundo start(). Reproducido en vitest con un mock diferido: start('countryToCap') y despues start('capToCountry'); si la primera lectura resuelve la ultima, conceptQueue acaba con subModes ['countryToCap'] mientras la UI muestra capToCountry.
- **Reproducción:** 1) Guardar la preferencia capitals.sub='capToCountry'. 2) Recargar /capitals: se lanzan dos start() casi a la vez. 3) Si la lectura de IndexedDB del primero termina despues (o al cambiar rapido de continente/submodo), la UI pregunta 'Cap -> Country' pero submit() actualiza conceptos `XXX:capital:countryToCap`. Test: el mock de toArray devuelve promesas que se resuelven en orden inverso.
- **Propuesta:** Anadir un contador de generacion en el closure de createSessionStore: `const gen = ++startGen` al empezar, y antes del set final `if (gen !== startGen) return`. Opcionalmente, no arrancar hasta que las preferencias hayan cargado.

### FSRS-6 · assess() da Rating.Easy por velocidad en opción múltiple, en contra de la política conservadora documentada

- **Severidad:** media
- **Ubicación:** `src/lib/fsrs/assessment.ts:137`
- **Evidencia:** assessment.ts:136-139: `else if (speed === 'very_fast') outcome = 'easy'`. Los umbrales son 1,5 s para flag y 2-2,5 s para el resto. La cabecera del adaptador (adapter.ts:17-21) y el docstring de assess (assessment.ts:115-121) dicen correct→Good, sin Easy. En ts-fsrs, New+Easy pasa directamente a Review a 7 días (S=8,3), saltándose los pasos de aprendizaje; en una tarjeta Review S=10, Good da 13 días y Easy bastante más (scratchpad/t/p.mjs y q.mjs). En reconocimiento con 4 opciones, un clic rápido, una adivinanza (25 %) o una respuesta trivial (FSRS-4) bastan para Easy.
- **Reproducción:** En /flags (flagToCountry), con un país nuevo, pulsar la opción correcta en <1,5 s. Se registra grade 3 ('easy') en question_history y la fila pasa a fsrs_state=2 con due a ~7 días. Test: assess({correct:true, responseMs:1000, questionType:'flag', retrievalMode:'easy'}).outcome === 'easy'.
- **Propuesta:** Limitar el resultado a 'good' en opción múltiple/reconocimiento y reservar 'easy' para recuerdo libre (retrievalMode 'hard') con un umbral más estricto, o eliminarlo y alinear la documentación y el test 'correct (instant speed) → easy'.

### FSRS-7 · Speed Round califica la tarjeta equivocada (name) o ninguna (flag)

- **Severidad:** media
- **Ubicación:** `src/features/speed/speedRuntimeStore.ts:236`
- **Evidencia:** Speed construye `${iso3}:${targetSkill}:${actualDirection}` con name→'name' y flag→'countryToFlag' (226-236). El prompt de 'name' en SpeedPage.tsx:366-368 es 'Name this flag' (bandera→país), pero califica 'X:name:name', la tarjeta de LocatePage 'Name this country' sobre el globo. Ninguna página crea 'X:flag:countryToFlag' (Flags usa flagToCountry/flagToType), así que getConceptProgress devuelve undefined y la respuesta se descarta en silencio (238-239).
- **Reproducción:** 1) Jugar Locate→Name y Flags. 2) Speed Round: una pregunta 'Name this flag' de Francia cambia FRA:name:name (globo), no FRA:flag:flagToCountry. Las preguntas 'Which flag' no generan entradas en question_history.
- **Propuesta:** Mapear name(bandera→país)→'X:flag:flagToCountry' y crear o usar una tarjeta explícita 'X:flag:countryToFlag' (o no calificar esa dirección). Centralizar el mapeo prompt→conceptId en concept.ts.

### FSRS-8 · Speed: reposición sin exclusión repite conceptos y no hay bloqueo de entrada (doble clic se califica en la siguiente pregunta)

- **Severidad:** media
- **Ubicación:** `src/features/speed/speedRuntimeStore.ts:372`
- **Evidencia:** topUpQueue (372-377) llama a selectMixedQuestions sin excludeIso3. Con continente Europa (~45 países) la cola inicial ya los agota todos y la reposición repite los mismos países y skills, así que el mismo concepto se califica dos o más veces en la misma ronda (un repaso a 0 días). Además, answer() (216-224) avanza el índice al momento sin bloquear la entrada ni mostrar feedback: el segundo clic de un doble clic cae en las opciones de la pregunta siguiente y se califica con responseMs de ~100 ms (Again si falla, Easy si acierta por azar).
- **Reproducción:** 1) Speed con continente Europa: pasado el país ~41 aparecen repetidos y question_history recibe dos entradas del mismo conceptId en la sesión 'speed-<ts>'. 2) Hacer doble clic en una opción: se registran dos respuestas, la segunda sobre otro país.
- **Propuesta:** Pasar excludeIso3 con los países ya usados (o no calificar con FSRS conceptos ya calificados en la ronda, como hace fsrsUpdatedIds en useSession). Ignorar respuestas con responseMs < ~250 ms o hasta el siguiente frame de render.

### FSRS-9 · rowToCard no valida difficulty/stability en estados no New: ts-fsrs lanza una excepción y submit deja la sesión colgada

- **Severidad:** media
- **Ubicación:** `src/lib/fsrs/adapter.ts:122`
- **Evidencia:** `card.difficulty = row.fsrs_difficulty ?? 0` (122). Solo se corrige la stability en Review (129-131). Con ts-fsrs 5.4.1 probé: Review con d=0 → throw 'Invalid memory state'; Relearning con s=0,2 y d=0 → throw; Learning con s=0 y d=5 → throw. El esquema SQL permite fsrs_difficulty/stability NULL y el pull los conserva como null (workers.ts:296-297). En useSession.submit la llamada a processReview (489) no tiene try/catch: el sonido ya ha sonado (354), set(updates) no se ejecuta y answerState sigue en 'idle', así que la pregunta no avanza y cada clic vuelve a lanzar la excepción.
- **Reproducción:** Test de vitest: processReview(rowToCard({...row, fsrs_state:2, fsrs_difficulty:null, fsrs_stability:5}), 'good', Date.now()) lanza FSRSValidationError. En la app: una fila sincronizada con difficulty NULL y estado Review hace que /review se quede bloqueado en esa tarjeta.
- **Propuesta:** En rowToCard, si el estado no es New y la memoria no es válida (d∉[1,10] o s≤0), reconstruir con valores por defecto seguros (d=5, s=max(s, S_MIN)) o degradar a New conservando reps y lapses. Envolver processReview en submit con try/catch para que la UI avance.

### FSRS-11 · Migraciones legado→FSRS nunca se ejecutan, y seedFsrsFromSm2 machacaría el progreso FSRS si se activara

- **Severidad:** media
- **Ubicación:** `src/lib/fsrs/migration.ts:85`
- **Evidencia:** grep: seedFsrsFromSm2 y migrateCustomFsrsToOfficial no se llaman desde ningún sitio, así que el progreso SM-2 de countryProgress nunca llega a concept_progress. Si alguien las activa: bulkPut (migration.ts:85) sobrescribe filas FSRS existentes con version:1 y last_review antiguos (el comentario dice 'Use put to avoid throwing on duplicate keys if migration runs twice'), y version 1 provocaría rechazos por conflicto de versión en sync_push. Además, el caso stat sin srs y confidence 0 deja State.New con reps>0 y lapses=timesWrong. migrateCustomFsrsToOfficial marca dirty sin subir la versión, así que el servidor lo rechazaría.
- **Reproducción:** Análisis estático: ningún import de './fsrs/migration'. Test: con fake-indexeddb, sembrar una fila FSRS 'FRA:capital:countryToCap' version 7 y una fila countryProgress, ejecutar seedFsrsFromSm2() y ver que la fila queda con version 1 y el estado SM-2.
- **Propuesta:** Decidir si existen usuarios con datos solo SM-2. Si existen, ejecutar el seed una vez (flag en meta) solo para conceptIds sin fila (bulkAdd o comprobando con get), con version = max(local)+1. Si no, borrar migration.ts para que nadie lo reactive.

### SQL-4 · Cursor por now() y orden de commit: transacciones concurrentes pueden quedar por detrás de un cursor ya avanzado

- **Severidad:** media
- **Ubicación:** `supabase/migrations/20260906162149_update_sync_push_question_history.sql:158`
- **Evidencia:** updated_at = now() (líneas 114, 142, 158, 210, 226, 240) toma el inicio de la transacción, no el commit. sync_pull (20260809234100:350) avanza el cursor a max(updated_at) de lo visible. Si la transacción A (now()=t1) confirma después de que B (now()=t2>t1) haya sido leída por un pull, las filas de A con updated_at=t1 < cursor no se devuelven nunca.
- **Reproducción:** Dos dispositivos del mismo usuario hacen push a la vez; A empieza en t1 y tarda (lote de 50 + bloqueo de fila), B empieza en t2 y confirma antes. Un tercer dispositivo hace pull entre el commit de B y el de A: cursor = t2. Después confirma A con updated_at=t1: el siguiente pull usa `> t2` y se salta las filas de A. Razonamiento estático sobre la semántica de now() en Postgres.
- **Propuesta:** Usar una secuencia monotónica asignada por trigger en cada INSERT/UPDATE (bigserial `change_seq`) y paginar por ella con un margen, o restar una ventana de seguridad al cursor (cursor - 5 s) con deduplicación por pk/version en el cliente (que ya compara la versión en concept_progress).

### SQL-5 · Read-modify-write sin bloqueo en concept_progress y country_progress: se pierden actualizaciones concurrentes aunque ambas se den por 'accepted'

- **Severidad:** media
- **Ubicación:** `supabase/migrations/20260906162149_update_sync_push_question_history.sql:126`
- **Evidencia:** `select * into cprog_row from public.concept_progress where user_id = uid and concept_id = v_concept_id;` (126-127) sin FOR UPDATE; después `if inc_ver > cur_ver then update ... where user_id = uid and concept_id = v_concept_id` (147-159), sin condición de versión en el WHERE. En READ COMMITTED el segundo UPDATE espera al bloqueo y luego se aplica igualmente. country_progress hace lo mismo: lee cp_row (87-88), fusiona en memoria (96-105) y sobrescribe skills completo (106-115). Los INSERT de rama 'not found' no tienen ON CONFLICT: dos inserciones concurrentes producen unique_violation (se reintenta y se recupera solo).
- **Reproducción:** Dos dispositivos con la tarjeta en versión 5 hacen push a la vez con versión 6 y estados FSRS distintos: ambos leen cur_ver=5, ambos actualizan y ambos reciben 'accepted'; gana el último commit y el otro dispositivo se queda con un estado local distinto del servidor sin canonical que lo corrija (solo un pull posterior con versión mayor lo arreglaría; con igual versión, workers.ts:289 no lo aplica). En country_progress, dos skills distintas del mismo país en paralelo: el segundo UPDATE sobrescribe `skills` con su merge, que no incluye la skill del primero.
- **Propuesta:** `select ... for update` antes de comparar, o hacer el UPDATE condicional `... where user_id=uid and concept_id=v and version < inc_ver` y comprobar FOUND (si no, devolver rejected + canonical). Para country_progress, merge atómico en el propio UPDATE o FOR UPDATE. Usar INSERT ... ON CONFLICT DO NOTHING y recargar la fila.

### SQL-7 · sync_pull no devuelve question_history: el historial nunca se restaura en otro dispositivo

- **Severidad:** media
- **Ubicación:** `supabase/migrations/20260809234100_add_srs_sync.sql:308`
- **Evidencia:** El sync_pull final (308-404) incluye country_progress, concept_progress, daily_summary, sessions_log, challenge_attempts, unlocks, daily_streak y profiles, pero no question_history, aunque el cliente envía cursor_question_history (src/lib/sync/workers.ts:225) y el servidor lo almacena (20260906162149:181-195, con mode/direction/fsrs_log). El cliente tampoco tiene rama para aplicarlo (workers.ts:254-328).
- **Reproducción:** Iniciar sesión en un navegador nuevo con una cuenta que tiene repasos: la tabla local question_history queda vacía, así que confusiones, estadísticas y cualquier recálculo basado en el ReviewLog empiezan de cero, aunque concept_progress sí llega. Estático: grep de 'question_history' en sync_pull no da resultados.
- **Propuesta:** Añadir la rama question_history al sync_pull, mapeada a camelCase (op_id, conceptId, sessionId, grade, responseMs, correct, answeredAt en ms, mode, direction, fsrs_log), paginada con cursor compuesto (ver SQL-3), y su rama de aplicación idempotente por op_id en workers.ts. Índice existente (user_id, updated_at desc) sirve.

### SQL-8 · concept_progress no guarda fsrs_elapsed_days ni fsrs_scheduled_days: el pull los pierde

- **Severidad:** media
- **Ubicación:** `supabase/migrations/20260809234100_add_srs_sync.sql:7`
- **Evidencia:** La tabla (líneas 2-18) solo tiene fsrs_state/stability/difficulty/due/reps/lapses/last_review y ninguna migración posterior añade columnas. El cliente las envía (src/lib/db/progressRepo.ts:70-71; dbProvider.ts:154-155) y sync_push las ignora. Al aplicar el pull (workers.ts:290-306) y el canonical (workers.ts:175-190) no se ponen, y rowToCard usa `?? 0` (src/lib/fsrs/adapter.ts:125-126). learning_steps (Card de ts-fsrs 5.4.1) tampoco se guarda en ningún sitio.
- **Reproducción:** Repasar una tarjeta en el dispositivo A (scheduled_days=12) y hacer pull en B: la fila local de B tiene fsrs_scheduled_days undefined y rowToCard pone 0. Con vitest: aplicar a fake-indexeddb una fila de pull sin esos campos y comprobar rowToCard(...).scheduled_days === 0.
- **Propuesta:** Migración que añada `fsrs_elapsed_days int`, `fsrs_scheduled_days int` y `fsrs_learning_steps int` (con default 0), con escritura en sync_push y devolución en sync_pull y en el canonical; en el cliente, incluirlas al aplicar.

### SQL-9 · daily_summary se fusiona sumando: no es idempotente ante reintentos ni ante envíos de totales

- **Severidad:** media
- **Ubicación:** `supabase/migrations/20260906162149_update_sync_push_question_history.sql:206`
- **Evidencia:** `on conflict (user_id, date_key) do update set reviews_count = public.daily_summary.reviews_count + excluded.reviews_count, ...` (205-210) sin registro del op_id. Si la RPC confirma pero la respuesta HTTP se pierde, el cliente reintenta el lote (workers.ts:198-208) y la suma se aplica dos veces. Hoy está latente: ningún código hace enqueue de 'daily_summary' (grep solo encuentra dbProvider.ts:100-104 y workers.ts:310), aunque el server fn lo admite (sync.functions.ts:13) y el pull sobrescribe el valor local no-dirty con el del servidor (workers.ts:315-325).
- **Reproducción:** Estático: ejecutar dos veces el mismo mutation {entity:'daily_summary', op_id:X, payload:{dateKey:'2026-11-05', reviewsCount:10}}: el resultado es 20. Si el cliente envía totales del día (lo natural en una fila dateKey local), cada push los multiplica.
- **Propuesta:** Guardar un registro de op_ids aplicados (tabla applied_ops(user_id, op_id) con insert ... on conflict do nothing y aplicar solo si FOUND), o mejor derivar daily_summary en el servidor desde question_history o usar greatest() con totales absolutos por client_id.

### SQL-10 · Entidades desconocidas o sin rama se aceptan sin escribir nada (profiles perdió su rama)

- **Severidad:** media
- **Ubicación:** `supabase/migrations/20260906162149_update_sync_push_question_history.sql:244`
- **Evidencia:** `else accepted := array_append(accepted, op_id_v::text);` (243-244). La versión original tenía rama 'profiles' y rechazaba 'unknown_entity' (20260616184030:281-292); desde 20260809234100:290-292 cualquier entidad sin rama se da por aceptada. El server fn sigue admitiendo 'profiles' (sync.functions.ts:17) y el cliente borra del outbox todo lo 'accepted' (workers.ts:123-125).
- **Reproducción:** Push de {entity:'profiles', payload:{display_name:'X'}}: la respuesta trae accepted=[op_id], el cliente lo elimina del outbox y no se escribe nada en public.profiles. Igual ocurre con cualquier typo de entidad: pérdida silenciosa.
- **Propuesta:** Restaurar la rama profiles (o quitar 'profiles' del enum zod) y volver a rechazar entidades desconocidas con reason 'unknown_entity'; el cliente puede marcarlas 'dead' sin reintentar.

### SQL-11 · delete_account no es atómico con el borrado de auth.users y no revoca EXECUTE de PUBLIC

- **Severidad:** media
- **Ubicación:** `supabase/migrations/20260809234100_add_srs_sync.sql:62`
- **Evidencia:** delete_account (SECURITY DEFINER, search_path=public, usa auth.uid(): correcto) borra las tablas de la app (62-77) pero no hardcore_exam_progress. src/lib/account.functions.ts:14-23 llama primero al RPC y después a supabaseAdmin.auth.admin.deleteUser; si este falla, la cuenta sigue viva sin datos ni perfil (handle_new_user no se vuelve a ejecutar). La función se creó con `grant execute ... to authenticated` (20260619161538:14) y nunca se hizo `revoke ... from public`, a diferencia de sync_push/pull (20260618063254:1-2), así que anon puede invocarla (falla con 'unauthenticated').
- **Reproducción:** Simular fallo de deleteUser (p.ej. sin service role key en el entorno): el usuario ve un error, pero sus datos del servidor ya están borrados; su IndexedDB conserva los cursores avanzados, así que solo se vuelven a subir las filas que cambien después, y el servidor queda parcial. Estático: leer account.functions.ts:14-23.
- **Propuesta:** Hacer que el servidor borre solo el usuario de auth (las FK ON DELETE CASCADE ya limpian todas las tablas, también hardcore_exam_progress) o invertir el orden; añadir `revoke execute on function public.delete_account() from public, anon`. En el cliente, borrar la BD Dexie del usuario y su outbox tras el éxito.

### SYNC-11 · El pull avanza el cursor aunque fallen las escrituras en Dexie (errores silenciados con .catch(() => {})): esas filas no se vuelven a pedir

- **Severidad:** media
- **Ubicación:** `src/lib/sync/workers.ts:331`
- **Evidencia:** Cada put del pull lleva .catch(() => {}) (workers.ts:267, 279, 307, 325) y después el cursor se guarda sin condiciones (331-333). Un QuotaExceededError, un DatabaseClosedError (p. ej. swap → prev.close() en dbProvider.ts:64-66) o un fallo de normalizeState no impiden avanzar el cursor. El catch del canonical también descarta errores en silencio (192-194).
- **Reproducción:** Con vitest y fake-indexeddb: mockea syncPull con 3 filas de concept_progress y haz que db().concept_progress.put lance en la segunda. Tras runPullOnce, sync_meta.cursor_concept_progress tiene el cursor nuevo y la fila 2 falta. Los siguientes pulls no la devuelven porque su updated_at <= cursor.
- **Propuesta:** Aplicar las filas de cada entidad y el cursor en una sola transacción Dexie rw. Si algo falla, no avanzar el cursor y propagar o registrar el error en useSyncStore.

### DB-05 · swap(uid) se lanza varias veces en paralelo: fusiones duplicadas, outbox duplicado e instancias Dexie abiertas que nunca se cierran

- **Severidad:** media
- **Ubicación:** `src/routes/__root.tsx:187`
- **Evidencia:** En la restauración de sesión se llama `void swap(uid)` (l.181) e inmediatamente otra vez `void swap(uid).then(...)` (l.187). En SIGNED_IN pasa lo mismo (l.197 y l.204). Tras el redirect de OAuth se ejecutan los dos caminos, así que son hasta 4 swaps. swap solo detecta 'ya estoy en esa BD' antes de su await (dbProvider.ts:48) y no actualiza state hasta después de mergeLocalIntoUserDb (dbProvider.ts:56-69). Todas las llamadas ven prev=orbita-local y la BD destino vacía (las comprobaciones de count, l.82-86, se hacen antes de cualquier bulkPut), así que cada una vuelve a copiar y a encolar con op_ids nuevos (l.106-165). Cada swap crea su propio createOrbitaDb(next) (l.52): solo la última queda en state.current y el resto quedan abiertas sin close().
- **Reproducción:** fake-indexeddb: crear orbita-local con 2 concept_progress y setCurrent(local). Ejecutar `await Promise.all([swap('u1'), swap('u1'), swap('u1')])`. Comprobar que getCurrent()?.outbox.count() es 6, no 2. Al hacer push, el servidor rechaza 4 por 'version conflict' y se aplican canonicals innecesarios.
- **Propuesta:** Guardar la promesa en curso por nombre de destino (`if (pending?.name === next) return pending.promise`) y serializar los swaps con un mutex. En __root.tsx, llamar a swap una sola vez y encadenar runMigration a esa misma promesa.

### DB-06 · Nadie se suscribe a onSwap: las vistas con useLiveQuery([]) siguen mostrando la BD anterior (datos del usuario anterior tras un logout en otra pestaña, o progreso vacío al recargar con sesión)

- **Severidad:** media
- **Ubicación:** `src/features/progress/ProgressPage.tsx:19`
- **Evidencia:** onSwap está exportado (dbProvider.ts:168) pero grep no encuentra ningún llamador. ProgressPage usa `useLiveQuery(() => db().concept_progress.toArray(), [])` (l.19-21), y lo mismo ocurre en SessionEnd.tsx:66, ChallengesPage.tsx:70 y SpeedPage.tsx:493. liveQuery solo se vuelve a ejecutar cuando hay mutaciones en las tablas de la BD que observó (las claves llevan el nombre de la BD), así que tras swap no se refresca. En la carga, db() crea orbita-local antes de que __root termine sus imports dinámicos y su swap (__root.tsx:152-181, orbita-db.ts:368-372). Un logout en otra pestaña (Supabase lo transmite y aquí entra en el SIGNED_OUT de __root.tsx:196) cambia la BD sin navegar, así que la página sigue mostrando el progreso de A. Además, una partida en curso en esa pestaña sigue escribiendo, ya en orbita-local, datos que luego se fusionan con quien inicie sesión después.
- **Reproducción:** 1) Pestañas 1 y 2 con la sesión de A, y la pestaña 2 en /progress. 2) Cerrar sesión en la pestaña 1. 3) La pestaña 2 sigue mostrando el progreso de A (useLiveQuery no se vuelve a ejecutar), aunque getCurrent() ya es orbita-local. Variante: recargar /progress con sesión iniciada; si el querier se ejecuta antes del swap, se ve el progreso de invitado o vacío hasta volver a montar la página.
- **Propuesta:** Exponer un hook useActiveDbName() basado en onSwap (con useSyncExternalStore) e incluirlo en las deps de todos los useLiveQuery. Opcionalmente, no renderizar las rutas de datos hasta que la sesión se haya resuelto y el swap inicial haya terminado (una puerta del tipo 'dbReady').

### DB-07 · createOrbitaDb sobrescribe meta.prefs con {} cada vez que se abre una BD (en cada carga y en cada swap)

- **Severidad:** media
- **Ubicación:** `src/lib/db/orbita-db.ts:352`
- **Evidencia:** `d.meta.put({ id: 'meta', schemaVersion: 9, lastOpenedAt: Date.now(), prefs: {} })` es un put, no un merge. setPref y getPref guardan las preferencias en meta.prefs (repo.ts:243-267), y las usan ReviewPage.tsx:246-253, CapitalsPage.tsx:48-51, LocatePage.tsx:52-60 y FlagsPage.tsx:42-49. Todas se pierden en cada recarga y en cada login o logout. Además, setPref recupera schemaVersion con `?? 2` (repo.ts:260).
- **Reproducción:** fake-indexeddb: `await setPref('locate.sub','x')`. Luego createOrbitaDb con el mismo nombre (simula una recarga), esperar al put y comprobar que getPref('locate.sub') es null.
- **Propuesta:** Usar `d.meta.update('meta', {lastOpenedAt, schemaVersion: 9})` y, si no existe, add con prefs:{} (o un hook on('populate')).

### BUG-06 · Due Today ignora la duracion de sesion guardada y no reinicia la sesion al cambiarla

- **Severidad:** media
- **Ubicación:** `src/features/review/ReviewPage.tsx:329`
- **Evidencia:** ReviewPage.tsx:326-329: el efecto de carga solo depende de [continent] (exhaustive-deps desactivado). sessionMode empieza en 'quick' (linea 237) y getPref('review.sessionMode') lo cambia despues (246-249) sin volver a llamar a loadQueue. handleSessionModeChange (251-254) tampoco reinicia la sesion. hasNextBlock (323) se calcula con el sessionMode nuevo sobre la sesion anterior.
- **Reproducción:** 1) En /review elegir 'complete' y recargar: el selector muestra 'complete' pero la sesion tiene 10 tarjetas (BLOCK_SIZE) y al final no se ofrece el siguiente bloque. 2) Cambiar de 'quick' a 'complete' a mitad de sesion: no pasa nada hasta terminar.
- **Propuesta:** Incluir sessionMode en las dependencias del efecto (o llamar a loadQueue desde handleSessionModeChange) y no arrancar hasta que la preferencia haya cargado.

### BUG-07 · localStorage sin try/catch en inicializadores de estado: la pagina de juego entera rompe con el almacenamiento bloqueado

- **Severidad:** media
- **Ubicación:** `src/features/engine/ContinentSelect.tsx:12`
- **Evidencia:** ContinentSelect.tsx:12 `window.localStorage.getItem(STORAGE_KEY)` dentro de loadContinentPref, que se usa en el inicializador de useState de useContinentPref (linea 24), del que dependen Capitals, Flags, Locate y Review. Pasa lo mismo en ExplorerPage.tsx:39/67 y OnboardingOverlay.tsx:12/17/22. Un acceso que lanza SecurityError (cookies o datos del sitio bloqueados) rompe el render. El commit b5de3d0 dice 'guarded storage access', pero estos accesos no estan protegidos.
- **Reproducción:** Firefox con cookies bloqueadas para el sitio (o Safari con 'Block all cookies'): abrir /flags y el render lanza SecurityError al leer window.localStorage, asi que se muestra el error de la ruta en lugar del juego.
- **Propuesta:** Envolver las lecturas y escrituras en try/catch con valor por defecto ('All', 'ESP', onboarding visto=true).

### FSRS-10 · next() sin guarda: doble Next o Next + autoavance salta preguntas y duplica recordSessionEnd

- **Severidad:** baja
- **Ubicación:** `src/features/engine/useSession.ts:586`
- **Evidencia:** next() (586-617) no comprueba answerState ni endedAt. FeedbackBar mantiene el botón Next montado durante la animación de salida (AnimatePresence, FeedbackBar.tsx:27-54) y useAutoAdvance programa otro next() a 1,2 o 2,8 s. Dos llamadas seguidas suben el índice dos veces (la pregunta saltada no se califica, pero desaparece de la sesión). En la última pregunta, recordSessionEnd y el evento orbita:session-end se emiten dos veces.
- **Reproducción:** En /review, tras responder, hacer doble clic rápido en Next: el contador pasa de 3/10 a 5/10. En la última pregunta, el doble clic crea dos registros de sesión. Test: llamar a store.next() dos veces con answerState 'correct' y comprobar index.
- **Propuesta:** Al inicio de next(): `if (s.answerState === 'idle' || s.endedAt !== null) return;`.

### FSRS-12 · Locate 'name' fácil (opción múltiple) y difícil (escritura) comparten tarjeta, y la escritura se evalúa con umbrales de 'easy'

- **Severidad:** baja
- **Ubicación:** `src/features/locate/LocatePage.tsx:131`
- **Evidencia:** handleNameSubmit hace `s.submit(isCorrect)` sin retrievalMode (129-134), tanto para EasyOptions como para HardInput (256-270). Las dos dificultades califican 'X:name:name'. Al escribir se aplican los umbrales sin el multiplicador ×2,5 (assessment.ts:99): escribir 'Kazakhstan' en 12 s sale 'hard', y el reconocimiento en opción múltiple y el recuerdo libre se mezclan en una misma estabilidad. Review además muestra esta tarjeta como 'Which country does this flag belong to?' (ReviewPage.tsx:443-446), otra tarea distinta.
- **Reproducción:** /locate → Name → dificultad Hard: escribir un país en ~13 s; question_history registra mode 'easy' y grade 1 (hard).
- **Propuesta:** Pasar { retrievalMode: 'hard' } en el HardInput y separar los subModes ('name' frente a 'nameType'), igual que Flags con flagToCountry/flagToType. Hacer que Review muestre la tarea por subMode.

### FSRS-13 · Ruido: grade en historial 0-3 frente a Rating 1-4, y comentario de maximum_interval incorrecto

- **Severidad:** baja
- **Ubicación:** `src/features/engine/useSession.ts:505`
- **Evidencia:** history.grade se calcula como again=0…easy=3 (useSession.ts:505, speedRuntimeStore.ts:270), mientras ts-fsrs y el optimizador FSRS usan Rating 1-4 (el rating real va en fsrs_log). adapter.ts:49-50 dice 'Cap at 5 years' con maximum_interval: 36500 (100 años). configureFsrs (adapter.ts:54) no está en uso y descartaría enable_short_term/fuzz/retention propios.
- **Reproducción:** Inspeccionar question_history: grade 2 corresponde a Rating.Good (3).
- **Propuesta:** Guardar el Rating de ts-fsrs (1-4) o documentar el desplazamiento antes de exportar para el optimizador. Corregir el comentario o el valor (1825). Hacer que configureFsrs fusione con los parámetros actuales.

### SQL-12 · challenge_attempts: la restricción única natural no la cubre ON CONFLICT (op_id) y genera un bucle de reintentos hasta 'dead'

- **Severidad:** baja
- **Ubicación:** `supabase/migrations/20260906162149_update_sync_push_question_history.sql:80`
- **Evidencia:** Inserción con `on conflict (op_id) do nothing` (72-80), pero la tabla tiene además `unique (user_id, kind, period_key, question_index)` (20260616184030:111). Un segundo intento de la misma pregunta con otro op_id lanza unique_violation -> rejected sin canonical -> 10 reintentos -> 'dead' (workers.ts:133-150). Hoy está latente: ningún código encola challenge_attempts.
- **Reproducción:** Estático: dos mutations con op_id distinto y el mismo (kind, period_key, question_index) en dos llamadas: la segunda devuelve rejected con 'duplicate key value violates unique constraint'.
- **Propuesta:** `on conflict do nothing` sin objetivo (cubre ambas restricciones) y aceptar el item, o devolver canonical.

### SQL-13 · hardcore_exam_progress: PK de texto global predecible y user_id anulable; un tercero puede ocupar el id de otro usuario

- **Severidad:** baja
- **Ubicación:** `supabase/migrations/20260810110000_add_hardcore_exam_progress.sql:3`
- **Evidencia:** `id TEXT PRIMARY KEY, user_id UUID REFERENCES auth.users(id)` sin NOT NULL (3-4); sin GRANT explícitos (depende de los privilegios por defecto de Supabase) y políticas sin `TO authenticated` (22-36). El cliente usa id = `${userId}_${continent}` (src/lib/hardcore.ts:98, 145) y no comprueba el `error` del upsert (hardcore.ts:145-162).
- **Reproducción:** Un usuario autenticado que conozca el UUID de la víctima inserta {id:'<victimUid>_Europe', user_id: auth.uid() propio,...} (pasa el WITH CHECK). El upsert de la víctima entra en ON CONFLICT (id) DO UPDATE sobre una fila que no puede ver ni actualizar y falla por RLS; como el error no se comprueba, su progreso hardcore deja de guardarse en la nube sin aviso. No hay fuga de lectura.
- **Propuesta:** PK compuesta (user_id, continent) con user_id NOT NULL, upsert con onConflict 'user_id,continent', políticas `to authenticated`, GRANT explícitos y comprobar `error` en el cliente.

### SQL-14 · coalesce(...,0) en fsrs_due y fsrs_last_review convierte payloads inválidos en fechas de 1970 en vez de rechazarlos

- **Severidad:** baja
- **Ubicación:** `supabase/migrations/20260906162149_update_sync_push_question_history.sql:152`
- **Evidencia:** `fsrs_due = to_timestamp(coalesce((payload->>'fsrs_due')::numeric, 0) / 1000.0)` y lo mismo con fsrs_last_review (136, 139, 152, 155); `fsrs_state = payload->>'fsrs_state'` sin CHECK (133, 149). Un fsrs_due null/NaN (JSON.stringify(NaN) = null) se guarda como 1970-01-01 y se propaga a todos los dispositivos por pull.
- **Reproducción:** Push de concept_progress con fsrs_due: NaN desde un Card corrupto: el servidor guarda epoch, el pull devuelve fsrs_due=0 y rowToCard (adapter.ts:120) usa `row.fsrs_due || Date.now()`, así que la tarjeta queda vencida para siempre en el planner; fsrs_last_review=0 elimina last_review (adapter.ts:133).
- **Propuesta:** Rechazar (rejected + canonical) los payloads con fechas nulas o no numéricas, y añadir `CHECK (fsrs_state in ('0','1','2','3'))` y `CHECK (fsrs_due > '2000-01-01')` tras normalizar los datos existentes.

### SYNC-12 · swap(uid) se lanza dos veces en paralelo en SIGNED_IN y al restaurar sesión: doble merge y doble encolado, y una conexión Dexie que nunca se cierra

- **Severidad:** baja
- **Ubicación:** `src/routes/__root.tsx:198`
- **Evidencia:** En onAuthStateChange se llama 'void swap(uid);' y justo después 'void swap(uid).then(() => runMigration(uid!))' (__root.tsx:198, 204). Lo mismo ocurre en getSession (181, 187). swap solo cortocircuita si state.name === next (dbProvider.ts:48), pero state.name no cambia hasta después del await de mergeLocalIntoUserDb (58, 68). Las dos llamadas ven la BD destino vacía, copian dos veces y encolan dos veces con op_ids nuevos (108, 124, 140). Una de las dos instancias de OrbitaDB nunca se cierra.
- **Reproducción:** Con vitest y fake-indexeddb: siembra orbita-local con 5 concept_progress y llama a Promise.all([swap('u1'), swap('u1')]). El outbox de orbita-u1 tiene 10 ops de concept_progress y quedan dos instancias abiertas, lo que bloquearía un Dexie.delete o un upgrade de versión posterior.
- **Propuesta:** Serializar swap con una promesa en curso por nombre (if (pending[next]) return pending[next]) y llamar a swap una sola vez por evento.

### DB-09 · La upgrade v1→v2 cambia la clave primaria de countryProgress, y Dexie 4.4.3 lanza UpgradeError: una BD que siga en v1 no puede abrirse

- **Severidad:** baja
- **Ubicación:** `src/lib/db/orbita-db.ts:196`
- **Evidencia:** En v1 es `countryProgress: 'key, ...'` (l.191) y en v2 es `'iso3, lastSeenAt'` (l.198). En node_modules/dexie/dist/dexie.mjs, getSchemaDiff marca recreate=true cuando cambia primKey.keyPath (l.3922-3927) y runUpgraders lanza `exceptions.Upgrade('Not yet support for changing primary key')` (l.3825-3826) antes del .upgrade(). v1 (ab41614) y v2 (02f3b21) son del mismo día, 16-jun, así que probablemente ningún usuario real tiene v1: es un riesgo residual.
- **Reproducción:** fake-indexeddb: abrir `new Dexie('t').version(1).stores({countryProgress:'key, iso3'})` y añadir una fila. Cerrar y abrir `new OrbitaDB('t')`; open() rechaza con UpgradeError y la app no puede usar ninguna tabla.
- **Propuesta:** Si se quiere conservar la compatibilidad: v2 declara `countryProgress: null` y crea una tabla nueva (p. ej. countryProgress2) copiando los datos en el upgrade; o bien documentar que v1 no tiene soporte y eliminar el bloque.

### DB-10 · Al borrar la cuenta, la BD local orbita-<uid> (progreso, historial y outbox) se queda en el dispositivo

- **Severidad:** baja
- **Ubicación:** `src/routes/_authenticated/account.tsx:58`
- **Evidencia:** handleDelete hace deleteAccount() y signOut(), y luego swap(null) (l.52-58). Nunca llama a Dexie.delete(`orbita-${uid}`). swap solo hace prev.close() (dbProvider.ts:64-66). Los datos de un usuario eliminado siguen legibles en IndexedDB en ese navegador, que puede ser compartido.
- **Reproducción:** Borrar la cuenta y abrir DevTools > Application > IndexedDB: orbita-<uid> sigue ahí con concept_progress y question_history.
- **Propuesta:** Después de swap(null), ejecutar `await Dexie.delete('orbita-'+uid)` (cerrando antes todas las instancias abiertas, ver DB-05).

### BUG-08 · Review (SSR activo) lee localStorage en el render inicial: desajuste de hidratacion del continente

- **Severidad:** baja
- **Ubicación:** `src/routes/review.tsx:4`
- **Evidencia:** /review, /locate y /spain no declaran `ssr: false` (review.tsx:4, locate.tsx:4, spain.tsx:9), a diferencia de capitals/flags/find/name. ReviewPage.tsx:236 y LocatePage.tsx:47 usan useContinentPref, que en el servidor devuelve 'All' (ContinentSelect.tsx:11) y en el cliente el valor guardado. El HTML del selector y el contador (filteredCount) no coinciden en la hidratacion.
- **Reproducción:** Guardar orbita.continentPref='Europe', cargar /review en frio: React avisa de un hydration mismatch y los atributos y clases del boton seleccionado pueden quedarse como en el HTML del servidor.
- **Propuesta:** Marcar estas rutas como ssr:false (son 100% IndexedDB) o leer la preferencia en un useEffect tras montar.

### BUG-09 · HardcoreRunner: el boton Skip en estado 'wrong' no hace nada y las respuestas reveladas no se guardan en answers

- **Severidad:** baja
- **Ubicación:** `src/features/challenges/HardcoreRunner.tsx:257`
- **Evidencia:** HardcoreRunner.tsx:257 pasa `onSkip={answerState === 'wrong' ? revealAnswer : undefined}`, pero revealAnswer (85-95) solo actua si answerState==='idle', asi que el boton no hace nada. Ademas, revealAnswer incrementa wrong sin escribir answers[currentIndex], y missedItems (122-134) solo cuenta 'wrong', por lo que los saltados con Space no aparecen en el resumen aunque si sumen en wrong.
- **Reproducción:** En el examen Hardcore, fallar una pregunta y pulsar 'Skip': no ocurre nada. Saltar otra con Space: al final wrong=N pero la lista de fallos tiene N-1.
- **Propuesta:** Ocultar Skip en estado wrong o hacer que avance. En revealAnswer, registrar answers[currentIndex]='wrong' (o 'revealed') e incluirlo en missedItems.

## Resúmenes de los auditores

---

## Auditor: fsrs

## Alcance revisado
- `src/lib/fsrs/*`: adapter, planner, assessment, concept, migration y sus tests (52 tests en verde con `npx vitest run src/lib/fsrs`).
- `src/features/engine/useSession.ts` y `useAutoAdvance.ts`.
- Modos de juego: Capitals, Flags, Locate, Review, Spain y Speed (`speedRuntimeStore`, `SpeedPage`, `lib/mastery.selectMixedQuestions`).
- `progressRepo.recordConceptAttempt`, el pull de `concept_progress` en `sync/workers.ts`, el esquema `sync_push`/`sync_pull` (fechas en ms mediante `to_timestamp`/`extract(epoch)`) y las migraciones v8/v9 de Dexie.
- Comprobé la API real de ts-fsrs 5.4.1 con scripts node en el scratchpad (fuera del repo):
  - pasos por defecto `['1m','10m']` y `['10m']`;
  - transiciones New→Again/Hard/Good/Easy;
  - excepciones "Invalid memory state" con difficulty 0 o stability 0;
  - el ida y vuelta Card→fila→Card.

## Hallazgos principales
1. **`learning_steps` no se persiste (FSRS-1).** Con ts-fsrs 5, una tarjeta en Learning que se recarga desde Dexie vuelve siempre al paso 0. Si se responde Good, se queda en Learning a +10 min para siempre. Solo 'easy' la gradúa. Rompe el SRS central y la maestría (la retrievability de Learning está limitada a 0,45).
2. **La práctica rápida se queda sin cartas y en blanco (FSRS-2).** Cuando el pool del submodo llega a 10 filas, no se crean más conceptos nuevos. Si ninguna fila está vencida, la cola sale vacía y la página queda en blanco sin la barra de herramientas.
3. **Desalineación entre `queue` y `conceptQueue` (FSRS-3).** Pasa cuando un concepto no se resuelve en el dataset; en España, las provincias y las CCAA comparten dominio y skill. Resultado: se califica la tarjeta de otra entidad, lo que corrompe el progreso.
4. **Review de capToCountry es trivial (FSRS-4).** El enunciado muestra la capital y las opciones también son capitales.
5. **ConceptIds antiguos de 2 partes (FSRS-5).** Se renombraron solo en local (v9). Al hacer pull en una BD nueva, el mismo hecho queda con dos tarjetas.

## Hipótesis refutadas
- **Fechas Date/string/ms:** son correctas. Dexie guarda ms. `sync_push` hace `to_timestamp(ms/1000)` y `sync_pull` devuelve `extract(epoch)*1000`. `rowToCard` reconstruye `Date`. `fsrs_log` serializa `due` a ISO solo como auditoría. Un Card serializado a JSON también funciona en ts-fsrs.
- **Mapeo de Rating y State:** correcto (`outcomeToGrade` 1-4). `normalizeState` cubre números, strings numéricas de la columna TEXT y estados heredados ('review'…).
- **Doble calificación por doble clic o StrictMode en useSession:** no ocurre. `submit` comprueba `answerState !== 'idle'` de forma síncrona con zustand, y `fsrsUpdatedIds` evita volver a calificar los reintentos reencolados. En StrictMode, los `start()` dobles solo recargan la cola y no califican. Los distractores no se califican en ningún modo: solo el objetivo, en opción múltiple y en el globo. HardInput no puede enviar dos veces (Enter tras exactMatch queda bloqueado por `isAnswered`).
- **Mezcla de dominios world/spain con filtro de continente:** no hay fuga. Las filas de España tienen iso3 = 'ES-xx', que no coincide con ningún país.
- **Dirección:** capital countryToCap, capToCountry y locator, y flag flagToCountry y flagToType, son tarjetas independientes y bien separadas. Las excepciones están en FSRS-7 y FSRS-12.
- **Día local frente a UTC:** no hay lógica de día. "Due Today" equivale a `fsrs_due <= now`, y el contador y la cola usan el mismo predicado (`isDue`), así que no divergen. Tampoco hay cupo diario de nuevas; solo `maxNewPerSession`, y en la práctica también está roto (FSRS-2).

## Lo que está bien diseñado
- El adaptador es el único punto de entrada a ts-fsrs.
- Hay separación limpia entre evaluación (assess), transición (processReview) y planificación.
- `isDue` es la fuente única de verdad.
- La escritura es atómica: transacción Dexie que actualiza progreso, historial y outbox, con op_id UUID.
- El reencolado en sesión está limitado por `relearning_steps.length`.
- El planner ordena las tarjetas por prioridad (Relearning > Learning > Review vencidas > New) y evita que el mismo país salga dos veces seguidas.

## Recomendaciones de diseño
- Persistir el Card de ts-fsrs completo (incluido `learning_steps`) y probar el ida y vuelta fila↔Card en los tests.
- Construir `q` y `cq` como pares en una sola estructura, con un assert de que coincide el entityId.
- Separar en el planner las tarjetas vencidas del cupo de nuevas, introduciendo nuevas desde el dataset con un límite diario por día local (Europe/Madrid).
- Centralizar en `concept.ts` una tabla única de prompt/subMode→conceptId→renderizado, compartida por los juegos, Review y Speed.
- Leer la fila fresca dentro de la transacción antes de calcular la transición. Hoy `useSession` usa una instantánea tomada al iniciar la sesión; si entra un pull más nuevo, la escritura local lo pisa y el servidor la rechaza por conflicto de versión.
- Hacer `rowToCard` tolerante a memoria inválida y poner try/catch alrededor de `processReview`.
- Revisar si se quiere dar Easy en opción múltiple y si Speed y Complete deben calificar con FSRS repasos no vencidos y con presión de tiempo.

No modifiqué ningún archivo del repo. Los scripts de comprobación están en C:\Users\carla\AppData\Local\Temp\claude\873f06ab2d71db8c\10017b33-6a4a-475c-9842-1d2767c23cde\scratchpad\t\ (p.mjs, q.mjs, r.mjs).

---

## Auditor: sql

## Alcance
Leí las 10 migraciones de `supabase/migrations` en orden y reconstruí el estado final efectivo:
- **sync_push**: el que cuenta es el de `20260906162149` (sustituye al de 20260810000000 y al de 20260809234100).
- **sync_pull**: el de `20260809234100:308-404`; no se redefine después.
- **delete_account**: el de `20260809234100:62-77`.
- **Grants**: los de `20260618063158`, `20260618063218` y `20260618063254`.
- **hardcore_exam_progress**: definida en `20260810110000`.

Lo crucé con el cliente: `src/lib/sync/workers.ts`, `src/lib/sync/sync.functions.ts`, `src/lib/sync/queue.ts`, `src/lib/db/repo.ts`, `src/lib/db/progressRepo.ts`, `src/lib/db/dbProvider.ts`, `src/lib/auth/migrateGuestProgress.ts`, `src/lib/fsrs/adapter.ts`, `src/lib/hardcore.ts` y `src/lib/account.functions.ts`. No ejecuté nada contra ninguna base de datos ni contra la red, y no modifiqué ningún archivo.

## Hallazgo principal
**SQL-1 (crítico).** Desde la migración de agosto, sync_push castea `last_seen_at` a numeric (milisegundos), pero el cliente envía un string ISO. Por eso **todos** los push de country_progress fallan, se reintentan 10 veces y acaban en `dead`. El progreso por país no llega a Supabase desde entonces.

## Hipótesis refutadas o en buen estado
- **RLS**: está activado en todas las tablas. Las políticas comparan `auth.uid()` con `user_id` (o con `id` en profiles), y sessions_log y challenge_attempts no tienen políticas de UPDATE ni DELETE.
- **sync_push y sync_pull**: son SECURITY INVOKER con `SET search_path = public`. Usan siempre `auth.uid()` y nunca un user_id del payload, y el pull filtra por uid en todas las ramas. No encontré fuga entre usuarios.
- **Funciones SECURITY DEFINER** (has_role, handle_new_user, delete_account): todas tienen `search_path`. has_role y handle_new_user tienen EXECUTE revocado a anon, authenticated y PUBLIC, y sync_* tienen EXECUTE revocado a anon y PUBLIC. La única carencia menor es delete_account (SQL-11).
- **Índices de pull**: existe `(user_id, updated_at desc)` para todas las tablas que se descargan.
- **Normalización de fsrs_state**: la columna es text y guarda el número como string ("2"). `normalizeState` (adapter.ts:141-166) maneja tanto el string numérico como el formato antiguo ('review'). La normalización es correcta.
- **Idempotencia por op_id**: es correcta en sessions_log, challenge_attempts y question_history (`ON CONFLICT (op_id) DO NOTHING`, op_id único o PK). En concept_progress, un reintento tras perder la respuesta acaba en "version conflict" con canonical idéntico, así que se repara solo.
- **Transaccionalidad**: cada mutación va en un subbloque con su propio savepoint, de modo que un fallo no deja escrituras a medias. La excepción es el cast de op_id, que está fuera del subbloque (SQL-2).
- **Bucle de conflicto de versión**: ya no se produce. El cliente borra el item cuando recibe un rechazo con canonical (workers.ts:127-133). El riesgo actual es otro: perder repasos (SQL-6).

## Observaciones fuera del alcance SQL, para otros revisores
- `migrateGuestProgress.ts` copia filas con `dirty=1` pero no encola nada en el outbox, y `handleSignedInSync` solo hace push del outbox. Lo fusionado del invitado no se sube hasta el siguiente repaso de cada concepto. Además, `dbProvider.ts:106-165` sí encola, pero con otra lógica: hay dos caminos de fusión divergentes.
- Al hacer pull de country_progress, el cliente sobrescribe la fila local sin comparar `skill_versions` (workers.ts:255-267). El pull se ejecuta antes que el push al arrancar.
- daily_streak siempre envía `count: 1` y el servidor aplica `greatest`, así que la columna no aporta información.

## Recomendaciones de diseño
1. **Contrato de tipos.** Un único formato de fecha en el wire (ms numéricos o ISO) y tests de contrato que generen payloads con las funciones reales del cliente y los validen contra un parser equivalente a los casts SQL. Si es posible, un test con PGlite o Postgres local que cargue las migraciones.
2. **Validación y aislamiento por item.** Validar op_id con `z.string().uuid()` y mover todos los casts dentro del bloque EXCEPTION, para que un item malo nunca envenene un lote.
3. **Cursores de pull.** Usar un cursor compuesto `(updated_at, pk)` o una secuencia monotónica por fila, en lugar de `updated_at > cursor` con LIMIT, y paginar en bucle hasta agotar.
4. **Concurrencia y versionado.** El servidor debería asignar la versión, con UPDATE condicional (`where version < x`) o `FOR UPDATE`, y desempatar por `fsrs_last_review`, sin comparar contadores locales de dispositivos distintos.
5. **Rechazar lo desconocido.** Entidades desconocidas como `rejected`, no como `accepted`. Para sumas no idempotentes (daily_summary), registrar los op_id ya aplicados o derivar el resumen en el servidor.
6. **Completar el esquema FSRS.** Añadir `fsrs_elapsed_days`, `fsrs_scheduled_days` y `learning_steps`, e incluir question_history en el pull.

---

## Auditor: sync

## Alcance revisado
- `src/lib/sync/*`: workers, queue, clientId, sync.functions, types, useSyncStore.
- `src/features/sync/*`: SyncPill y AccountMenu (sign-out).
- `src/lib/db/dbProvider.ts`, `orbita-db.ts`, `progressRepo.ts`, `repo.ts`.
- `src/lib/auth/migrateGuestProgress.ts` y el cableado de auth en `src/routes/__root.tsx`.
- Las funciones SQL efectivas:
  - `sync_push`: versión final en `20260906162149_update_sync_push_question_history.sql`.
  - `sync_pull`: versión final en `20260809234100_add_srs_sync.sql`, ya que ninguna migración posterior la reemplaza.

No he ejecutado tests, no he tocado archivos y no me he conectado a ningún servicio. `fake-indexeddb` no está en `node_modules`, así que reproducir los hallazgos de IndexedDB con vitest exigiría añadirlo.

## Hallazgos principales (resumen)
1. **SYNC-01.** La recuperación de `in_flight` y la purga de los op_id `:cp` se ejecutan sobre `orbita-local`, no sobre la BD del usuario. El arreglo de septiembre no funciona en un arranque con sesión ya iniciada.
2. **SYNC-02.** Regresión de contrato SQL: `last_seen_at::numeric` frente al ISO string que envía el cliente. Ningún `country_progress` se sincroniza desde agosto.
3. **SYNC-03.** El pull de `country_progress` pisa las filas locales. Combinado con SYNC-02, 'Force full resync' hace retroceder el progreso.
4. **SYNC-04.** Unos 5 minutos de red mala mandan todo a dead-letter en silencio, y 'Clear dead letter' lo borra.
5. **SYNC-05.** Cerrar sesión o cambiar de usuario con un pull o push en vuelo escribe los datos de A en la BD invitada, y de ahí pasan a la cuenta de B.
6. **SYNC-06.** LWW por contador `version`: el pull o el canonical descartan una revisión local aún no subida.
7. **SYNC-07.** El cursor `>` con LIMIT y empates pierde filas.
8. **SYNC-08.** La fusión de invitado no encola nada si la BD de usuario ya tenía datos.

## Hipótesis refutadas
- **SSR ejecutando IndexedDB:** refutada. `db()` lanza fuera del navegador (orbita-db.ts:540), `enqueue` sale si no hay `window` (queue.ts:41), los workers arrancan en `useEffect` y `getClientId` devuelve 'ssr' sin tocar `localStorage`.
- **op_id no deterministas o no UUID en el código actual:** refutada. `concept_progress` usa `crypto.randomUUID()` (progressRepo.ts:91), `question_history` reutiliza el op_id de la fila y el fallback de clientId genera v4 válidos. El único riesgo son los ops heredados que no se purgan (SYNC-01/09). Los `:v9` de la migración Dexie v9 solo existen en filas locales de `question_history` y no se encolan.
- **Backoff que martillea:** refutada. Está acotado a 60 s y `forceSync` lo reinicia. El problema real es el contrario: lo que ocurre al agotarse los intentos (SYNC-04).
- **LWW con relojes del cliente:** no aplica a concept_progress ni a country_progress, que usan contadores de versión, y `updated_at` lo pone el servidor con `now()`. Solo `daily_streak` usa `greatest(last_active_at)` con la hora del cliente, y el impacto es menor.
- **Reintento tras respuesta perdida:** mayormente idempotente. sessions_log, challenge_attempts y question_history usan `on conflict (op_id) do nothing`, unlocks usa greatest, y concept_progress devuelve 'version conflict' con canonical igual al propio estado. `daily_summary` es aditivo en el servidor y duplicaría en un reintento, pero hoy no se encola en ningún sitio.
- **Dos pestañas:** no hay Web Locks ni BroadcastChannel, así que ambas pueden enviar los mismos items. Con la idempotencia anterior el efecto es benigno (rechazos por versión con canonical igual). Lo incluyo en las recomendaciones, no como hallazgo.

## Recomendaciones de diseño
- **Contexto de BD por ciclo de sync:** capturar `db` y `uid` al empezar y abortar tras cada `await` si cambiaron. Usar `navigator.locks.request('orbita-sync-'+uid)` para tener un único sincronizador por usuario entre pestañas.
- **Outbox con lease en lugar de `in_flight` persistente.** Separar los errores de transporte y autenticación, que no consumen intentos, de los rechazos deterministas. Mostrar los dead en la UI y no borrarlos sin confirmación.
- **El pull no debe pisar filas `dirty` ni claves con ops pendientes.** Para FSRS, resolver conflictos reproduciendo `question_history` o con el mayor `fsrs_last_review`, no con un contador de versión.
- **Cursor compuesto `(updated_at, pk)`** o secuencia de cambios, con paginación hasta vaciar.
- **Tests de contrato** que validen los payloads del cliente contra los casts SQL de `sync_push`. Habrían detectado SYNC-02.
- **Unificar la fusión de invitado** (`mergeLocalIntoUserDb` y `migrateGuestProgress`) en una sola ruta transaccional que encole todo, con `swap` serializado.

---

## Auditor: db

## Alcance revisado
- **Base de datos local (Dexie):** `src/lib/db/orbita-db.ts` (versiones v1 a v9 y sus upgrades), `dbProvider.ts` (swap y mergeLocalIntoUserDb), `repo.ts` y `progressRepo.ts`.
- **Autenticación:** `src/lib/auth/migrateGuestProgress.ts` y `profile.ts`.
- **Cliente Supabase:** `src/integrations/supabase/*` (client, client.server, auth-attacher, auth-middleware).
- **Contexto necesario fuera del alcance:** quién llama a swap y a la migración (`src/routes/__root.tsx`, `AccountMenu.tsx`, `account.tsx`), los workers de sync (`workers.ts`, `queue.ts`), el RPC final `sync_push` (`supabase/migrations/20260906162149_*`) y el código de Dexie 4.4.3 en node_modules.
- **Sin ejecutar:** no he ejecutado ni tests ni tsc. `fake-indexeddb` no está instalado, así que los tests propuestos necesitan añadirlo como devDependency.

## Causa raíz principal
No hay un ciclo de vida coordinado de la BD:
- `db()` devuelve siempre la instancia activa en ese momento.
- Los workers de push y pull vuelven a llamar a `db()` después de cada `await` de red.
- `swap()` no está serializado y no detiene ni espera a los workers.
- Nadie escucha `onSwap`.

De ahí salen DB-01 (crítico: fuga entre usuarios por un pull en curso durante el logout), DB-02, DB-05 y DB-06.

La fusión de invitado tiene dos caminos que se solapan:
1. `mergeLocalIntoUserDb`: encola en el outbox, pero solo actúa si la BD del usuario está vacía.
2. `migrateGuestProgress`: no encola nada, traga los errores y borra la BD de invitado igualmente.

De ahí salen DB-03 y DB-04.

## Hipótesis refutadas
- **Clave de servidor en el navegador:** refutada. `client.ts` solo usa `VITE_SUPABASE_PUBLISHABLE_KEY`. `client.server.ts` (service role) lee solo `process.env` y únicamente se importa de forma dinámica dentro del handler de `src/lib/account.functions.ts:17`. `auth-middleware` valida el token con `getUser`.
- **IndexedDB en SSR:** no encontrado. `db()` lanza un error si no hay `window` (`orbita-db.ts:365`). `repo.ts` comprueba `isBrowser()`. `enqueue` y `getClientId` también están protegidos. Los `useLiveQuery` y los efectos solo se ejecutan en el cliente.
- **versionchange/blocked sin manejar:** Dexie 4.4.3 registra por defecto un `on('versionchange')` que cierra la conexión con `disableAutoOpen:false` (dexie.mjs:5943-5950), así que una pestaña antigua no bloquea indefinidamente una upgrade ni el `Dexie.delete('orbita-local')`. No he confirmado si una pestaña con código antiguo puede reabrir la BD tras la upgrade, por eso no lo incluyo como hallazgo.
- **Upgrades v8 y v9:** transforman bien los datos locales (estado de texto a número; ids de 2 a 3 partes, borrando los antiguos). El problema es que el servidor no se migró (DB-08).
- **Doble fusión entre logins:** limitada porque se borra `orbita-local` y existe `migratedRef`. El riesgo real es la fusión de datos ajenos (DB-01, DB-06) y la pérdida si falla a medias (DB-03).
- **Escaneos de tablas completas:** `purgeBrokenOpIds` hace un filter sobre todo el outbox, pero solo al arrancar. Las consultas del outbox usan el índice `status`. `reEvaluateUnlocks` y varios `useLiveQuery` leen gameSessions entero, lo que crece sin límite (rendimiento, severidad baja, no lo incluyo). El índice `dirty` está declarado pero no se usa.

## Recomendaciones de diseño
1. **Gestor de sesión de BD único y serializado:** `swap` con mutex y deduplicación, que pare los workers, espere a que terminen las ejecuciones en curso, cambie la BD, notifique con `onSwap` y vuelva a arrancar los workers ligados a esa instancia.
2. **Workers ligados a una instancia:** capturar la instancia al principio de cada ejecución y comprobar `getCurrent() === d` después de cada await. Borrar en el outbox por `op_id`, no por id autoincremental.
3. **Un solo camino de fusión de invitado:** una transacción Dexie que escriba los datos y el outbox a la vez, con versiones subidas para que gane el servidor, y borrar `orbita-local` solo después del commit.
4. **Pull de `country_progress`:** que respete `dirty` o `skill_versions`.
5. **Refresco de vistas tras un swap:** un hook `useActiveDbName` en las deps de todos los `useLiveQuery`.
6. **Arreglar `createOrbitaDb`:** que no pise `meta.prefs`.

---

## Auditor: bugs

## Recuento real (ejecutado en C:\Users\carla\Desktop\Projects\world-orbita)
- **tsc --noEmit**: exit 0, 0 errores.
- **eslint .**: `24710 problems (24687 errors, 23 warnings)`, 24658 corregibles con --fix. Casi todo es `prettier/prettier "Delete ␍"`, es decir, finales de linea CRLF del checkout en Windows: es ruido, aunque contradice el commit 0e46a59 'lint to zero'. Sin la regla de prettier y solo sobre src, `npx eslint src --rule "prettier/prettier: off"` da **51 problemas (28 errores, 23 warnings)**:
  - **7 react-hooks/rules-of-hooks en ChallengesPage.tsx (433-495): bug real, BUG-03.**
  - 19 @typescript-eslint/no-explicit-any (useSession 7, orbita-db 5, hardcore 4, ReviewPage 2, migration 1): ruido o deuda.
  - 2 no-empty en hardcore.ts:172/180: catch vacios en clearHardcoreProgress, que solo esconden fallos de borrado.
  - 23 warnings: exhaustive-deps (Globe3D, SpainPage:196, memos de 'sessions') y react-refresh. No encontre ninguno que cause doble envio.
- **vitest run**: 4 ficheros, **94/94 tests pasan**. Ruido: `ReferenceError: module is not defined at node_modules/react/index.js` (vite.config carga los plugins nitro/tanstackStart en los tests) y `close timed out after 10000ms`, porque el proceso se queda colgado tras los tests. No hay tests de useSession, de los modos de juego ni de ChallengesPage: por eso no se detectan BUG-01..04.

## Metodo
Lei useSession, useAutoAdvance, los hooks de teclado, Capitals/Flags/Locate/Spain/Review/Challenges/HardcoreRunner/Speed, la ruta _authenticated, streak.ts y repo.recordSessionEnd. Reproduje BUG-01, BUG-02 y BUG-04 con vitest usando una config y tests en el scratchpad (C:\Users\carla\AppData\Local\Temp\claude\873f06ab2d71db8c\10017b33-6a4a-475c-9842-1d2767c23cde\scratchpad\t\), con mocks de db/progressRepo/repo/audio, sin tocar el repo. Salidas: `REPRO1 queue 7 conceptQueue 10 / item0 ES-AL concept0 spain:ES-AN:location:find / written ['spain:ES-AN:location:find']`, `REPRO2 queue 0 conceptQueue 10`, `STARVE queue 0`, `RACE subModes ['countryToCap']`. No ejecute git (la sesion esta aislada en otro worktree) ni nada contra Supabase.

## Hipotesis refutadas
- **Fechas en UTC para rachas/'hoy'**: refutada. dateKey usa getFullYear/getMonth/getDate locales (src/lib/streak.ts:3-9). weekKey usa UTC sobre la fecha local ya truncada, lo cual es correcto. No hay `toISOString().split('T')` en el codigo de producto; los toISOString son timestamps para el payload de sync.
- **Temporizadores sin limpiar**: useAutoAdvance limpia su timeout. Speed centraliza los timers en clearAllTimers y usa un token de generacion. useDueTodayCount limpia su interval.
- **Doble next() o doble envio por el boton Next**: todas las FeedbackBar de modos con auto-advance pasan `hideNext`. submit() se protege con answerState !== 'idle'. next() no tiene guarda (con endedAt fijado, una segunda llamada registraria otra sesion), pero solo encontre un disparador manual: el 'Skip' de capitales sin capital (CapitalsPage:198), de impacto bajo. No lo incluyo como hallazgo.
- **topUpQueue de Speed con continent 'All'**: refutada, selectMixedQuestions normaliza 'All' (mastery.ts:120).
- **_authenticated accesible sin sesion**: refutada. ssr:false y beforeLoad con supabase.auth.getUser() redirige a /auth. Efecto secundario: sin conexion, un usuario con sesion valida tambien es redirigido.
- **Colision de IDs Espana/mundo y CCAA/provincia**: refutada (0 duplicados verificados). El problema real es el pool compartido (BUG-02), no los IDs.
- **SSR del store global de zustand**: start() solo se llama en efectos, asi que el servidor no comparte estado de sesion entre peticiones.

## Recomendaciones de diseno
1. useSession deberia trabajar con una sola lista de pares {item, concept} en lugar de dos arrays paralelos. Hay que garantizar la invariante queue.length === conceptQueue.length con un assert y un test.
2. Cada start() asincrono necesita un token de generacion (como speedRuntimeStore).
3. Sembrar conceptos nuevos por huecos libres en la sesion y no por el tamano del pool, filtrando siempre por las entidades del dataset activo y no solo por el prefijo de dominio.
4. Todas las paginas deben tener un estado vacio con controles cuando queue=[] y !loading.
5. Anadir tests de vitest para createSessionStore (las reproducciones del scratchpad sirven de base) y para ChallengeRunner. Activar rules-of-hooks como error que bloquee la build. Fijar `endOfLine: auto` o .gitattributes para que el lint vuelva a ser util en Windows.
