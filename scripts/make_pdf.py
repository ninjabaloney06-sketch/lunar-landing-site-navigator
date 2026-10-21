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
        ("Venue / dates", "OpenSpace Heilbronn, Weipertstraße 8–10. Hackathon 14–15 Nov, in person. Sat 8:30 check-in, 10:30 hacking; "
                           "Sun 15:45 local submission deadline, 16:00 pitches, 18:00 awards. "
                           "Overnight at the venue allowed with the accompanying Betreuer; sleeping accommodation self-organised."),
        ("Team", "3, all under 18. Proposed: O = science checks (logic), B = frontend + design, Isaac = product, data scripts via agents, pitch. "
                 "Accompanied overnight by a Betreuer from Isaac's school (name pending)."),
        ("Agents", "Repo agents write scripts and docs. Device agents on Isaac's computers do downloads, data copying, "
                   "Isaac's accounts and forms; each such action only after Isaac approves it."),
        ("Confirmed", "Organiser (13 Oct) + official rules (16 Oct): project must arise during the event, no challenge work before it "
                      "(prep = physics reading, NASA data, tools like JPL Horizons; statements 28 Oct, submission + judging guides 13 Nov); "
                      "under 18 → accompaniment for the whole event incl. overnight + written authorisation per participant, "
                      "a Betreuer from Isaac's school will accompany (name pending); team self-registered — ask Sarah how to reconcile "
                      "with the terms' parent/guardian registration wording; "
                      "Wi-Fi unrestricted; bring power strips; global nominations scale with local submissions (no country quota); "
                      "local prizes independent of the global funnel; submission: no minors' photos/voices/names, cite + license everything, describe AI-tool use."),
        ("Still open", "Submission format and 2026 award categories (guides, 13 Nov) · roles · "
                       "Sarah's written confirmation of the Betreuer scheme and the account-registration fix."),
    ]),

    Paragraph("CHALLENGE", h),
    table([
        ("Build", "Tool for planners, educators and the public to compare south-pole landing sites and dates, showing Sun and Earth "
                  "relative to the local horizon: solar power potential and direct-to-Earth comms windows."),
        ("Status", "Official summary only. Full resources expected 28 Oct."),
        ("Core tech", "Ephemeris (SPICE / Skyfield) + horizon masks from LOLA elevation data (NASA PGDA)."),
        ("Main risk", "Terrain horizon, now built at the event. Go / no-go Sat 22:00: fewer validated sites beat many wrong ones."),
        ("Demo", "Pick 2–3 sites + date range: polar sky plot (horizon, Sun/Earth tracks), daily light/comms timeline, power + comms score."),
        ("Roles", "Science checks: Horizons + PGDA validation, score formula. Frontend: sky plot, timeline, views. Isaac: spec, agents, integration, pitch."),
        ("Cut first", "The score. Sky plot + timeline alone are a complete demo."),
        ("Award fit*", "Best Use of Data, Best Use of Technology, Galactic Impact."),
    ]),

    Paragraph("BEFORE THE EVENT (ALLOWED PREPARATION ONLY)", h),
    table([
        ("Learn", "Physics primer, coordinate conventions, source list for site coordinates, data guide (kernels, LOLA, licenses)."),
        ("Tools", "Five pain points in Moon Trek, LRO QuickMap and JPL Horizons, from a human run. Tutorials per role."),
        ("Ready", "Raw data on a USB stick, laptops offline-ready, parallel agents practised, authorisations, sleeping + travel."),
    ]),

    Paragraph("AT THE EVENT", h),
    table([
        ("Sat", "10:30 spec from the winning demo backwards · 16:00 ephemeris validated · 20:00 sky plot with real data · 22:00 horizon go / no-go."),
        ("Sun", "Windows, timeline, score, deploy · 12:00 feature freeze · 15:00 submitted (deadline 15:45) · 16:00 pitch."),
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
