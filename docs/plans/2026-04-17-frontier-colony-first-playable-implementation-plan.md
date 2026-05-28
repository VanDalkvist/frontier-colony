# Frontier Colony — план имплементации до first playable

Дата: 2026-04-17

## Назначение документа

Этот документ фиксирует детальный план доведения `Frontier Colony` до состояния `first playable`.

Под `first playable` здесь понимается не "почти игра" и не "архитектурный прототип", а состояние, в котором можно:

- открыть проект локально;
- начать новую карту;
- поставить первые здания руками;
- увидеть, как ресурсы действительно меняются от действий игрока;
- дожить до простого win state или проиграть по понятному fail state.

Документ специально не планирует `v1`, контентную глубину, долгий midgame или сложную симуляцию агентов. Его задача — довести текущий scaffold до честной играбельной вертикальной дольки.

## Текущий baseline

В проекте уже есть:

- отдельный проект и стек `React + Phaser + TypeScript`;
- world generation и terrain-derived yields;
- стартовый colony state;
- tick-based simulation;
- Phaser preview playfield;
- DOM HUD shell;
- product/design doc.

Текущий статус проекта: **design-first scaffold**, не `first playable`.

Главный недостающий кусок: у игрока пока нет содержательного input loop. Он не может выбрать клетку, войти в build mode, поставить здание, дождаться постройки и пережить win/lose цикл.

## Целевой first playable

После завершения плана проект должен поддерживать следующий сценарий:

1. Игрок открывает игру и нажимает `New world`.
2. На карте уже есть стартовый `Camp` или игрок подтверждает стартовую точку.
3. Игрок может выбрать режим строительства.
4. Игрок может поставить как минимум:
   - `Lumber Camp`
   - `Forager Hut`
   - `Quarry`
5. Размещение валидируется по terrain rules.
6. Постройка требует ресурсов и времени.
7. После завершения постройки меняется production loop.
8. HUD показывает изменение `wood`, `food`, `stone`, `ore`.
9. При нехватке еды/ресурсов срабатывают alerts.
10. Есть один fail state и один simple win state.

Если эти 10 пунктов выполняются, проект можно считать `first playable`.

## Scope freeze

До достижения `first playable` запрещено добавлять:

- индивидуальных колонистов;
- pathfinding;
- боёвку;
- торговлю;
- сезоны;
- сложное дерево технологий;
- полноценные цепочки переработки;
- процедурные события beyond minimal alerts;
- сохранения поверх незавершённого core loop.

Причина простая: это не усиливает доказательство core loop, а только увеличивает площадь незавершённости.

## Архитектурные паттерны

Ниже перечислены архитектурные правила, которые должны считаться обязательными для этого плана. Они опираются на baseline-логику `project-tracker` и на `tasks/_policies/arch-patterns.md` как canonical policy family, даже если сам репозиторий ещё не bootstrapped этим skill.

### AP-010 / AP-020 — модульный монолит + Ports & Adapters + composition root

Для этого проекта правило читается так:

- `src/game/simulation` — source of truth для правил игры;
- `src/game/world` — источник генерации мира и terrain metadata;
- `src/game/render` — Phaser adapter, который читает state и рисует сцену;
- `src/App.tsx` — UI composition root и DOM shell;
- React не владеет gameplay logic;
- Phaser не владеет gameplay logic.

Практическое следствие:

- build placement rules не должны жить в Phaser scene callbacks;
- расчёт production/upkeep/win/fail не должен жить в React component state;
- renderer получает уже рассчитанный state и рисует его.

### AP-011 / AP-018 — низкая связность, высокая когезия, одна ответственность

Каждый файл должен иметь одну роль:

- `tick.ts` — только advancement simulation;
- `generateWorld.ts` — только генерация и terrain metadata;
- `gameBoot.ts` — только mounting/render plumbing;
- `App.tsx` — только orchestration HUD + commands + wiring.

Запрещено превращать `App.tsx` в смесь:

- симуляции,
- build validation,
- расчёта экономики,
- Phaser mutations.

### AP-019 — лимиты размера и смысловое дробление

Для этого проекта правило нужно применять жёстко уже на этапе `first playable`.

Если при добавлении механики файл начинает нести две ответственности, его надо дробить сразу, а не "после MVP".

Ожидаемое дробление по мере работы:

- `simulation/buildPlacement.ts`
- `simulation/buildCommands.ts`
- `simulation/winLose.ts`
- `render/selectionOverlay.ts`
- `render/inputBridge.ts`
- `ui/buildPanel/*`
- `ui/statusPanel/*`

### AP-021 — thin entry points

Entry points должны оставаться тонкими:

- React event handlers -> command function;
- Phaser pointer handlers -> input translation -> command function;
- никаких прямых мутаций глобального state внутри UI callback.

Пример правильного направления:

- pointer click -> `selectTile(x, y)`
- build confirm -> `placeBuilding(kind, tile)`
- game tick -> `tickGame(state, delta)`

Пример неправильного направления:

- pointer click -> mutate stockpile/buildings directly in scene

### AP-025 — дисциплина импортов

Разрешённый граф зависимостей:

- `ui` может импортировать `simulation`, `world`, `types`
- `render` может импортировать `types`
- `simulation` может импортировать `world`, `types`
- `world` может импортировать `types`
- `types` не импортирует ничего

Запрещено:

- `world -> render`
- `simulation -> render`
- `simulation -> App`
- циклические импорты между `ui`, `render`, `simulation`

### AP-028 / AP-056 / AP-057 — детерминизм и тестируемость

Хотя formal testing policy в baseline помечена как более поздний stage, для игры это нужно начать раньше.

Правило:

- world generation детерминируется `seed`;
- build validation и win/lose logic пишутся как pure functions;
- simulation tick должен тестироваться без Phaser и без React;
- smoke-play loop должен быть воспроизводим одним сценарием.

### AP-051 / AP-052 — frontend boundaries

Адаптация этих правил к игре:

- UI state != simulation state != renderer state;
- DOM HUD остаётся текстовым и операционным;
- Phaser canvas остаётся playfield;
- selection/build mode могут отражаться в UI, но authoritative result placement живёт в simulation command layer.

Это защитит проект от типичной деградации browser game, когда всё начинает жить "где придётся".

## Обязательные skills по этапам

Ниже перечислены skills, которые нужно использовать при выполнении плана.

### Всю дорогу

- `brainstorming`
  - использовать перед любым расширением scope или изменением core loop;
  - не добавлять систему без явного ответа, зачем она нужна `first playable`.

- `project-tracker`
  - использовать как источник process/architecture baseline;
  - если позже проект будет bootstrapped, этот план должен легко разложиться на feature/task artifacts.

### Этап выбора и удержания архитектуры

- `game-studio:game-studio`
  - держать продуктовую рамку и не дать проекту уйти в неправильный жанровый scope.

- `game-studio:web-game-foundations`
  - использовать для всех решений по simulation/render/UI boundaries;
  - использовать перед добавлением placement loop, command model, input bridge, save boundary.

### Этап реализации игрового runtime

- `game-studio:phaser-2d-game`
  - использовать для карты, pointer handling, selection, overlays, camera и playfield behavior.

- `game-studio:game-ui-frontend`
  - использовать для build panel, alerts, HUD hierarchy, modal/overlay states.

### Этап верификации

- `game-studio:game-playtest`
  - использовать сразу после появления first playable loop;
  - цель: smoke test + UX failures + dead actions.

- `playwright`
  - использовать для воспроизводимого regression flow:
    - new world
    - place building
    - unpause
    - observe stockpile change
    - trigger fail/win

## Модель артефактов по мотивам project-tracker

Репозиторий пока не bootstrapped task-tracker process files, но implementation work должен следовать той же логике.

### Уровень feature

Для работы до `first playable` feature-level артефактом является этот документ плюс уже существующий design doc:

- `docs/plans/2026-04-17-frontier-colony-design.md`
- `docs/plans/2026-04-17-frontier-colony-first-playable-implementation-plan.md`

Логический flow:

- `context`
- `spec`
- `plan`
- `implement`

### Уровень task

Каждый крупный этап ниже должен выполняться как отдельная задача с собственным Definition of Done.

Если проект позже будет bootstrapped через `project-tracker`, эти этапы должны разложиться в полноценные task artifacts без переписывания содержания.

## План имплементации

Ниже фазы расположены в строгом порядке. Не перескакивать через фазы.

---

## Фаза 1. Input-to-state loop

### Цель

Дать игроку возможность выбирать клетку и видеть, что игра понимает его выбор.

### Что реализовать

1. Добавить selectable tile state:
   - `selectedTile`
   - `hoveredTile`
   - `buildMode`

2. Добавить pointer bridge между Phaser и simulation/UI:
   - map click -> координаты клетки;
   - hover -> preview tile;
   - selection -> authoritative selected cell.

3. Добавить UI-инспектор выбранной клетки:
   - terrain
   - resource yields
   - buildability
   - nearby constraints

### Архитектурные правила

- Phaser вычисляет pointer coordinates, но не принимает gameplay decisions.
- Buildability не проверяется в сцене; сцена только запрашивает команду/selector.
- UI читает derived data, а не пересчитывает terrain rules сама.

### Файлы-кандидаты

- `src/game/render/inputBridge.ts`
- `src/game/simulation/selectors.ts`
- `src/App.tsx`
- `src/game/types.ts`

### Skills

- `game-studio:web-game-foundations`
- `game-studio:phaser-2d-game`

### Done when

- можно кликнуть карту;
- выбранная клетка визуально подсвечивается;
- HUD показывает свойства выбранной клетки;
- selection не ломает running tick loop.

---

## Фаза 2. Build mode и terrain validation

### Цель

Сделать первое реальное решение игрока: где можно строить и где нельзя.

### Что реализовать

1. Build panel с 3 зданиями:
   - `Lumber Camp`
   - `Forager Hut`
   - `Quarry`

2. Build mode state:
   - current selected building
   - preview placement
   - cancel placement

3. Terrain validation rules:
   - `Lumber Camp` только на/рядом с `forest | rainforest`
   - `Forager Hut` только на buildable land с достаточным food yield
   - `Quarry` только на/рядом с `highlands | mountain`
   - нельзя строить в `water | deep-water | snow`
   - нельзя строить поверх existing building

4. UI feedback:
   - valid placement preview
   - invalid placement reason
   - blocked action alert

### Архитектурные правила

- Validation живёт в отдельном simulation module.
- UI показывает reason string, но не генерирует её самостоятельно.
- Renderer не знает business semantics beyond `valid/invalid/selected`.

### Файлы-кандидаты

- `src/game/simulation/buildValidation.ts`
- `src/game/simulation/buildCommands.ts`
- `src/game/simulation/selectors.ts`
- `src/game/render/placementOverlay.ts`
- `src/ui/build-panel/*` или `src/components/build-panel/*`

### Skills

- `game-studio:web-game-foundations`
- `game-studio:phaser-2d-game`
- `game-studio:game-ui-frontend`

### Done when

- игрок может выбрать тип здания;
- карта показывает, можно ли ставить здание на выбранную клетку;
- invalid placement всегда объясняется;
- placement intent можно отменить.

---

## Фаза 3. Construction loop

### Цель

Сделать так, чтобы здание было не декоративной меткой, а командой с ценой и временем.

### Что реализовать

1. Building costs:
   - `Lumber Camp`
   - `Forager Hut`
   - `Quarry`

2. `placeBuilding` command:
   - проверка валидности;
   - списание ресурсов;
   - создание `planned` building;
   - start construction timer.

3. Construction progress:
   - `planned -> active`
   - progress percent / remaining time

4. UI surfaces:
   - статус строящихся зданий;
   - “not enough resources”;
   - “construction complete”.

### Архитектурные правила

- Costs и timers живут в simulation layer.
- Tick loop продвигает стройку как часть единого gameplay update.
- Phaser только отражает status `planned/active`.

### Файлы-кандидаты

- `src/game/simulation/buildCommands.ts`
- `src/game/simulation/buildProgress.ts`
- `src/game/simulation/tick.ts`
- `src/game/types.ts`

### Skills

- `game-studio:web-game-foundations`
- `game-studio:phaser-2d-game`
- `game-studio:game-ui-frontend`

### Done when

- здание не появляется мгновенно как fully active;
- оно стоит ресурсы;
- по завершении стройки начинает влиять на экономику.

---

## Фаза 4. Economy loop, который виден игроку

### Цель

Доказать, что действия игрока меняют состояние колонии наблюдаемым образом.

### Что реализовать

1. Связать production строго с активными зданиями.

2. Сделать opening economy прозрачной:
   - `food` visibly rises/falls;
   - `wood` visibly rises after `Lumber Camp`;
   - `stone` появляется только после `Quarry`.

3. Добавить минимальные derived metrics:
   - `food per day`
   - `wood per day`
   - `net food delta`
   - `days until starvation` если возможно оценить.

4. Добавить alerts:
   - `Food shortage`
   - `No valid build tile`
   - `Not enough wood/stone`
   - `Storage pressure` можно позже, не обязательно в first playable.

### Архитектурные правила

- Derived metrics считаются selector-ами, не инлайн в React render.
- Tick loop не должен обновлять UI напрямую.
- UI получает уже вычисленные summary values.

### Файлы-кандидаты

- `src/game/simulation/economySelectors.ts`
- `src/game/simulation/tick.ts`
- `src/App.tsx`

### Skills

- `game-studio:web-game-foundations`
- `game-studio:game-ui-frontend`

### Done when

- игрок может поставить здание и увидеть measurable change;
- проблема дефицита читается без дебага и without reading code.

---

## Фаза 5. Fail state и simple win state

### Цель

Закрыть игровой цикл так, чтобы сессия имела итог.

### Что реализовать

1. Fail state:
   - `food == 0` в течение заданного времени или
   - `stability <= 0`

2. Win state:
   - пережить `N` дней и
   - накопить минимум ресурсов
   - или построить один milestone building, если успеем добавить его быстро.

3. End-of-run overlay:
   - победа/поражение
   - причина
   - кнопка `New world`

4. Freeze gameplay state после окончания run.

### Архитектурные правила

- Win/lose logic — отдельный simulation module.
- Overlay — UI concern.
- Phaser не решает, закончена игра или нет.

### Файлы-кандидаты

- `src/game/simulation/winLose.ts`
- `src/App.tsx`
- `src/ui/end-state/*`

### Skills

- `game-studio:web-game-foundations`
- `game-studio:game-ui-frontend`

### Done when

- run заканчивается предсказуемо;
- можно проиграть без ручного инспектирования кода;
- можно выиграть понятным маршрутом.

---

## Фаза 6. Playtest gate

### Цель

Проверить, что это действительно играется, а не только технически работает.

### Что сделать

1. Smoke playthrough:
   - new world
   - выбрать клетку
   - построить `Lumber Camp`
   - построить `Forager Hut`
   - дождаться resource change
   - дожить до win state или intentionally starve colony

2. Проверить dead actions:
   - есть ли кнопки без эффекта;
   - есть ли invalid state без объяснения;
   - видно ли, почему run проигран.

3. Завести regression scenario через Playwright.

### Skills

- `game-studio:game-playtest`
- `playwright`

### Done when

- 3-5 минут реальной игры проходят без ощущения "я смотрю на мок";
- все критические действия имеют видимый результат.

## Разбиение на задачи

Если раскладывать этот план в task-style execution, правильный task set такой:

1. `FP-01` — selection + hovered tile + inspectors
2. `FP-02` — build mode + terrain validation
3. `FP-03` — building costs + planned/active construction
4. `FP-04` — economy summaries + alerts
5. `FP-05` — fail/win state + end overlay
6. `FP-06` — smoke playtest + regression flow

Каждая следующая задача начинается только после того, как предыдущая закрыла свой observable gameplay gap.

## Testing policy до first playable

Обязательные проверки после каждой фазы:

- `npm run lint`
- `npm run build`

Обязательные ручные проверки:

- world still renders;
- pause/speed still work;
- stockpile does not become `NaN`;
- no click action silently fails;
- no impossible state appears without visible message.

Обязательные игровые smoke-checks после фаз 3, 4, 5:

- можно построить хотя бы одно здание;
- хотя бы один ресурс visibly changes because of that building;
- можно либо проиграть, либо выиграть.

## Anti-patterns, которые нельзя допускать

- Добавлять новых ресурсов до working build loop.
- Добавлять новых зданий до working construction loop.
- Добавлять отдельных колонистов до working win/lose loop.
- Прятать invalid placement reason.
- Считать game rules в Phaser scene.
- Считать game rules прямо внутри React render.
- Держать authoritative state одновременно в React и Phaser.
- Компенсировать скучный loop добавлением "ещё одного ресурса".

## Последовательность использования skills

Для выполнения этого плана правильная последовательность такая:

1. `brainstorming`
   - только если появляется temptation расширить scope.

2. `game-studio:web-game-foundations`
   - перед фазой 1;
   - повторно перед фазой 3, если появляется риск смешения state/render/input.

3. `game-studio:phaser-2d-game`
   - фазы 1, 2, 3;
   - всё, что касается карты, курсора, подсветок, build overlays.

4. `game-studio:game-ui-frontend`
   - фазы 2, 4, 5;
   - build panel, alerts, overlays, HUD hierarchy.

5. `game-studio:game-playtest`
   - фаза 6.

6. `playwright`
   - после появления стабильного smoke loop.

`project-tracker` остаётся нормативным skill для process/architecture baseline, но не должен тормозить саму реализацию first playable, если репозиторий ещё не bootstrapped.

## Чёткий критерий завершения плана

План считается выполненным только если можно сделать следующий user run без ручного объяснения со стороны разработчика:

1. открыть игру;
2. нажать `New world`;
3. выбрать место под первое здание;
4. поставить минимум 2 разных здания;
5. увидеть, что ресурсы меняются из-за этих зданий;
6. проиграть или выиграть в пределах короткой сессии;
7. понять причину исхода по экрану, а не по консоли.

Если хотя бы один пункт не выполняется, проект всё ещё не `first playable`.
