# PDF Reader Example

Автономний споживач публічного `@maksym5248/react-native-pdf-reader`. Не імпортує код Ammo,
не використовує Firebase, авторизацію, аналітику або backend. Нативна оболонка
створена з офіційного React Native Community template 0.83.1.

З кореня монорепозиторію після `yarn install`:

```sh
yarn workspace pdf-reader-example web
yarn workspace pdf-reader-example build:web
yarn workspace pdf-reader-example typecheck
yarn workspace @maksym5248/react-native-pdf-reader test
```

Web dev server: http://127.0.0.1:8093 (браузер автоматично не відкривається).
Вибір файла створює локальний Blob URL. PDF нікуди не відправляється.
Пошуковий і PDF.js workers включено у збірку. Холодний запуск web-сторінки
потребує доступності її статичних assets; service worker не додається.

Native:

```sh
cd packages/pdf-reader/example
bundle install
cd ios && bundle exec pod install && cd ..
yarn start
# в іншому терміналі
yarn ios
# або з уже запущеним наявним Android emulator
yarn android
```

iOS-команда використовує наявний `iPhone 18 Pro`. Launcher підтримує Simulator.app
та DeviceHub.app у Xcode 27; стандартний `react-native run-ios` тут не використовується.
Metro потрібно запустити окремо з example (`yarn start`); зайнятий іншим проєктом
порт 8081 завершує запуск з поясненням. `yarn workspace pdf-reader-example ios:simulator`
лише відкриває пристрій. Якщо Device Hub не показав його автоматично, відкрий
у ньому вікно `iPhone 18 Pro`. Не створювати нові пристрої.
Потрібні Xcode/CocoaPods або Android SDK/JDK та доступ до наявного симулятора.
JSI потребує нативної збірки — Expo Go та JS-only preview його не перевіряють.

Кнопка «Тестовий PDF» відкриває синтетичний документ: 3 сторінки, різні розміри,
поворот третьої сторінки; `alpha` і `книга` мають по 6 збігів. Native example
копіює вбудований тестовий файл у власний Documents (не бібліотека); Web створює Blob.
Власний файл на native можна передати абсолютним шляхом/file URI або Android
content URI, до якого вже надано доступ.

Перевірити: відкриття, зміна файла, close/reopen, перехід сторінок, zoom,
одна сторінка, безперервна/посторінкова прокрутка, горизонтальний напрям,
поворот 0/90/180/270°, підгонка за шириною/цілою сторінкою, мініатюри,
метадані активної сторінки, пошук, зміна запиту під час пошуку, попередній/наступний збіг,
виділення після scroll/zoom/повороту, порожній результат, файл без тексту,
помилковий URI. Ліміти: 256 збігів на сторінку, 2000 в example; досягнення
ліміту показується явно. Пошук чутливості до регістру доступний через API.
Показаний час відкриття/пошуку — локальний вимір, не порівняльний benchmark.

`fixtures/text.pdf` — тестові дані, не приватна книга. Генератор потребує
Python reportlab/pypdf і шляху до шрифту з кирилицею. Підмножина шрифту
вбудована лише в PDF. `src/fixture.ts` згенерований з цього самого файла.

## Межі перевірок

Web build і Metro bundle не доводять коректності native runtime. 2026-10-15
виконано iOS/Android Debug-збірки та перевірки на наявних iPhone 18 Pro і Android
emulator через agent-device. Результати, скриншоти й неперевірені сценарії:
[e2e/runtime-checks.md](e2e/runtime-checks.md). Власник надав постійний дозвіл
на роботу із симуляторами; він не поширюється на інші застосунки Mac.

Сценарій Maestro: `e2e/reader.yaml` (ще не прогнаний). На наявному E2E-пристрої
після встановлення example:

```sh
maestro --device "$EXISTING_E2E_DEVICE" test -e APP_ID=com.pdfreaderexample e2e/reader.yaml
# iOS: APP_ID=org.reactjs.native.example.PdfReaderExample
```

Сценарій не очищує дані інших застосунків; перевіряє fixture → пошук → навігацію
між збігами → мініатюри → режими/поворот → close/reopen. Виконані XCTest, Android instrumentation і Chromium-сценарії описано у runtime-звіті; Maestro не є джерелом підтвердження.


Мініатюри, метадані та пошук у прикладі використовують одну відкриту сесію.
Перевірка пам’яті: відкрити великий локальний PDF, швидко прокрутити стрічку
в обидва боки, змінити файл під час рендерингу, закрити й повторити. JS-кеш
стрічки має лишатися в межах 12 елементів / 2 MiB; окремо виміряти resident memory
PDFKit/PDFium і системного image cache. Під час зміни режиму поточна сторінка
має зберегтися, а збіги — збігатися з текстом після кожного повороту.

## Відтворювані native перевірки

Запустіть Metro з цього example. Використовуються тільки наявні E2E-пристрої:

```sh
yarn workspace pdf-reader-example test:ios
# Android: спочатку запустіть наявний Ammo_E2E; ANDROID_HOME має вказувати на SDK.
yarn workspace pdf-reader-example test:android
```

XCTest / Android instrumentation перевіряють публічний API, native renderer,
справжній двопальцевий zoom і navigation. Власні файли не використовуються:
тільки синтетичні text/image-only/password/corrupt fixtures. Пароль тестового
файла — `reader-test`. Генератор `scripts/generate-fixtures.py` потребує
reportlab, pypdf, Pillow і кириличного TTF. JSON-звіти записуються у Documents/files
тестового застосунку. `Run API checks` та `Run renderer checks` запускають ці самі
контрактні сценарії вручну.

`Benchmark current PDF` робить три проходи API для поточного локального файла;
у звіт потрапляють тільки кількість сторінок, наявність тексту й час операцій.
`Compare renderers` порівнює пакет із react-native-pdf 7.0.4 на тому самому файлі.
Legacy reader і його blob-util — залежності лише example для baseline; бібліотека
не набуває API завантаження файлів. Load/navigation callback timings не означають
first paint, а requestAnimationFrame вимірює JS frame intervals, не native FPS.


## Автоматична Web-перевірка

```sh
# Один раз, якщо Chromium відсутній:
yarn playwright install chromium
# В окремому терміналі: yarn web
yarn test:web
yarn test:web-taps
```

Тест працює тільки з локальним example на 127.0.0.1:8093 і синтетичними PDF.
Перевіряє 15 API та 8 renderer-сценаріїв, пошук/підсвічування, мініатюри й режими.
`test:web-taps` перевіряє приховування/повернення панелей, стабільну геометрію
PDF та відсутність перемикання під час подвійного кліку й прокрутки.
Звіти/скриншоти зберігаються в ignored `e2e/artifacts`; можна задати
`E2E_OUTPUT_DIR`. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` дозволяє використати вже
встановлений headless Chromium без додаткового завантаження.

## Пакування

`yarn workspace @maksym5248/react-native-pdf-reader build`, потім `npm pack`
з каталогу `packages/pdf-reader`. Встановіть отриманий `.tgz` у власний проєкт
через `npm install /path/to/package.tgz`; для iOS повторіть `pod install`.
Архів перевірено в окремому споживачі без workspace alias: TypeScript, native
autolinking, production Webpack і реальний browser render/search.
Публікацію та права npm scope ці перевірки не виконують.

## Підготовлений PDF — #558

Для перевірки синтетичного шестисторінкового результату `prepareBook` є Android
instrumentation method `ReaderTests#testPreparedBook`. Він очікує native + OCR
сторінки, чотири intrinsic rotations, одну blank page і п'ять збігів `Synthetic`.
Без `preparedPdfPath` цей адресний сценарій пропускається; інші fixtures незмінні.

На вже запущеному Ammo_E2E з локальним файлом у files тестового застосунку:

```sh
adb -s emulator-5554 shell am instrument -w -r \
  -e class 'com.pdfreaderexample.ReaderTests#testPreparedBook' \
  -e preparedPdfPath /data/user/0/com.pdfreaderexample/files/ammo-558-prepared.pdf \
  com.pdfreaderexample.test/androidx.test.runner.AndroidJUnitRunner
```

Копіювати лише synthetic файл, не приватну книгу. Скриншоти тест пише у власні
files; витягнуті артефакти тримати поза git. Тест не змінює Ammo, backend чи бібліотеку.
Порт Metro для example має бути вільним від іншого проєкту. Для окремого 8097:
запустити Metro з `--port 8097`, а Gradle — з `-PreactNativeDevServerPort=8097`.
Android emulator за замовчуванням звертається до host через 10.0.2.2; одного
adb reverse на 8081 недостатньо для перевизначення цього host endpoint.
Release має вбудований JS та не потребує Metro.

### Ручна iOS-перевірка через AXe

Власник обрав AXe для ручного керування наявним iPhone 18 Pro; встановлено 1.8.0.
Команди та обмеження вводу — у [development](../../../docs/technical/development.md#мобільні-e2e).
Спочатку перевірити правильний Metro: чужий bundle на 8081 може дати
`getConfig of null`, хоча встановлений native example справний. Власний Metro можна
запустити на 8097, не зупиняючи процес іншого проєкту. Не комітити локальний host
чи змінені test defaults. Перед порівнянням fixtures відновити вихідний код.

2026-10-30 на наявній Debug-оболонці iPhone 18 Pro / iOS 27.0 виконано API checks
(15/15) та renderer checks (8/8). Це чинний JS через окремий Metro, не нова iOS-збірка.
Підготовлений synthetic PDF має 6 сторінок: native, OCR при intrinsic rotations
0/90/180/270 та blank. Пошук `Synthetic` дав 5 збігів із правильними сторінками;
підсвічування перевірено після zoom 120% та додаткового повороту 90°.
Шлях до локального PDF та початковий ASCII-запит тимчасово задавалися лише в
example перед запуском: HID-ввід AXe використовував українську розкладку.
Це перевірка reader, а не ручного введення URI. Порожній запит/запит без збігів
перевірено через input; Metro після завантаження JS зупинено. Це не iOS Release
cold start у airplane-mode (такий прогін виконано лише на Android).
JSON дерева й screenshots лишаються поза git у системному tmp.
