import XCTest

final class ReaderTests: XCTestCase {
    private func screenshot(_ app: XCUIApplication, name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testScrollTracksEvenPages() {
        let app = XCUIApplication(bundleIdentifier: "org.reactjs.native.example.PdfReaderExample")
        app.launch()
        XCTAssertTrue(app.buttons["Тестовий PDF"].waitForExistence(timeout: 30))
        app.buttons["Тестовий PDF"].tap()
        XCTAssertTrue(app.staticTexts["1 / 3"].waitForExistence(timeout: 15))
        let document = app.scrollViews.firstMatch
        let start = document.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.65))
        let end = document.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.35))
        start.press(forDuration: 0.05, thenDragTo: end)
        XCTAssertTrue(app.staticTexts["2 / 3"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Пошук"].isHittable)
    }

    func testRepeatedScrollDoesNotToggleTools() {
        let app = XCUIApplication(bundleIdentifier: "org.reactjs.native.example.PdfReaderExample")
        app.launch()
        XCTAssertTrue(app.buttons["Тестовий PDF"].waitForExistence(timeout: 30))
        app.buttons["Тестовий PDF"].tap()
        XCTAssertTrue(app.staticTexts["1 / 3"].waitForExistence(timeout: 15))
        let document = app.scrollViews.firstMatch
        for _ in 0..<3 {
            document.swipeUp(velocity: .fast)
            XCTAssertTrue(app.buttons["Пошук"].isHittable)
            document.swipeDown(velocity: .fast)
            XCTAssertTrue(app.buttons["Пошук"].isHittable)
        }
        screenshot(app, name: "tools-after-repeated-scroll")
    }

    func testTapControls() {
        let app = XCUIApplication(bundleIdentifier: "org.reactjs.native.example.PdfReaderExample")
        app.launch()
        XCTAssertTrue(app.buttons["Тестовий PDF"].waitForExistence(timeout: 30))
        app.buttons["Тестовий PDF"].tap()
        XCTAssertTrue(app.staticTexts["1 / 3"].waitForExistence(timeout: 15))
        let document = app.scrollViews.firstMatch
        XCTAssertTrue(document.waitForExistence(timeout: 10))
        document.coordinate(withNormalizedOffset: CGVector(dx: 0.4, dy: 0.4)).tap()
        let hidden = NSPredicate(format: "hittable == false")
        expectation(for: hidden, evaluatedWith: app.buttons["Пошук"])
        waitForExpectations(timeout: 5)
        screenshot(app, name: "tap-tools-hidden")
        document.coordinate(withNormalizedOffset: CGVector(dx: 0.4, dy: 0.4)).tap()
        let visible = NSPredicate(format: "hittable == true")
        expectation(for: visible, evaluatedWith: app.buttons["Пошук"])
        waitForExpectations(timeout: 5)
        XCTAssertTrue(app.staticTexts["1 / 3"].exists)
        screenshot(app, name: "tap-tools-restored")
        document.doubleTap()
        XCTAssertTrue(app.buttons["Пошук"].isHittable)
    }

    func testNativeContracts() {
        let app = XCUIApplication(bundleIdentifier: "org.reactjs.native.example.PdfReaderExample")
        app.launch()
        XCTAssertTrue(app.buttons["Run API checks"].waitForExistence(timeout: 30))
        app.buttons["Run API checks"].tap()
        XCTAssertTrue(app.staticTexts["PASS 15/15"].waitForExistence(timeout: 60))
        app.buttons["Run renderer checks"].tap()
        let result = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@ OR label BEGINSWITH %@", "PASS 8/8", "FAIL ")).firstMatch
        XCTAssertTrue(result.waitForExistence(timeout: 90))
        XCTAssertTrue(result.label.hasPrefix("PASS 8/8"), result.label)
        screenshot(app, name: "renderer-success")
    }

    func testSearchThumbnailsAndReadingModes() {
        let app = XCUIApplication(bundleIdentifier: "org.reactjs.native.example.PdfReaderExample")
        app.launch()
        XCTAssertTrue(app.buttons["Тестовий PDF"].waitForExistence(timeout: 30))
        XCTAssertFalse(app.buttons["Пошук"].isEnabled)
        app.buttons["Тестовий PDF"].tap()
        XCTAssertTrue(app.staticTexts["1 / 3"].waitForExistence(timeout: 15))
        XCTAssertTrue(app.buttons["Пошук"].isEnabled)
        app.buttons["Пошук"].tap()
        let query = app.textFields["Пошук у PDF"]
        XCTAssertTrue(query.waitForExistence(timeout: 5))
        query.tap()
        query.typeText("alpha")
        let result = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "6 збігів за")).firstMatch
        XCTAssertTrue(result.waitForExistence(timeout: 15))
        app.buttons["Збіг →"].tap()
        XCTAssertTrue(app.staticTexts["1/6"].exists)
        app.buttons["Збіг →"].tap()
        XCTAssertTrue(app.staticTexts["2/6"].exists)
        app.buttons["← Збіг"].tap()
        XCTAssertTrue(app.staticTexts["1/6"].exists)
        app.buttons["Сховати"].tap()
        screenshot(app, name: "search-highlights")
        app.buttons["Сторінки"].tap()
        XCTAssertTrue(app.buttons["Page 3"].waitForExistence(timeout: 10))
        app.buttons["Page 3"].tap()
        XCTAssertTrue(app.staticTexts["3 / 3"].waitForExistence(timeout: 10))
        app.buttons["Вигляд"].tap()
        app.switches["Horizontal"].tap()
        app.switches["Paging"].tap()
        app.buttons["Поворот 0°"].tap()
        XCTAssertTrue(app.buttons["Поворот 90°"].waitForExistence(timeout: 5))
        app.buttons["За шириною"].tap()
        XCTAssertTrue(app.buttons["Уся сторінка"].exists)
        XCTAssertTrue(app.staticTexts["3 / 3"].exists)
        app.buttons["Сховати"].tap()
        screenshot(app, name: "rotated-highlights")
        app.buttons["Файл"].tap()
        app.buttons["Закрити"].tap()
        XCTAssertFalse(app.buttons["Пошук"].isEnabled)
        app.buttons["Тестовий PDF"].tap()
        XCTAssertTrue(app.staticTexts["1 / 3"].waitForExistence(timeout: 10))
    }

    func testPinchDoubleTapAndPagePreservation() {
        let app = XCUIApplication(bundleIdentifier: "org.reactjs.native.example.PdfReaderExample")
        app.launch()
        XCTAssertTrue(app.buttons["Тестовий PDF"].waitForExistence(timeout: 30))
        app.buttons["Тестовий PDF"].tap()
        XCTAssertTrue(app.staticTexts["1 / 3"].waitForExistence(timeout: 15))
        let document = app.scrollViews.firstMatch
        XCTAssertTrue(document.waitForExistence(timeout: 10))
        document.pinch(withScale: 2, velocity: 1)
        app.buttons["Вигляд"].tap()
        let zoom = app.staticTexts.matching(NSPredicate(format: "label MATCHES %@", "[0-9]+%")).firstMatch
        XCTAssertTrue(zoom.waitForExistence(timeout: 5))
        let pinched = Int(zoom.label.replacingOccurrences(of: "%", with: "")) ?? 0
        XCTAssertGreaterThan(pinched, 110)
        XCTAssertLessThanOrEqual(pinched, 300)
        app.buttons["Сховати"].tap()
        document.doubleTap()
        app.buttons["Вигляд"].tap()
        let doubleTapped = Int(zoom.label.replacingOccurrences(of: "%", with: "")) ?? 0
        XCTAssertNotEqual(doubleTapped, pinched)
        app.buttons["Сховати"].tap()
        app.buttons["Наступна"].tap()
        XCTAssertTrue(app.staticTexts["2 / 3"].waitForExistence(timeout: 10))
        app.buttons["Вигляд"].tap()
        XCTAssertTrue(app.staticTexts["2 / 3"].exists)
        screenshot(app, name: "zoom-success")
    }
}
