"""Check the pointer gravity well and that the field actually moves."""

from pathlib import Path

from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:5173/"
OUT = Path(__file__).resolve().parent.parent / "shots"
OUT.mkdir(parents=True, exist_ok=True)


def main() -> None:
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900}, locale="zh-CN")
        page.on("pageerror", lambda err: errors.append(f"pageerror: {err}"))
        page.on("console", lambda msg: errors.append(f"console.{msg.type}: {msg.text}") if msg.type == "error" else None)

        page.goto(URL, wait_until="networkidle")
        page.wait_for_timeout(3000)

        page.mouse.move(1080, 430, steps=24)
        page.wait_for_timeout(1400)
        page.screenshot(path=str(OUT / "desktop-pointer-intro.png"))
        page.screenshot(
            path=str(OUT / "desktop-pointer-crop.png"),
            clip={"x": 920, "y": 280, "width": 340, "height": 340},
        )

        page.wait_for_timeout(1300)
        page.screenshot(path=str(OUT / "desktop-motion-frame-2.png"))

        max_scroll = page.evaluate("document.documentElement.scrollHeight - window.innerHeight")
        page.evaluate(f"window.scrollTo(0, {max_scroll} * 0.5)")
        page.wait_for_timeout(1800)
        page.mouse.move(980, 470, steps=20)
        page.wait_for_timeout(900)
        page.screenshot(path=str(OUT / "desktop-pointer-light.png"))

        browser.close()

    print("console errors:" if errors else "no console errors")
    for line in errors:
        print(line)


if __name__ == "__main__":
    main()
