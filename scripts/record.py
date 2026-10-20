"""Record a pass through the piece so motion can be reviewed (and shared)."""

from pathlib import Path

from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:5173/"
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "shots"
VIDEO = OUT / "video"
VIDEO.mkdir(parents=True, exist_ok=True)


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context(
            viewport={"width": 1280, "height": 800},
            record_video_dir=str(VIDEO),
            record_video_size={"width": 1280, "height": 800},
            locale="zh-CN",
        )
        page = context.new_page()
        page.goto(URL, wait_until="networkidle")
        page.wait_for_timeout(3200)

        page.evaluate(
            """(duration) => new Promise((resolve) => {
                const max = document.documentElement.scrollHeight - window.innerHeight;
                const start = performance.now();
                function step(t) {
                    const p = Math.min(1, (t - start) / duration);
                    const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
                    window.scrollTo(0, max * eased);
                    const mx = 640 + Math.cos(p * 18) * 380;
                    const my = 400 + Math.sin(p * 13) * 240;
                    window.dispatchEvent(new PointerEvent('pointermove', { clientX: mx, clientY: my }));
                    if (p < 1) requestAnimationFrame(step);
                    else resolve();
                }
                requestAnimationFrame(step);
            })""",
            10000,
        )
        page.wait_for_timeout(1500)
        video = page.video
        context.close()
        video_path = video.path()
        browser.close()

    print("video:", video_path)


if __name__ == "__main__":
    main()
