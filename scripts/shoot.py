"""Capture the piece at key scroll positions for visual review."""

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:5173/"
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "shots"
STOPS = [0.0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 1.0]
NAMES = ["00-intro", "01-noise", "02-thought", "03-light", "04-wait", "05-name", "06-flux"]

mobile = "--mobile" in sys.argv
viewport = {"width": 390, "height": 844} if mobile else {"width": 1440, "height": 900}
label = "mobile" if mobile else "desktop"

OUT.mkdir(parents=True, exist_ok=True)


def main() -> None:
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context(
            viewport=viewport,
            device_scale_factor=1,
            locale="zh-CN",
        )
        page = context.new_page()
        page.on("console", lambda msg: errors.append(f"console.{msg.type}: {msg.text}") if msg.type in ("error", "warning") else None)
        page.on("pageerror", lambda err: errors.append(f"pageerror: {err}"))

        page.goto(URL, wait_until="networkidle")
        page.wait_for_timeout(3200)

        max_scroll = page.evaluate("document.documentElement.scrollHeight - window.innerHeight")
        print(f"viewport={label} max_scroll={max_scroll}")

        for stop, name in zip(STOPS, NAMES):
            page.evaluate(f"window.scrollTo(0, {max_scroll} * {stop})")
            page.wait_for_timeout(1900)
            path = OUT / f"{label}-{name}.png"
            page.screenshot(path=str(path))
            print("saved", path)

        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(1200)
        page.screenshot(path=str(OUT / f"{label}-back-to-top.png"))

        context.close()
        browser.close()

    if errors:
        print("\n--- console issues ---")
        for line in errors:
            print(line)
    else:
        print("\nno console errors")


if __name__ == "__main__":
    main()
