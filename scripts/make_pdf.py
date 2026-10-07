from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer

OUT = str(Path(__file__).resolve().parent.parent / "docs" / "NASA-Heilbronn-CLPS.pdf")

ss = getSampleStyleSheet()
body = ParagraphStyle("b", parent=ss["Normal"], fontName="Helvetica", fontSize=8.5, leading=11)
key = ParagraphStyle("k", parent=body, fontName="Helvetica-Bold")
h = ParagraphStyle("h", parent=body, fontName="Helvetica-Bold", fontSize=10, spaceBefore=6, spaceAfter=3)
title = ParagraphStyle("t", parent=body, fontName="Helvetica-Bold", fontSize=13, leading=16, spaceAfter=4)


def table(rows):
    t = Table([[Paragraph(k, key), Paragraph(v, body)] for k, v in rows], colWidths=[32 * mm, 146 * mm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.lightgrey),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ]))
    return t


story = [
    Paragraph("NASA Space Apps 2026 — Heilbronn · CLPS Lunar Mission Browser", title),

    Paragraph("EVENT", h),
    table([
        ("Venue / dates", "OpenSpace Heilbronn, Weipertstraße 8–10. Listed 13–15 Nov, 13:00–19:00; hackathon 14–15 Nov. In person. Day trip from Stuttgart."),
        ("Team", "3: S (science), D (data/web), Isaac (product, UI, integration, pitch)."),
        ("Agents", "Repo agents write scripts and docs. Device agents on Isaac's computers do downloads, data copying, "
                   "Isaac's accounts and forms; each such action only after Isaac approves it."),
        ("Open", "Register team on the CLPS page. Confirm Friday agenda, daily hours, Wi-Fi, food, overnight access, "
                 "rule on code written before the event, prizes, number of global nominations."),
    ]),

    Paragraph("CHALLENGE", h),
    table([
        ("Build", "Tool for planners, educators and the public to compare south-pole landing sites and dates, showing Sun and Earth "
                  "relative to the local horizon: solar power potential and direct-to-Earth comms windows."),
        ("Status", "Official summary only. Full resources expected 28 Oct."),
        ("Core tech", "Ephemeris (SPICE / Skyfield) + horizon masks from LOLA elevation data (NASA PGDA)."),
        ("Main risk", "Terrain horizon. Without it results are wrong. Must work before the event."),
        ("Demo", "Pick 2–3 sites + date range: polar sky plot (horizon, Sun/Earth tracks), daily light/comms timeline, power + comms score."),
        ("Roles", "Science: ephemeris + horizon validation. Data/web: elevation processing, frontend. Isaac: product, UI, integration, pitch."),
        ("Cut first", "The score. Sky plot + timeline alone are a complete demo."),
        ("Award fit*", "Best Use of Data, Best Use of Technology, Galactic Impact."),
    ]),

    Paragraph("PREP BEFORE 13 NOV", h),
    table([
        ("1", "Sun/Earth azimuth + elevation script for a south-pole site, checked against JPL Horizons."),
        ("2", "LOLA elevation download + 360° horizon script, validated against PGDA illumination maps."),
        ("3", "Site list (Artemis III regions, CLPS polar sites, Shackleton ridge) with precomputed horizon masks."),
        ("4", "Five pain points in Moon Trek, LRO QuickMap and JPL Horizons."),
        ("5", "Sketches of the four screens."),
    ]),

    Paragraph("SOURCES", h),
    table([
        ("Event", "spaceappschallenge.org/2026 · openspace.hn/events · spaceappschallenge.org/legal"),
        ("Challenge", "spaceappschallenge.org/2026/challenges/clps-lunar-mission-browser"),
        ("Data", "pgda.gsfc.nasa.gov · naif.jpl.nasa.gov · ssd.jpl.nasa.gov/horizons"),
        ("Awards*", "spaceappschallenge.org/2025/awards — 2025 categories; 2026 unconfirmed."),
    ]),
]

SimpleDocTemplate(OUT, pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm, topMargin=14 * mm, bottomMargin=14 * mm,
                  title="NASA Space Apps 2026 — Heilbronn CLPS").build(story)
print(OUT)
