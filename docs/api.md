# API reference

## API

```tsx
import { useRef } from 'react';
import { PdfReader, type IPdfReaderRef } from '@makit/react-native-pdf';

const reader = useRef<IPdfReaderRef>(null);

<PdfReader
    ref={reader}
    sourceUri={localFileUri}
    page={savedPage}
    scale={1}
    onPageChanged={(page, total) => saveProgress(page)}
    onLoadComplete={(total, uri, size) => setLoading(false)}
    onError={error => showError(error)}
    style={{ flex: 1 }}
/>;

reader.current?.setPage(12);
```

Нумерація сторінок починається з **1**. `page` задає початкову сторінку й реагує
на зміну значення; `setPage` дозволяє повторно перейти до тієї самої сторінки.
Команда до завершення завантаження застосовується після відкриття документа.
Некоректні номери нормалізуються; команда після відкриття обмежена кількістю сторінок.
`scale` типово обмежено 0.6–3 (можна задати `minScale`/`maxScale`); native підтримує pinch/double tap. `scrollEnabled={false}`
вимикає прокрутку; `singlePage` показує лише поточну сторінку.
Для стрічки мініатюр використовуйте `PdfThumbnails`, а не окремі reader-екземпляри.
`enableAnnotationRendering` увімкнений за замовчуванням.

Пакет повідомляє лише номер сторінки: закладки, зміст, прогрес, історія та інші
дані належать застосунку. Точне зміщення всередині сторінки й масштаб не зберігаються.

## Локальні джерела

- Native: абсолютний файловий шлях або `file:///...`; Android також `content://...`
  із уже наданим доступом. Дозволи на файл забезпечує споживач.
- Web: `blob:` URL із `URL.createObjectURL(fileOrBlob)`. Підтримку Blob та
  IndexedDB-кешу забезпечує застосунок. URL не можна відкликати, доки reader його використовує.
- HTTP(S), data URL і відносні шляхи відхиляються через `onError`; мережевого fallback немає.
- Помилки відсутнього, пошкодженого або захищеного паролем PDF передаються через `onError`.
- Зміна URI створює новий документ. Події старого JS-компонента після демонтування ігноруються.

PDF.js worker включається Webpack/Next у збірку через `new URL(..., import.meta.url)`.
React-PDF 9.2.1 та його PDF.js мають постачатися разом; CDN не використовується.
Включений `patches/react-pdf+9.2.1.patch` виправляє cleanup текстового шару:
скасоване завдання не викликає success/error callbacks, активні помилки залишаються
видимими. Для споживача: `node node_modules/@makit/react-native-pdf/scripts/apply-web-patches.cjs`. Скрипт перевіряє версії та повторне застосування.
Для повністю офлайн холодного запуску Web сам застосунок має забезпечити доступність
JS/worker assets: пакет не додає service worker.

## Пошук і підсвічування

```ts
const document = await openPdfSearch(localUri, password);
try {
    const result = await document.searchPage(1, 'книга');
    // Передайте result.matches у PdfReader.highlights,
    // а індекс активного збігу — в activeMatch.
} finally {
    document.close();
}
```

Native API — React Native Codegen TurboModule через JSI; PDFKit/PDFium працюють
у виділеній послідовній черзі з окремим документом від renderer. Web витягає
текст через локальний PDF.js worker, шукає в окремому worker і підсвічує точні
частини text-layer spans. Native iOS використовує PDFSelection, Android —
геометрію PDFium і canvas overlay. Виділення не записуються у PDF.

Нумерація сторінок від 1. Пошук без урахування регістру за замовчуванням.
Максимум 512 символів у запиті, 256 збігів на сторінку, 128 прямокутників на
збіг; `truncated` повідомляє ліміт збігів. `hasText` дозволяє відрізнити відсутній
текстовий шар від відсутності збігів. OCR не виконується. `close()` ідемпотентний;
після close відкладений результат відхиляється. Споживач запитує сторінки порціями
і припиняє запитувати наступні при скасуванні. Поточна нативна операція на сторінці
дозавершується у своїй черзі, UI не очікує її синхронно.

`start`/`length` належать текстовому представленню конкретної платформи, їх не
можна зберігати як переносимі координати або змішувати між PDF-рушіями. Web
використовує текстові інтервали, тому `rects` порожній. Нативні `rects` призначені
для поточного renderer; iOS використовує selection ranges для врахування повороту.

## Режими читання

- `enablePaging={false}` — безперервна прокрутка; `true` — посторінкове гортання
  (Web: CSS scroll snap).
- `horizontal` задає горизонтальний напрям незалежно від повороту сторінок.
- `rotation={0 | 90 | 180 | 270}` — додатковий поворот за годинниковою стрілкою,
  поверх повороту, записаного у PDF. Файл на диску не змінюється.
- `fitPolicy={0}` — за шириною, `1` — за висотою, `2` — уся сторінка;
  `scale` застосовується поверх підгонки. Для повернення до підгонки задайте `scale={1}`.
- `singlePage` показує тільки вибрану сторінку; це окрема опція від paging.

iOS використовує PDFKit rotation; Android — маленький JNI binding до публічного
`FPDFPage_SetRotation` з PDFiumAndroid 1.0.35, під його глобальним lock. Зміна
повороту перевідкриває renderer і перераховує геометрію сторінок; пошук і
мініатюри залишаються в окремій сесії. Для великих документів цей перехід
потребує заміру часу на пристроях. Web повертає canvas, text та annotation layers
разом через PDF.js. Android накладає той самий поворот на координати збігів.

Native також має RTL, scroll indicators, antialiasing, double tap, password,
outline у четвертому аргументі onLoadComplete та callbacks scale/tap/link.
Web підтримує RTL-порядок, double-click zoom, outline і callbacks; custom touch pinch та незалежне оформлення scroll indicators не заявляються. [Матриця паритету](parity.md).

## Метадані й мініатюри

```tsx
const document = await openPdfSearch(localUri, password);
const count = document.pages; // доступно без PdfReader
const info = await document.getPageInfo(3);
const text = await document.getPageText(3); // Текст однієї сторінки, без OCR; для скану порожній рядок.
// width/height: PDF points, до intrinsic rotation; rotation: поворот у файлі;
// hasText: текстовий шар цієї сторінки (не всього документа, без OCR).
const image = await document.renderThumbnail(3, 160);
// { uri: 'data:image/png;base64,...', width, height }, розмір у пікселях

<PdfThumbnails
    document={document}
    page={currentPage}
    onPageSelected={page => reader.current?.setPage(page)}
    onError={showError}
/>;
// Після демонтування споживачів:
document.close();
```

Пошук, метадані та мініатюри повторно використовують **цю саму сесію**. Метадані
зчитуються на запит для конкретної сторінки, повний текст документа наперед не
індексується. Розміри — crop box (або media box, якщо crop box відсутній).
Мініатюри враховують поворот із файла; додатковий viewing rotation не змінює їх.

`renderThumbnail` обмежує найбільшу сторону 512 px (типово 160). `PdfThumbnails`
віртуалізує стрічку, рендерить послідовно тільки її видиме вікно по 160 px
та тримає максимум 2 MiB закодованих зображень у своєму JS-кеші.
ThumbnailLoader підтримує також вищі сітки без обрізання списку видимих сторінок.
Це не ліміт усієї пам’яті PDF-рушія або системного image cache. Нативні bitmap і
тимчасовий Web canvas звільняються після кодування; PNG-файли на диск не пишуться.
При прокрутці черга замінюється, при демонтуванні — очищується; поточна операція
дозавершується, застарілий результат ігнорується. Власні споживачі API мають самі
обмежувати кількість одночасних запитів і час зберігання отриманих зображень.

## Перевірки

```sh
npm test
npm run typecheck
npm run lint
npm run test:web-build
npm run typecheck:example
npm run build:web --workspace pdf-reader-example
```

Unit/component тести охоплюють URI, навігацію, lifecycle, пошук,
Unicode, багаторядкові збіги, ліміти, HTML escaping, чергу й кеш мініатюр.
Native runtime і Web — окремі перевірки; результат Web не підтверджує native.
Див. [матрицю можливостей](parity.md). Текстові offsets залежать від рушія;
пакет не виконує OCR.

### Власний інтерфейс мініатюр

`ThumbnailLoader` експортується для host-застосунків із власною стрічкою або
сіткою. Створіть його з відкритим `IPdfSearchDocument` та callback зображень,
передавайте видимі номери через `setPages(pages)` і викликайте `dispose()` при
закритті UI. Документ належить caller; loader не закриває його. Це той самий
обмежений кеш і черга, які використовує `PdfThumbnails`.

### Одиночний тап і панелі застосунку

`onPageSingleTap(page, x, y)` повідомляє про підтверджений одиночний тап по PDF.
Пакет розпізнає жест; видимістю панелей керує застосунок. Подвійний тап для
масштабування, прокрутка, pinch, довге натискання, виділення тексту та PDF-посилання
не повинні перемикати інструменти. Web очікує завершення послідовності кліків
перед callback; native використовує платформне підтвердження жесту.

Розміщуйте панелі поверх стабільної області рендерера: зміна її висоти впливає
на fit-height/fit-page. Не змінюйте `key` або `sourceUri` заради приховування UI.
Приклад демонструє приховування/відновлення панелей тапом, не закриваючи PDF.
Застосунок також має надати альтернативу для клавіатури та screen reader.

### Індикатор відкриття

`renderLoading?: () => ReactNode` замінює стандартний ActivityIndicator власним
компонентом. Пакет показує overlay від відкриття локального джерела до готовності
рендерера (на Web — canvas початкової сторінки), прибирає його при помилці та
повторно показує при заміні джерела. Приклад: `renderLoading={() => <MyLoader />}`.
Завантаження файлу з мережі й індикатор цього етапу залишаються відповідальністю
застосунку. Автономний example демонструє власний індикатор.

### Search result viewport insets

`highlightContentInsets={{ top: headerHeight, bottom: toolbarHeight }}` controls scrolling to the active search result. Values are logical pixels; omitted sides default to zero. It does not add padding or resize the PDF. Navigation is clamped at document boundaries, so a result at the very start/end can still be covered by an overlay. Pass measured overlay sizes and update them when panels change.
