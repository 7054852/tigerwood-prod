---
name: Тигервуд — сервис
description: Рабочая система управления производством, продажами и кадрами мебельной фабрики
colors:
  paper: "#F6F7F9"
  paper-sunken: "#EEF1F5"
  sheet: "#FFFFFF"
  ink: "#151A24"
  ink-soft: "#3B4455"
  graphite: "#667085"
  hairline: "#E4E7EC"
  field-edge: "#D0D5DD"
  tigerwood-blue: "#2458C9"
  tigerwood-blue-deep: "#1D4BAE"
  tigerwood-blue-mist: "#EAF0FB"
  forest-ok: "#16794A"
  forest-ok-mist: "#E7F4ED"
  amber-wait: "#9A5B06"
  amber-wait-mist: "#FCF2E1"
  brick-stop: "#C02E2E"
  brick-stop-mist: "#FCEBEB"
  night-paper: "#0F1115"
  night-sheet: "#171A21"
  night-ink: "#E7EAF0"
  night-graphite: "#9199A9"
  night-hairline: "#262B35"
  night-blue: "#3D6FDB"
  night-blue-text: "#8FB0F7"
typography:
  display:
    fontFamily: "Onest, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: "34px"
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
  title:
    fontFamily: "Onest, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "28px"
    letterSpacing: "-0.01em"
  heading:
    fontFamily: "Onest, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "24px"
  body:
    fontFamily: "Onest, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  body-strong:
    fontFamily: "Onest, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "20px"
  small:
    fontFamily: "Onest, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
  label:
    fontFamily: "Onest, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: "16px"
    letterSpacing: "0.06em"
rounded:
  xs: "6px"
  control: "10px"
  card: "14px"
  pill: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "24px"
  "6": "32px"
  "7": "48px"
components:
  button-primary:
    backgroundColor: "{colors.tigerwood-blue}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.tigerwood-blue-deep}"
  button-secondary:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  button-small:
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "32px"
  input:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "40px"
  card:
    backgroundColor: "{colors.sheet}"
    rounded: "{rounded.card}"
    padding: "20px"
  pill-ok:
    backgroundColor: "{colors.forest-ok-mist}"
    textColor: "{colors.forest-ok}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "22px"
  pill-wait:
    backgroundColor: "{colors.amber-wait-mist}"
    textColor: "{colors.amber-wait}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "22px"
  pill-stop:
    backgroundColor: "{colors.brick-stop-mist}"
    textColor: "{colors.brick-stop}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "22px"
---

# Design System: Тигервуд — сервис

## Overview

**Creative North Star: "Спокойный пульт фабрики"**

Сервис — рабочий стол директора, мастера и рабочего. Им пользуются в цеху с телефона под лампами и вечером с ноутбука, и в обоих случаях человек пришёл сделать дело: сдать наряд, увидеть, успевает ли заказ, подтвердить работу. Поэтому интерфейс сдержанный и точный: светлые листы на бумажном фоне днём, глубокая графитовая ночь после заката, один синий акцент и крупные цифры, которые читаются с первого взгляда.

«Дорого» здесь значит «ничего лишнего и всё выровнено»: один шрифт Onest, семь ролей текста, шкала отступов с шагом 4, четыре скругления, тонкие линии вместо заливок. Цвет несёт смысл (статус, выбранное, действие), а не украшает.

Тема меняется сама по восходу и закату в Минске, человек может закрепить «День» или «Ночь».

**Key Characteristics:**
- один шрифт (Onest), вес не выше 700, иерархия размером и цветом;
- табличные цифры для денег и штук;
- поверхности — бумага, лист, утопленный лоток; тени едва заметны;
- статус всегда цвет + значок + слово;
- светлое меню днём, тёмное ночью.

## Colors

Нейтральная бумажная гамма с одним глубоким синим и тремя приглушёнными статусными цветами.

### Primary
- **Синий Тигервуд** (#2458C9): основная кнопка, выбранный пункт меню, ссылки, фокус поля. Ночью заливка #3D6FDB, текст ссылок #8FB0F7.

### Neutral
- **Бумага** (#F6F7F9): фон страницы. Ночью #0F1115.
- **Утопленный лоток** (#EEF1F5): боковое меню, лотки групп, нейтральные пилюли.
- **Лист** (#FFFFFF): карточки, поля, таблицы. Ночью #171A21.
- **Чернила** (#151A24): основной текст. **Мягкие чернила** (#3B4455): вторичный, но важный текст.
- **Графит** (#667085): подписи, шапки таблиц, неактивные вкладки (4,9:1 на белом).
- **Волосная линия** (#E4E7EC): разделители и рамки карточек; **кромка поля** (#D0D5DD) — рамки полей и вторичных кнопок.

### Status
- **Лес — готово** (#16794A на #E7F4ED), **Янтарь — ждёт** (#9A5B06 на #FCF2E1), **Кирпич — стоп/ошибка** (#C02E2E на #FCEBEB), **Синий — информация** (акцент на #EAF0FB).

### Named Rules
**Правило одного голоса.** Синий занимает не больше 10% экрана: кнопка действия, выбранное, ссылка. Никаких синих заголовков, рамок и фонов «для красоты».
**Правило двух ключей статуса.** Цвет никогда не единственный носитель смысла: у пилюли всегда значок (✓ ⏳ ✕ ⓘ) и слово.

## Typography

**Body Font:** Onest (с -apple-system, Segoe UI, Roboto, Arial)

**Character:** Современный гротеск, нарисованный под кириллицу: ровный, спокойный, с чёткими цифрами — выглядит как дорогой инструмент, а не как шаблон.

### Hierarchy
- **Display** (600, 28/34, −0,01em, табличные цифры): большие цифры показателей — готовность, остаток, выработка дня.
- **Title** (600, 20/28): заголовок экрана, один на странице, одинаковый во всех разделах.
- **Heading** (600, 16/24): заголовок карточки, всплывающего окна, группы.
- **Body** (400, 14/20): текст, ячейки таблиц, поля.
- **Body strong** (500, 14/20): названия в строках, суммы.
- **Small** (400, 13/18): подписи, вторичные строки, сообщения.
- **Label** (600, 11/16, ПРОПИСНЫЕ, 0,06em): заголовки разделов и шапки таблиц.

### Named Rules
**Правило семи ролей.** Других размеров нет: 11, 13, 14, 16, 20, 28. Полупиксели, 800 и 900 запрещены. Исключение — печатная ведомость переучёта.
**Правило 16 пикселей в поле.** На телефоне шрифт поля ввода 16 px, иначе iOS увеличивает страницу при нажатии.

## Layout

Страница — центрованная колонка шириной до 1200 px (реестры, таблицы), 880 px (`body.w-narrow`: карточки, формы) или на всю ширину (`body.w-full`: табель, планирование). Отступ от края 24 px на компьютере и 16 px на телефоне.

Шкала отступов: 4 · 8 · 12 · 16 · 24 · 32 · 48. Внутри карточки 20 px (16 на телефоне), между карточками 16, перед заголовком раздела 32, под ним 12. Внутри группы элементы стоят через `gap`.

Перестройка под телефон одна — 640 px. Реестры на узком экране превращаются в карточки (`table.mob`). Широкие таблицы всегда в `.tbwrap` с прокруткой внутри.

Оболочка: меню 256 px слева, раздел во встроенном окне на всю высоту `100dvh`. Заголовок раздела показывает только оболочка — встроенная страница свой прячет (`html.emb`).

## Elevation & Depth

Почти плоско: глубину дают тон поверхности (бумага → лист → лоток) и волосная линия. Тень — только чтобы лист «лёг» на бумагу, и у всплывающих окон.

### Shadow Vocabulary
- **Лист** (`box-shadow: 0 1px 2px rgba(16,24,40,.05)`): карточки, плитки.
- **Всплывающее окно** (`box-shadow: 0 12px 32px rgba(16,24,40,.16), 0 2px 6px rgba(16,24,40,.06)`): модальные окна, заслонка «не нажимайте», меню.

### Named Rules
**Правило без свечения.** Цветных теней и ореолов нет. Выделение — подложка акцента или рамка фокуса.

## Shapes

Четыре скругления: 6 px (мелкие метки, ячейки графиков), 10 px (кнопки, поля), 14 px (карточки, окна), капсула (пилюли, чипы). Рамки 1 px. Цветные полосы сбоку карточек запрещены — статус показывает точка или пилюля.

## Components

### Buttons
- **Shape:** мягко скруглённые (10 px), высота 40 px; малая 32 px; цеховая 48 px на всю ширину.
- **Primary:** заливка синим, белый текст 600.
- **Hover / Focus:** темнее на ступень; фокус — кольцо 2 px акцента; нажатие — сжатие до 97%.
- **Secondary:** лист с кромкой поля; **ghost** — только синий текст, подложка при наведении.

### Chips
- **Style:** капсула 32 px с кромкой; выбранный — подложка акцента без рамки, синий текст.

### Cards / Containers
- **Corner Style:** 14 px.
- **Background:** лист на бумаге; лоток (#EEF1F5) для групп внутри экрана.
- **Shadow Strategy:** «лист» из словаря теней.
- **Border:** волосная линия 1 px.
- **Internal Padding:** 20 px (16 на телефоне).

### Inputs / Fields
- **Style:** лист, кромка #D0D5DD, 10 px, высота 40 px.
- **Focus:** синяя рамка + мягкое кольцо подложки акцента 3 px.
- **Disabled:** утопленный фон, графитовый текст.

### Navigation
- **Меню:** 256 px, днём утопленный светлый тон, ночью почти чёрный. Группы подписаны ролью label. Пункт 36 px, линейная иконка 18 px + подпись 14/500. Выбранный — лист с тенью и синей иконкой. На телефоне — выезжающая панель.
- **Вкладки:** текст графитом, выбранная — чернила и синяя черта 2 px снизу.

### Status Pill
Капсула 22 px, 12/500, подложка статуса + текст статуса + значок: ✓ готово, ⏳ ждёт, ✕ стоп, ⓘ инфо, без значка — нейтральная.

## Do's and Don'ts

### Do:
- **Do** брать цвета, размеры и отступы только из `tw-theme.css` (`var(--…)`).
- **Do** ставить `tabular-nums` на все колонки денег и штук (`.num`).
- **Do** показывать статус пилюлей `.pill.ok/.warn/.bad/.info/.mute` со значком и словом.
- **Do** проверять экран в «День» и «Ночь» и на ширине 375 px.

### Don't:
- **Don't** прописывать цвет в коде страницы или в строке `style=""` — только токен.
- **Don't** использовать размеры шрифта вне шкалы, полупиксели и насыщенность 800/900.
- **Don't** рисовать цветную полосу слева у карточки (`border-left` толще 1 px).
- **Don't** анимировать ширину и высоту — только `transform` и `opacity`, 150–200 мс.
- **Don't** заводить второй акцентный цвет (фиолетовый был на трёх экранах — убран).
