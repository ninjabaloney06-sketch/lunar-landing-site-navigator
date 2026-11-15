"""Build docs/event/pitch-backup-slides.pdf from the slide section of docs/event/pitch-outline.md.

A bullet of the form `- ![alt](file.png)` (path relative to docs/event/) draws that picture in the rest of the slide.
"""
import re
from pathlib import Path
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "docs" / "event" / "pitch-outline.md"
OUT = ROOT / "docs" / "event" / "pitch-backup-slides.pdf"

W, H = 960, 540  # 16:9 in points
INK, MUTED, RULE, ACCENT = HexColor("#1a1a1a"), HexColor("#8a8a8a"), HexColor("#e2e2e2"), HexColor("#2f5d8a")
MARGIN = 64


def slides():
    text = SRC.read_text().split("\n## Slides\n", 1)[1]
    out = []
    for block in re.split(r"\n(?=## Slide \d+ · )", text):
        m = re.match(r"## Slide (\d+) · (.+)", block.strip())
        if m:
            bullets = [l[2:].strip() for l in block.splitlines() if l.startswith("- ")]
            out.append((int(m.group(1)), m.group(2).strip(), bullets))
    return out


def clean(s):
    # Helvetica (WinAnsi) has no U+2212 minus sign.
    return s.replace("−", "-")


def wrap(c, text, font, size, width):
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = f"{cur} {w}".strip()
        if c.stringWidth(trial, font, size) <= width:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    return lines + [cur] if cur else lines


def draw(c, n, total, title, bullets):
    c.setFillColor(HexColor("#ffffff"))
    c.rect(0, 0, W, H, stroke=0, fill=1)
    first = n == 1
    y = H - (170 if first else 92)
    c.setFillColor(INK)
    size = 40 if first else 28
    for line in wrap(c, clean(title), "Helvetica-Bold", size, W - 2 * MARGIN):
        c.setFont("Helvetica-Bold", size)
        c.drawString(MARGIN, y, line)
        y -= size * 1.2
    y -= 10 if first else 4
    c.setStrokeColor(ACCENT)
    c.setLineWidth(2)
    c.line(MARGIN, y + 8, MARGIN + 48, y + 8)
    y -= 34
    width = W - 2 * MARGIN - 22
    for b in bullets:
        img = re.fullmatch(r"!\[[^\]]*\]\(([^)]+)\)", b)
        if img:
            # A picture takes the rest of the slide: scaled to fit, left-aligned, thin rule around it.
            from reportlab.lib.utils import ImageReader
            ir = ImageReader(str(SRC.parent / img.group(1)))
            iw, ih = ir.getSize()
            top = y + 16
            k = min((W - 2 * MARGIN) / iw, (top - 62) / ih)
            c.drawImage(ir, MARGIN, top - ih * k, iw * k, ih * k)
            c.setStrokeColor(RULE)
            c.setLineWidth(0.6)
            c.rect(MARGIN, top - ih * k, iw * k, ih * k, stroke=1, fill=0)
            y = top - ih * k - 6
            continue
        placeholder = b.startswith("[") and b.endswith("]")
        font, size = ("Helvetica-Oblique", 17) if placeholder else ("Helvetica", 19 if first else 18)
        lines = wrap(c, clean(b.strip("[]") if placeholder else b), font, size, width)
        if placeholder:
            h = len(lines) * size * 1.35 + 14
            c.setStrokeColor(MUTED)
            c.setLineWidth(0.8)
            c.setDash(4, 4)
            c.rect(MARGIN, y - h + size + 4, W - 2 * MARGIN, h, stroke=1, fill=0)
            c.setDash()
            c.setFillColor(MUTED)
            x = MARGIN + 12
        else:
            c.setFillColor(ACCENT)
            if not first:
                c.circle(MARGIN + 4, y + size * 0.32, 2.6, stroke=0, fill=1)
            c.setFillColor(INK if not first else MUTED)
            x = MARGIN + (0 if first else 22)
        for line in lines:
            c.setFont(font, size)
            c.drawString(x, y, line)
            y -= size * 1.35
        y -= 14 if placeholder else 10
    c.setStrokeColor(RULE)
    c.setLineWidth(0.6)
    c.line(MARGIN, 40, W - MARGIN, 40)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 10)
    c.drawString(MARGIN, 24, "Lunar Landing Site Navigator · NASA Space Apps 2026 Heilbronn · slides drafted with an SI tool (Claude Code)")
    c.drawRightString(W - MARGIN, 24, f"{n} / {total}")
    if y < 52:
        raise SystemExit(f"slide {n} overflows: shorten its bullets")
    c.showPage()


def main():
    s = slides()
    if not 1 <= len(s) <= 7:
        raise SystemExit(f"{len(s)} slides; the demo limit is 7")
    c = canvas.Canvas(str(OUT), pagesize=(W, H))
    c.setTitle("Lunar Landing Site Navigator — backup slides")
    for n, title, bullets in s:
        draw(c, n, len(s), title, bullets)
    c.save()
    print(f"{OUT.relative_to(ROOT)}: {len(s)} slides")


if __name__ == "__main__":
    main()
