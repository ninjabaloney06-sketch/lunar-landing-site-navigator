// In-app documentation: a simplified version of docs/documentation.md and docs/reference/data-sources.md for
// readers new to the topic. Every statement comes from those two files; numbers are kept exactly as written there.
// Repository files are not served by the app, so they appear as plain paths, never as links.
import type { JSX, ReactNode } from 'react'

export interface DocSection {
  id: `doc-${string}`
  title: string
  body: JSX.Element
}

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  )
}

function Path({ children }: { children: string }) {
  return <code className="docs-path">{children}</code>
}

function Key({ children }: { children: string }) {
  return <kbd className="docs-key">{children}</kbd>
}

// ---------- source list (docs/reference/data-sources.md) ----------

interface SourceFile {
  name: string
  url: string
  note: string
  // companion files of the same dataset (labels, comments), linked after the main file
  extra?: { text: string; url: string }[]
}

interface Dataset {
  title: string
  about: ReactNode
  files: SourceFile[]
  credit: ReactNode
}

const NAIF = 'https://naif.jpl.nasa.gov/pub/naif/generic_kernels'
const PDS_ILLUM = 'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/release_2016/img'
const MIT_ILLUM = 'http://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG'
const LOLA_5M = 'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img'
const DIVINER = 'https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_prp'
const SVS_MOON = 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720'
const SVS_STARS = 'https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851'

const MAZARICO = (
  <>Citation: Mazarico et al. 2011 (Icarus 211, 1066-1081, doi:10.1016/j.icarus.2010.10.030).</>
)

const DATASETS: Dataset[] = [
  {
    title: 'Sun and Earth positions: SPICE kernels',
    about: (
      <>
        SPICE gives the positions of the Sun and Earth and the orientation of the Moon and Earth. The Earth frame{' '}
        <Path>IAU_EARTH</Path> comes from <Path>pck00011.tpc</Path>.
      </>
    ),
    files: [
      { name: 'de440s.bsp', url: `${NAIF}/spk/planets/de440s.bsp`, note: 'DE440, 1849-12-26 to 2150-01-22' },
      { name: 'naif0012.tls', url: `${NAIF}/lsk/naif0012.tls`, note: 'naif0012' },
      { name: 'pck00011.tpc', url: `${NAIF}/pck/pck00011.tpc`, note: 'pck00011' },
      {
        name: 'moon_pa_de440_200625.bpc',
        url: `${NAIF}/pck/moon_pa_de440_200625.bpc`,
        note: 'DE440 lunar orientation',
        extra: [{ text: 'comments', url: `${NAIF}/pck/moon_pa_de440_200625.cmt` }],
      },
      { name: 'moon_de440_250416.tf', url: `${NAIF}/fk/satellites/moon_de440_250416.tf`, note: 'Moon FK, Apr 2025' },
    ],
    credit: <>No licence file; attribute NASA/JPL/Caltech.</>,
  },
  {
    title: 'Terrain: LOLA south pole elevation models',
    about: (
      <>
        Heights of the terrain around the south pole. The 20 m model gives the site heights, the site slopes and the
        terrain horizon. Where the horizon reaches past the 20 m model, the 120 m model continues it.
      </>
    ),
    files: [
      {
        name: 'LDEM_80S_20MPP_ADJ.TIF',
        url: 'https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF',
        note: 'Barker et al. 2023, 80° S to 90° S, 20 m per pixel',
      },
      {
        name: 'LDEM_60S_120MPP_ADJ.TIF',
        url: 'https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_60S_120MPP_ADJ.TIF',
        note: 'Barker et al. 2023 (PGDA product 90), 60° S to 90° S, 120 m per pixel',
      },
    ],
    credit: (
      <>
        Citation: <Ext href="https://doi.org/10.3847/PSJ/acf3e1">Barker et al. 2023</Ext> (doi:10.3847/PSJ/acf3e1)
        and the data, doi:10.60903/gsfcpgda-lola-spole. The product page of the 120 m model states no explicit licence.
      </>
    ),
  },
  {
    title: 'Terrain detail: LOLA 5 m polar model',
    about: <>Used for the site assessments of 7 sites (Details drawer, Landing site assessment).</>,
    files: [
      {
        name: 'ldem_875s_5m.img',
        url: `${LOLA_5M}/ldem_875s_5m.img`,
        note: 'PDS LOLA GDR V2.0, 87.5° S to 90° S, 5 m per pixel',
        extra: [{ text: 'label', url: `${LOLA_5M}/ldem_875s_5m.lbl` }],
      },
    ],
    credit: <>PDS: free use; attribute NASA/LOLA team / PDS Geosciences Node. No licence file in the bundle.</>,
  },
  {
    title: 'Sunlight and Earth visibility maps',
    about: (
      <>
        Average solar illumination and average Earth visibility, 2016 release. The 60 m and 120 m Sun-visibility maps
        are inputs to the 3D terrain tiles and to the site assessments.
      </>
    ),
    files: [
      {
        name: 'avgvisib_85s_060m_201608.img',
        url: `${PDS_ILLUM}/avgvisib_85s_060m_201608.img`,
        note: 'average solar illumination, 85° S to 90° S, 60 m per pixel',
        extra: [{ text: 'label', url: `${PDS_ILLUM}/avgvisib_85s_060m_201608.lbl` }],
      },
      {
        name: 'avgvisib_85s_060m_201608_earth.img',
        url: `${PDS_ILLUM}/avgvisib_85s_060m_201608_earth.img`,
        note: 'average Earth visibility, 85° S to 90° S, 60 m per pixel',
        extra: [{ text: 'label', url: `${PDS_ILLUM}/avgvisib_85s_060m_201608_earth.lbl` }],
      },
      {
        name: 'AVGVISIB_75S_120M_201608.IMG',
        url: `${MIT_ILLUM}/AVGVISIB_75S_120M_201608.IMG`,
        note: 'average solar illumination, 75° S to 90° S, 120 m per pixel (MIT mirror)',
        extra: [{ text: 'label', url: `${MIT_ILLUM}/AVGVISIB_75S_120M_201608.LBL` }],
      },
      {
        name: 'AVGVISIB_75S_120M_201608_EARTH.IMG',
        url: `${MIT_ILLUM}/AVGVISIB_75S_120M_201608_EARTH.IMG`,
        note: 'average Earth visibility, 75° S to 90° S, 120 m per pixel (MIT mirror)',
        extra: [{ text: 'label', url: `${MIT_ILLUM}/AVGVISIB_75S_120M_201608_EARTH.LBL` }],
      },
      {
        name: 'avgvisib_65s_240m_201608.img',
        url: `${PDS_ILLUM}/avgvisib_65s_240m_201608.img`,
        note: 'average solar illumination, 65° S to 90° S, 240 m per pixel',
        extra: [{ text: 'label', url: `${PDS_ILLUM}/avgvisib_65s_240m_201608.lbl` }],
      },
      {
        name: 'avgvisib_65s_240m_201608_earth.img',
        url: `${PDS_ILLUM}/avgvisib_65s_240m_201608_earth.img`,
        note: 'average Earth visibility, 65° S to 90° S, 240 m per pixel',
        extra: [{ text: 'label', url: `${PDS_ILLUM}/avgvisib_65s_240m_201608_earth.lbl` }],
      },
    ],
    credit: MAZARICO,
  },
  {
    title: 'Temperature: Diviner South Polar Resource Product',
    about: (
      <>
        Model-fit annual mean temperature (at 2 cm depth) and annual maximum surface temperature, on a mesh of
        2,880,000 triangles reaching 80° S. Version LRO-L-DLRE-5-PRP-V2.0, created 2018-02-21. Used only for the
        site assessments.
      </>
    ),
    files: [
      {
        name: 'dlre_prp_south.tab',
        url: `${DIVINER}/dlre_prp_south.tab`,
        note: 'the data table',
        extra: [
          { text: 'PDS3 label', url: `${DIVINER}/dlre_prp_south.lbl` },
          { text: 'PDS4 label', url: `${DIVINER}/dlre_prp_south.xml` },
        ],
      },
    ],
    credit: (
      <>
        No licence or usage terms in the labels; public NASA PDS data, released under{' '}
        <Ext href="https://science.nasa.gov/researchers/science-data/science-information-policy/">
          NASA SMD policy SPD-41a
        </Ext>
        . Citation: "Paige et al., LRO DLRE LEVEL 5 PRP V2.0, NASA Planetary Data System, LRO-L-DLRE-5-PRP-V2.0, 2018".
      </>
    ),
  },
  {
    title: 'Moon images for the 3D view: NASA SVS CGI Moon Kit (SVS 4720)',
    about: <>Colour and elevation images of the Moon.</>,
    files: [
      { name: 'lroc_color_2k.jpg', url: `${SVS_MOON}/lroc_color_2k.jpg`, note: 'LROC WAC colour, 2k' },
      { name: 'lroc_color_poles_4k.tif', url: `${SVS_MOON}/lroc_color_poles_4k.tif`, note: 'LROC colour including the poles, 4k' },
      { name: 'lroc_color_poles_8k.tif', url: `${SVS_MOON}/lroc_color_poles_8k.tif`, note: 'LROC colour including the poles, 8k' },
      { name: 'ldem_4.tif', url: `${SVS_MOON}/ldem_4.tif`, note: 'LOLA elevation, 4 px per degree' },
      { name: 'ldem_16_uint.tif', url: `${SVS_MOON}/ldem_16_uint.tif`, note: 'LOLA elevation, 16 px per degree' },
    ],
    credit: <>Credit: NASA's Scientific Visualization Studio, LRO/LROC/LOLA teams.</>,
  },
  {
    title: 'Stars for the 3D view: NASA SVS Deep Star Maps 2020 (SVS 4851)',
    about: <>A star map in celestial (J2000) coordinates.</>,
    files: [
      { name: 'starmap_2020_4k.exr', url: `${SVS_STARS}/starmap_2020_4k.exr`, note: 'celestial (J2000), 4k' },
      { name: 'starmap_2020_4k_print.jpg', url: `${SVS_STARS}/starmap_2020_4k_print.jpg`, note: '4k preview' },
    ],
    credit: <>Credit: NASA/Goddard Space Flight Center Scientific Visualization Studio.</>,
  },
  {
    title: 'Earth image for the 3D view: Blue Marble Next Generation',
    about: <>NASA Earth Observatory (Stöckli et al.).</>,
    files: [
      {
        name: 'world.200411.3x5400x2700.jpg',
        url: 'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/november/world.200411.3x5400x2700.jpg',
        note: 'November 2004 base map',
      },
    ],
    credit: <>Credit: NASA Earth Observatory.</>,
  },
]

function SourceList() {
  return (
    <ul className="plain docs-sources">
      {DATASETS.map((d) => (
        <li key={d.title}>
          <p>
            <strong>{d.title}</strong>
          </p>
          <p>{d.about}</p>
          <ul className="plain docs-files">
            {d.files.map((f) => (
              <li key={f.name}>
                <a className="docs-file" href={f.url} target="_blank" rel="noreferrer">
                  {f.name}
                </a>
                {f.extra?.map((x) => (
                  <span key={x.url}>
                    {' '}
                    and its{' '}
                    <a href={x.url} target="_blank" rel="noreferrer">
                      {x.text}
                    </a>
                  </span>
                ))}
                : {f.note}
              </li>
            ))}
          </ul>
          <p className="docs-quiet">{d.credit}</p>
        </li>
      ))}
    </ul>
  )
}

// ---------- resolution of each result (documentation.md, "Limits") ----------

const RESOLUTION: [string, string][] = [
  ['Dates', '1 Nov 2026 00:00 UTC to 1 Jan 2031 00:00 UTC; a mission of at most 60 days'],
  ['Sun and Earth direction', 'Positions sampled every 30 min and interpolated; interpolation tested against direct SPICE values below 0.001°'],
  ['Terrain horizon', '0.5° in azimuth; 20 m terrain within 20 km, 160 m averages from 20 km to 300 km; observer 1.75 m above the site point'],
  ['Sunlit, Earth visible', 'Yes or no for "any part of the disc above the horizon"'],
  [
    'Window start and end',
    'Found numerically to ±10 s on the interpolated model; events shorter than 1 min (5 min for periods over 31 days) can be missed. This is the numerical resolution, not a measured accuracy; the window-edge check V5 is covered by the statement of 15 Nov 2026 of the science lead, with no per-check sign-off',
  ],
  ['Find better dates', '30-minute samples; landing times 30 minutes apart'],
  ['Station geometry', 'Moon elevation at a station differs from JPL Horizons by up to 0.0763° in the 10 recorded values (station check open)'],
  ['Site position', "As printed in each site's source, a representative point of a region; frame assumed where the source does not name it"],
  ['Site slope (5° limit)', 'One value per site over a 100 m baseline on the 20 m model, stored to 0.1°'],
  ['3D terrain', '20 m within ±2.5 km, 80 m within ±20 km, 160 m within ±40 km (from the south-cap 80 m tiles), 400 m within ±60 km, 2 km within ±300 km; for viewing only'],
]

// ---------- what was checked (docs/event/validation.md; status = that file's wording) ----------

interface CheckRow {
  check: string
  points: string
  largest: string
  tolerance: string
  who: ReactNode
  status: string
}

const CHECKS: CheckRow[] = [
  {
    check:
      "Horizons comparison: Sun and Earth azimuth and elevation from the app's own ephemeris files and interpolation, against JPL Horizons (observer on the Moon at the site, apparent, airless); Connecting Ridge, Shackleton Rim Site04, IM-1, 2027–2030",
    points: '72 (36 on 30-minute samples, 36 between samples)',
    largest:
      'Elevation 0.000043°, azimuth × cos(elevation) 0.000020°; medians 0.0000027° and 0.0000003°. On samples 0.000024°, between samples 0.000043°',
    tolerance: '< 0.05° (V1)',
    who: (
      <>
        Run by an AI tool (Claude Code) on 15 Nov 2026; not a sign-off by the science lead. Script{' '}
        <Path>scripts/tools/horizons_check.py</Path>, result{' '}
        <a href={`${import.meta.env.BASE_URL}data/validation/horizons.json`}>horizons.json</a> (run 15 Nov 2026,
        21:45)
      </>
    ),
    status: 'No status; recorded in the section "Horizons comparison, 15 Nov 2026 (AI-run)"',
  },
  {
    check: 'V1: Sun and Earth azimuth and elevation against JPL Horizons, 10 site and time points',
    points: '20 values at two sites; AI rechecks: 20 values (14 Nov), 24 values (15 Nov)',
    largest: 'Azimuth 0.0000°, elevation 0.0001°; rechecks: equal to the printed 0.001° (14 Nov), below 0.0001° (15 Nov)',
    tolerance: '< 0.05°',
    who: 'Values filled in by an AI tool, 14 Nov 2026 about 13:10; AI rechecks 14 Nov 18:40 and 15 Nov about 09:00',
    status: 'Passed, as reported by a team member in chat, 14 Nov 2026 15:56; no written sign-off by the science lead',
  },
  {
    check: 'V2: Sun elevation near the pole from the Horizons sub-solar point by the spherical formula, against ours',
    points: '1 (14 Nov); 4 more in the AI recheck of 15 Nov',
    largest: '0.0007°',
    tolerance: 'Sign and size agree',
    who: 'AI tool, 14 Nov 2026 about 13:10; AI recheck 15 Nov',
    status: 'Passed, as reported by a team member in chat, 14 Nov 2026 15:56; no written sign-off by the science lead',
  },
  {
    check: 'Station check: Moon elevation at the Earth stations against Horizons (station as observer)',
    points: '10 (Madrid, Canberra); 25 in the AI recheck of 15 Nov (all five stations)',
    largest: '0.0763°; recheck 0.0782° (Uchinoura)',
    tolerance: 'Not set; AI proposal ≤ 0.1°',
    who: 'AI tool, 14 Nov 2026 about 13:10; AI recheck 15 Nov',
    status: 'Open; the tolerance and two questions need the science lead',
  },
  {
    check: 'V3: synthetic horizons (flat sphere, cones) against exact sphere geometry',
    points: '720 azimuths; cones at 7.5, 45 and 180 km',
    largest: 'Flat sphere 0.00002° (−0.08132°); cones 0.00004°',
    tolerance: '< 0.01°',
    who: 'AI tool, 14 Nov 2026 18:40 and 15 Nov',
    status: 'Open',
  },
  {
    check: 'V4: lit % and Earth-visible % over 2027–2030 against the published average-illumination maps (context only)',
    points: '18 sites, Sun and Earth',
    largest: 'Sun 9.0 points (mean +2.1); Earth 8.4 points, offset of about +1.5 points with no established cause',
    tolerance: 'Same ballpark; investigate above 15 points',
    who: 'AI tool, 14 Nov 2026',
    status: 'Open, needs the science lead',
  },
  {
    check: 'V5: window edges (Sun and Earth rise and set) against a 1-minute brute force from Horizons',
    points: '12 edges, 3 sites × 3 days in Aug 2027 (15 Nov); 6 cases (14 Nov)',
    largest: 'Every edge inside the 1-minute bracket',
    tolerance: '≤ 1 min',
    who: 'AI tool, 14 and 15 Nov 2026',
    status: 'Open; AI recheck agrees',
  },
  {
    check: "V6: coarse custom-site horizon, rebuilt from the shipped terrain, against the 18 full horizons",
    points: '18 sites',
    largest: 'Median 0.013°, worst-site median 0.253°, worst direction 1.679° (the app states 0.013 / 0.256 / 1.679°)',
    tolerance: 'Reported, shown in the interface',
    who: 'AI tool, 15 Nov 2026',
    status: 'Open; AI recheck reproduces the stated accuracy',
  },
  {
    check: 'V7: values on screen against the pipeline and Horizons',
    points: '36 table values (14 Nov); one set at Connecting Ridge, 16 Aug 2027 (15 Nov)',
    largest: '35 of 36 identical to 0.1 %, Connecting Ridge coverage 98.1 % against 98.2 %; 15 Nov set equal to display precision',
    tolerance: 'Exact to display precision',
    who: 'AI tool, 14 and 15 Nov 2026',
    status: 'Open; AI recheck agrees',
  },
  {
    check: 'V8: landing-window finder against a brute force over every 30-minute landing time',
    points: '3 sites, 16 Aug 2027 + 60 days',
    largest: 'Edges within 2 h and 4 h at two sites; at Haworth a window was missed with the old 6-hour grid',
    tolerance: 'Same windows, edges ≤ 6 h',
    who: 'AI tool, 15 Nov 2026',
    status: 'Open; failed at Haworth with the 6-hour grid, fixed to 30 minutes',
  },
  {
    check: 'V9: panel types',
    points: 'None',
    largest: 'No numbers recorded',
    tolerance: '3 significant digits',
    who: 'Not run',
    status: 'Panel types not built (no value to check)',
  },
  {
    check: 'Horizon range: 150 km against 300 km rays',
    points: '3 sites × 720 directions',
    largest: 'Skyline 0.4437° (Connecting Ridge, azimuth 105.5°); lit % changes by at most 0.12 points',
    tolerance: 'Not recorded',
    who: 'AI tool, 14 Nov 2026 16:27–16:43',
    status: 'Open, needs the science lead',
  },
  {
    check: 'Truncated horizons: the 18 regenerated horizons against an independent ray march on the raw elevation models',
    points: '18 sites × 144 azimuths',
    largest: '0.087° (Haworth); median per site ≤ 0.009°',
    tolerance: 'Not recorded',
    who: 'AI tool, 14 Nov 2026 18:40',
    status: 'Open; AI recomputation agrees within 0.09°',
  },
  {
    check: 'Site assessments: slopes recomputed from the shipped terrain tiles',
    points: '11 sites on the 20 m model; the 7 sites on the 5 m model are not like for like',
    largest: 'Landing-area median within 0.45°; pass or fail equal at 11 of 11',
    tolerance: 'Not recorded',
    who: 'AI tool, 15 Nov 2026',
    status: 'Accepted by the science lead at 6650ed1 (reported, no written sign-off); seven method choices open',
  },
  {
    check: '"Open in NASA tools": first Horizons row against the app',
    points: '6 values (3 sites, Sun and Earth)',
    largest: '0.0000192° (Earth elevation)',
    tolerance: '< 0.05°',
    who: 'AI tool, 15 Nov 2026 07:00–07:30',
    status: 'AI, not validated',
  },
  {
    check: 'P1 power estimate',
    points: '8 hand-computed test cases (code tests)',
    largest: 'No numbers recorded',
    tolerance: 'Not recorded',
    who: 'AI tool, 15 Nov 2026',
    status: 'Open, needs the science lead',
  },
  {
    check: 'Flight physics; payload and cheapest route; lunar J2 and dispersion',
    points: 'No comparison recorded; code tests only (249 of 250 passed, one timeout)',
    largest: 'No numbers recorded',
    tolerance: 'Not recorded',
    who: 'Code tests by an AI tool, 15 Nov 2026',
    status:
      'Flight physics: statement of 14 Nov 2026 in BUILD_LOG.md, against what not recorded; payload, route, J2 and dispersion: not yet validated by the science lead',
  },
  {
    check:
      'Not checked: whole-year mode; the cause of the Earth offset in V4; the custom-site horizon as computed in the browser (V6 used a Python rebuild of it); one finder window by eye on the timeline; coordinates of the points of interest against primary sources (7 cite Wikipedia or SpaceNews) and a source for the Tycho texture position; an independent recheck of the site assessments on the raw elevation models and the Diviner file, including the 7 sites on the 5 m model; station coverage with per-antenna horizon masks (coverage is an upper bound)',
    points: 'None',
    largest: 'None',
    tolerance: 'None',
    who: 'Not run',
    status: 'Open in the record',
  },
]

// ---------- the sections, in reading order ----------

export const DOC_INTRO = (
  <>
    <p className="docs-lede">
      What the Lunar Landing Site Navigator answers, how to read it and where its numbers come from. This page
      describes the app as it is on 15 Nov 2026. Team SFZ | MEXG, NASA Space Apps 2026, local event Heilbronn. The
      full documentation, with the scientific proof of each calculation and the credits, is at{' '}
      <a href="/docs">/docs</a>.
    </p>
    <p className="docs-mark" data-testid="docs-si-marking">
      {/* F23: no repository file paths in the reader's first paragraph; the full page names the files. */}
      SI (AI) use: this panel is a simplified version of the project&apos;s full documentation and its data-source
      register (both at <a href="/docs">/docs</a>). An AI tool, Claude Code, wrote both texts on 14 Nov 2026 and updated
      them on 15 Nov 2026 from the repository&apos;s code and records. The team reviewed this text as a whole on 15 Nov
      2026 (statement of a team member that day, no per-section record). The scientific checks that existed at about 08:50 on 15 Nov 2026 are stated as validated by the science lead on 15 Nov 2026, with no per-check
      sign-off and no record of what was compared; what was built later is not yet validated: see &quot;Validation status&quot; under Limits.
    </p>
  </>
)

export const DOC_SECTIONS: DocSection[] = [
  {
    id: 'doc-question',
    title: 'What the tool answers',
    body: (
      <>
        <p>
          The app is for a mission planner who has to decide which site near the lunar south pole to use, and in which
          period. When a date slips, the planner needs the answer again. The challenge also names educators and the
          public. The app needs no account and no setup.
        </p>
        <p>
          It answers one question: at this site, in this period, when is there sunlight, and when is at least one of
          the selected Earth stations geometrically visible? From there it also answers which of the evaluated sites
          is best for this mission, and which dates would be better.
        </p>
        <p>
          "Station contact" in the app means geometric visibility only: seen from the site, the station is
          above the terrain; seen from the station, the site is at or above the station's minimum elevation. It is not a
          radio link. There is no link budget, frequency, antenna schedule or availability, weather or equipment in
          the model.
        </p>
        <p>The app works for the 18 listed sites and, with approximate numbers, for a custom landing site south of 80° S, for dates from 1 Nov 2026 to 31 Dec 2030.</p>
        <p>
          The existing tools did not answer this question in a timed test on 27 Oct 2026: one produced a wrong answer
          that looked right, two produced no number (<Path>docs/reference/existing-tools.md</Path>, section "timed
          run, 27 Oct 2026").
        </p>
      </>
    ),
  },
  {
    id: 'doc-views',
    title: 'How to read each view',
    body: (
      <>
        <p>
          <strong>Summary and full data.</strong> One &quot;Full data&quot; switch, top right in each panel (Details
          drawer, search, point card, Flight plan panel), sets the mode everywhere. Summary, the default, shows the
          decision values; full data adds breakdowns, raw values, method and sources. The setting is kept in this
          browser.
        </p>
        <p>
          <strong>Header.</strong>
        </p>
        <ul className="docs-list">
          <li>The mission name, with a rocket icon, opens the Mission menu.</li>
          <li>Below it: the site name, its coordinates and, where the site has one, a caveat label.</li>
          <li>The date and time is the cursor time in UTC; it opens the date menu.</li>
          <li>
            Top right: &quot;Points of interest&quot;, &quot;Search&quot; and &quot;Details&quot; (info icon), which
            opens the Details drawer.
          </li>
        </ul>
        <p>
          <strong>3D scene.</strong>
        </p>
        <ul className="docs-list">
          <li>
            Globe: the Moon with one pin per site; click a pin to select it. Site: the terrain around the landing site
            from above. Eye: standing at the site, 1.75 m above the ground.
          </li>
          <li>
            Labels: &quot;Sun&quot; and &quot;Earth&quot; with their elevation in degrees, and &quot;Landing
            site&quot;. A negative elevation means below the horizontal plane; whether terrain hides the body, the
            answer and the horizon strip tell.
          </li>
          <li>
            <Key>Esc</Key> goes to the globe; during a simulation it
            stops it and returns to the landing-site view.
          </li>
          <li>Without WebGL the scene is replaced by the horizon strip.</li>
        </ul>
        <p>
          <strong>Moving the camera.</strong>
        </p>
        <ul className="docs-list">
          <li>Left-drag orbits. Middle-drag looks around from where the camera is.</li>
          <li>
            The wheel or a two-finger pinch moves the camera and stops 1.75 m above the terrain. At eye level it narrows
            the lens instead (54° down to 4°).
          </li>
          <li>There is no eye-level view; a click on the terrain does nothing.</li>
          <li>Hovering or tapping a pin shows its name.</li>
        </ul>
        <p>
          <strong>Viewpoints and points.</strong>
        </p>
        <ul className="docs-list">
          <li>&quot;View&quot;, beside the timeline, lists Landing site and Moon. A right-click on the scene lists Moon.</li>
          <li>
            &quot;Add point here&quot; in the right-click menu, or coordinates typed in the Mission menu, add a user
            point with a name. It is kept in the link.
          </li>
          <li>A user point has no horizon file: the app shows its marker and coordinates, never a value.</li>
        </ul>
        <p>
          <strong>Simulate.</strong> &quot;Simulate&quot;, beside the timeline, plays the mission by the clock. While a
          simulation runs or is paused, a speed slider and &quot;Reset to start&quot; sit beside it. None of the
          camera, viewpoint, point or simulation controls changes the site, the dates or a number.
        </p>
        <p>
          <strong>Answer line (above the timeline).</strong>
        </p>
        <ul className="docs-list">
          <li>First sentence, sunlight: &quot;Sunlight for 3 more days.&quot;, &quot;Dark for 5 more hours.&quot;</li>
          <li>
            Second sentence, station contact in the geometric sense: &quot;Station contact for 9 more hours.&quot;,
            &quot;Next station contact in 2 days.&quot;
          </li>
          <li>
            48 hours or more are given in whole days, shorter times in whole hours. Good time is rounded down and
            waiting time up, so a sentence never promises more than the data.
          </li>
        </ul>
        <p>
          <strong>Timeline.</strong>
        </p>
        <ul className="docs-list">
          <li>Two tracks over the mission, plus three dimmed days before and after for context.</li>
          <li>
            Light: <span className="docs-sun">yellow</span> is sunlit, dark is not. Station contact:{' '}
            <span className="docs-comms">blue</span> is at least one selected station geometrically visible, dark is
            none, hatched is unknown.
          </li>
          <li>
            Drag to move the cursor; click a date to jump to 12:00 UTC that day. <Key>Space</Key> plays and pauses, the
            arrow keys step 30 minutes, with <Key>Shift</Key> one day.
          </li>
        </ul>
        <p>
          <strong>Slope warning.</strong> Shown above the timeline when the site&apos;s slope over the 100 m baseline is
          above 8°: a caution from 8° (the contour NASA&apos;s Artemis III site maps use; what a lander can take depends on
          the vehicle) and &quot;Landing not recommended&quot; above 10°, NASA&apos;s published Artemis III landing
          requirement (surface slope for landing under 10° over 100 m), with a link to the source. The ranking and the
          search keep the team&apos;s own stricter 5° criterion.
        </p>
        <p>
          <strong>Footer.</strong> The terrain and ephemeris sources, &quot;how this is computed&quot;, &quot;Docs&quot;
          (this panel) and &quot;Full documentation&quot;. On wide screens one validation line, worded from the record:
          computed results stated as validated by the science lead, 15 Nov 2026, no per-check sign-off, with a link to the record. On phones the
          same line is in the Details drawer.
        </p>
        <p>
          <strong>Mission menu.</strong> Top to bottom:
        </p>
        <ul className="docs-list">
          <li>&quot;Mission&quot; with &quot;Play mission&quot; (the landing site, first to last mission day).</li>
          <li>Name; start and end date (changing the start keeps the length).</li>
          <li>Science goal.</li>
          <li>
            Landing site: the site ranking for the mission&apos;s dates, stations and goal, in three groups:
            &quot;Passes the 5° slope limit&quot; (ranked), &quot;Too steep to land (slope above 5°)&quot; and
            &quot;Not enough data&quot;. &quot;Best&quot; means best among the 18 evaluated sites for these inputs.
            Your points follow.
          </li>
          <li>Ground stations.</li>
          <li>
            Saved missions: &quot;Compare&quot; opens them in the All sites table; each row has &quot;Calculate
            flight&quot;.
          </li>
          <li>&quot;Calculate flight&quot; for the current mission, and &quot;Add mission&quot; (this browser only; no account).</li>
        </ul>
        <p>
          <strong>Date menu.</strong>
        </p>
        <ul className="docs-list">
          <li>
            &quot;Best periods&quot;: up to five for the mission at its site, found with the default thresholds over the
            mission&apos;s calendar year. Choosing one sets the mission dates.
          </li>
          <li>Five named periods: the team&apos;s test periods, not verified best windows; each says so.</li>
          <li>A field for any UTC date and time in the supported range.</li>
        </ul>
        <p>
          <strong>Details drawer.</strong> Three tabs. Site details: what is true of the landing site (Horizon,
          Stations, Site potential, Landing site assessment, Power and battery estimate, Open in NASA tools, Export, How
          this is computed). Dates: Find better dates and the Year timeline; &quot;Find dates with your own
          limits&quot; in the date menu opens it too. Compare: Compare and All sites, with the saved missions. Under the tabs,
          one line says what the open tab is for; every section of Site details carries one sentence that says what it is
          for, then its current value, and opens with &quot;Show&quot;. The parts:
        </p>
        <ul className="docs-list">
          <li>
            Find better dates: the thresholds of the date search and up to five landing windows with percent sunlit,
            station contact and longest gap. &quot;Show&quot; opens exactly the interval that was scored.
          </li>
          <li>Year timeline: light or station contact over a calendar year, for the current site and each saved mission&apos;s site.</li>
          <li>
            Horizon: the terrain horizon in every direction with the Sun and Earth at the cursor time. Pointing at a
            direction shows the terrain angle, how far away the blocking terrain is, and whether the data ends before
            300 km.
          </li>
          <li>
            Stations: per selected station its state at the cursor time (&quot;line of sight&quot;, &quot;blocked by
            terrain&quot;, &quot;Moon below station mask&quot;), its elevation seen from the site and the Moon&apos;s
            elevation at the station.
          </li>
          <li>
            Compare: the current view next to one other site or named period, with the same stations. &quot;Switch&quot;
            makes it the main view.
          </li>
          <li>
            All sites: every site once, for the mission&apos;s dates or 365 days from its first day; light, station contact or
            both. &quot;Find better location&quot; orders the rows by the site ranking. &quot;Find better dates&quot; on
            another site&apos;s row opens the date search for it. Saved missions follow as rows.
          </li>
          <li>Site potential: sourced statements about the site, each with a category; evidence and source in full data.</li>
          <li>
            Landing site assessment (collapsed; its data is fetched when first opened): slope over the 100 m landing disk and the
            2 km exploration disk, roughness, the nearest permanent shadow and Diviner temperatures, labelled
            &quot;Stated as validated by the science lead on 15 Nov 2026 (no per-check sign-off; see record)&quot;. The 5° and 20°
            thresholds are project criteria set by the team, not NASA or vehicle limits. A custom site shows &quot;Not
            computed for this place&quot;.
          </li>
          <li>
            Power and battery estimate: panel area, cell efficiency, constant load and battery (example values) and one sentence:
            does the battery last through the longest dark window. Marked &quot;First estimate, not a power budget. Stated as validated
            by the science lead on 15 Nov 2026 (no per-check sign-off; see record).&quot;
          </li>
          <li>
            Open in NASA tools: the site in NASA Moon Trek and LROC QuickMap, and JPL Horizons Sun and Earth tables for
            the site over the mission dates.
          </li>
          <li>Export: the windows and the summary as CSV, and a link that reproduces the view.</li>
          <li>
            How this is computed: the site&apos;s source and frame, the terrain and ephemeris sources, the station contact
            definition, and the Terms of use.
          </li>
        </ul>
        <p>
          <strong>Flight plan.</strong> There is no flight tab.
        </p>
        <ul className="docs-list">
          <li>
            &quot;Calculate flight&quot; on a mission opens the flight view with its site, dates, launchpad, rocket and
            surface stay. &quot;Back to landing site&quot; returns.
          </li>
          <li>
            The menu shows the maximum payload ± ε, Δv after launch, launch, landing and mission length, and whether
            every stage has enough propellant. For Blue Moon the lander&apos;s propellant figure is a lower bound.
          </li>
          <li>
            &quot;Find cheapest route&quot; and &quot;Landing dispersion&quot; (a 1σ/3σ tube in the scene) are started
            by the user.
          </li>
          <li>Payload, cheapest route and dispersion are stated as validated by the science lead on 15 Nov 2026 (no per-check sign-off; see record).</li>
        </ul>
        <p>
          <strong>Points of interest layer.</strong>
        </p>
        <ul className="docs-list">
          <li>
            The top-bar button &quot;Points of interest&quot; switches the layer on and off. It is off by default; the
            link has no <Path>poi</Path> setting until it is on.
          </li>
          <li>
            While it is on, a key lists the six groups with their colour, a checkbox and the number of pins. In the link,{' '}
            <Path>poi=all</Path> means every group and <Path>poi=none</Path> means on with no group.
          </li>
          <li>
            The key&apos;s note: &quot;Hover or tap a pin to read about it. Only south of 80° S.&quot; Without a 3D
            view it says that no pins are drawn.
          </li>
          <li>
            A pin&apos;s card sits beside it. Hover shows it; a click or tap keeps it; it closes with &quot;Close&quot;,{' '}
            <Key>Esc</Key> or a press anywhere else. Summary: name, feature type, short bullets and the distance from
            the landing site. Full data: the whole record with its source links.
          </li>
          <li>A right-click outside the south cap gives &quot;Points can be added only south of 80° S.&quot;</li>
        </ul>
        <p>
          <strong>Search sites.</strong>
        </p>
        <ul className="docs-list">
          <li>
            The top-bar button &quot;Search&quot; opens the search panel. Candidates: the sites and the points of
            interest that have a horizon file.
          </li>
          <li>
            Defaults: Water and volatiles, Permanent shadow and Science features; within 20 km (1 to 200 km); &quot;Must
            pass the 5° slope limit&quot; on; rank by Both. The settings are not part of the link; only{' '}
            <Path>drawer=search</Path> is.
          </li>
          <li>
            &quot;Sunlit at least, %&quot; and &quot;Station contact at least, %&quot; say how much sunlight and station contact a
            place must have, as a share of the mission dates (0 = any amount). Places below a minimum are not listed;
            one line says how many.
          </li>
          <li>Records with the same place name within 5 km (1 km for illumination points) are one row.</li>
          <li>
            Each row: rank, &quot;Best&quot; for up to the first 3 ranks, the nearby counts in words, Sunlit, Station contact
            and Slope (&quot;— too steep&quot; when it fails).
          </li>
          <li>
            Every row offers &quot;Show as landing site&quot;. On a site row it selects that site; on a point row it
            makes the point the landing site (a custom landing site) and opens the landing-site view with its group on.
            The point of interest card has the same action. A point outside the custom-site region offers &quot;Show
            on the Moon&quot; instead, which opens the Moon view.
          </li>
          <li>
            Order: rows that pass the slope filter and have a value, places with a value of 0 last, then by groups
            covered, the value, flatter slope and points nearby. &quot;Both&quot; is the smaller of sunlit and coverage.
            Then rows without data, then rows that fail the slope filter.
          </li>
        </ul>
        <p>
          <strong>Documentation view.</strong> The footer link &quot;Docs&quot; opens this short version as a panel (
          <Path>drawer=docs</Path> in the link). &quot;Full documentation&quot; opens the full page at{' '}
          <a href="/docs">/docs</a>, built from the repository&apos;s documentation files.
        </p>
        <p>
          <strong>Custom landing sites.</strong>
        </p>
        <ul className="docs-list">
          <li>
            A place south of 80° S can be the landing site: typed coordinates in the Mission menu, a user point
            (&quot;Set as landing site&quot;) or &quot;Show&quot; in the search. The link holds it with five decimals.
          </li>
          <li>
            Terrain and horizon are computed in the browser from coarser south-cap terrain (40 m and 80 m tiles, a 400 m
            base, a 1920 m outer raster): 720 directions, eye 1.75 m, rays to 300 km.
          </li>
          <li>
            Results are marked &quot;Approximate: from 40 m / 80 m terrain&quot;. Against the 18 listed sites&apos;
            horizons (14 Nov 2026): 0.013° median difference over sites, up to 1.68° in single directions; that can
            move a sunrise or sunset. Stated as validated by the science lead on 15 Nov 2026 (no per-check sign-off; see record).
          </li>
          <li>A custom site is not a row in the site list, the all-sites table or the search.</li>
        </ul>
        <p>
          <strong>Loading and missing data.</strong> While data loads, the answer line says so and the tracks stay
          empty. A site or date without data gives a plain &quot;no data&quot; message. The previous selection&apos;s
          values are never shown under a new selection.
        </p>
      </>
    ),
  },
  {
    id: 'doc-data',
    title: 'Where the data comes from',
    body: (
      <>
        <h4>From raw data to the screen</h4>
        <p>
          Raw NASA data stays outside the repository. Python scripts turn it into small files: JSON, terrain tiles and
          textures. The browser loads these files and computes every result on screen itself. There is no server-side
          computation, no database, no account and no cookie.
        </p>
        <p>
          The ephemeris (the Sun and Earth positions over time) does not depend on the site. The terrain horizon of a
          site does not depend on the date. This split lets the browser combine any listed site with any supported
          dates without a server.
        </p>

        <h4>Sites and stations</h4>
        <p>
          The app has 18 sites. Each site's position is as printed in its source: a representative point of a region.
          Where a source does not name its frame, the Moon Mean Earth / polar axis frame (<Path>MOON_ME</Path>) is
          assumed, and the site's "Frame" line in the app says so. The two sites taken from the NASA Lunar Surface Data
          Book are centre points of terrain-model polygons, not points picked on the terrain (
          <Ext href="https://ntrs.nasa.gov/api/citations/20230007818/downloads/ACD-50044%20Lunar%20Surface%20Data%20Book%20Rev%20A.pdf">
            Data Book
          </Ext>
          , section A2.1).
        </p>
        <p>
          There are 5 Earth antennas to choose from: three of the DSN and two of JAXA.
        </p>

        <h4>Points of interest</h4>
        <p>
          The points of interest come from the research records in <Path>docs/POIs/</Path>: seven research files and{' '}
          <Path>additional-sites.json</Path>, which adds researched points. Each file states its source and its
          coordinate convention.
        </p>
        <ul className="docs-list">
          <li>
            A record becomes a pin only if its geometry is a point and it has at least one source link. Regional
            findings without coordinates are not pins.
          </li>
          <li>
            There are six groups: Hazards, Water and volatiles, Permanent shadow, Sunlit points, Landing candidates and
            Science features. <Path>pgda-study-sites.json</Path> has names only and adds no point.
          </li>
          <li>
            The name, category, summary, facts, evidence, limitations and sources are copied from each record by a fixed
            mapping. The short bullets on a point&apos;s card come from <Path>docs/POIs/plain.json</Path>, written
            from the record.
          </li>
          <li>
            Latitude is planetocentric, south negative; longitude is east-positive, from −180° to 180°. Where a source
            names no frame, <Path>MOON_ME</Path> is assumed.
          </li>
          <li>
            Point coordinates and facts come from the cited research sources and are not individually checked by the
            science lead. The app&apos;s computed results carry the validation status under Limits: stated as validated by the science lead
            on 15 Nov 2026, no per-check sign-off.
          </li>
          <li>
            The app shows only points south of 80° S. On 15 Nov 2026 <Path>pois.json</Path> holds 206 records, of which
            195 lie at or south of 80° S. By group: Landing candidates 88, Permanent shadow 69, Sunlit points 18, Science
            features 16, Water and volatiles 8, Hazards 7.
          </li>
          <li>
            Each point that lies inside the 20 m model gets a terrain horizon, by the same method as the sites, and is
            listed in <Path>search-sites.json</Path>. A point without a horizon file shows "no data" in the search.
          </li>
        </ul>

        <h4>Source list</h4>
        <p>
          These are the raw data files registered for the project in <Path>docs/reference/data-sources.md</Path>.
          Every file matches its expected size. Every SHA-256 checksum was recorded after download and verified again.{' '}
          <Path>de440s.bsp</Path> also matches the{' '}
          <Ext href="https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/aa_checksums.txt">
            MD5 checksum NAIF publishes
          </Ext>
          ; no other file has a published checksum.
        </p>
        <SourceList />
        <p className="docs-quiet">
          Licence of the images: NASA media, including texture maps, are "generally not subject to copyright in the
          United States"; NASA must be acknowledged as the source, and use must not imply endorsement (
          <Ext href="https://www.nasa.gov/nasa-brand-center/images-and-media/">NASA Images and Media Usage Guidelines</Ext>
          , read 14 Nov 2026). Credits for the four image files derived for the app are in{' '}
          <Path>app/public/textures/CREDITS.md</Path>.
        </p>
      </>
    ),
  },
  {
    id: 'doc-method',
    title: 'How the numbers are computed',
    body: (
      <>
        <p>The main steps, in short:</p>
        <p>
          <strong>Coordinates.</strong> Positions on the Moon are planetocentric latitude and east-positive longitude in
          the <Path>MOON_ME</Path> frame, on a sphere of radius 1737.4 km. Site heights are metres above that sphere,
          from the LOLA model. Azimuth is in degrees, 0° = north, clockwise. Elevation is the angle above the local
          horizontal plane, with no refraction. Times are UTC.
        </p>
        <p>
          <strong>Sun and Earth positions.</strong> SPICE gives the positions of the Sun and Earth every 30 minutes,
          corrected for light time and stellar aberration. Between samples the app interpolates. A test compares the
          interpolated values with direct SPICE values: the difference is below 0.001°.
        </p>
        <p>
          <strong>Direction from the site.</strong> The observer stands 1.75 m above the ground at the site. Directions
          to the Sun and Earth are taken from that point, not from the Moon's centre. This accounts for parallax, which
          reaches 0.26° for Earth.
        </p>
        <p>
          <strong>Terrain horizon.</strong> For each of 720 directions, 0.5° apart, a script follows the terrain out to
          300 km. The horizon in that direction is the largest elevation angle along the way. Lunar curvature is
          included. Within 20 km the 20 m model is used at full resolution; beyond it, the model's 160 m overview. Where
          the 20 m model ends (it reaches 80° S), the 120 m model of the same product continues; it reaches 60° S. No
          shipped horizon has a direction that is cut short.
        </p>
        <p>
          <strong>Sunlit and Earth visible.</strong> "Sunlit" means any part of the Sun's disc is above the terrain.
          "Earth visible" means any part of Earth's disc is. The disc sizes use a radius of 695,700 km for the Sun and
          6,371.0 km for Earth. The horizon is taken at the direction of the disc's centre.
        </p>
        <p>
          <strong>Station visibility.</strong> Two conditions must both hold. Seen from the site, the station (its own
          position on Earth, not Earth's centre) is above the terrain horizon. Seen from the station, the site is at or
          above the station's minimum elevation. That minimum is 6.0° for the three DSN antennas (the generic receive
          limit in{' '}
          <Ext href="https://deepspace.jpl.nasa.gov/dsndocs/810-005/301/301P.pdf">DSN 810-005, module 301</Ext>, section
          2.2.3). For the two JAXA antennas it is the highest value of JAXA's own horizon mask: 12.5° and 6.22° (
          <Ext href="https://ddor.nav.isas.jaxa.jp/station_coordinates/">JAXA Station Coordinates</Ext>). When both
          conditions fail, terrain is reported as the reason.
        </p>
        <p>
          <strong>Station contact.</strong> At each moment the state is "covered" if at least one selected station is visible
          (counted once, however many are), "none" if no selected station is, and "unknown" only when an input is
          missing. Unknown is never counted as covered.
        </p>
        <p>
          <strong>Windows and summaries.</strong> The state is checked every minute (every 5 minutes for periods longer
          than 31 days). Each change is then narrowed to ±10 seconds. A run of the same state is one window. The
          summary gives the percent of the period sunlit, with Earth visible, covered and unknown, plus the longest dark
          window and the longest window without coverage, in hours. All are weighted by time.
        </p>
        <p>
          <strong>Find better dates.</strong> Landing times are tried every 30 minutes, from the mission start to 60 days
          later. Each candidate mission is scored on 30-minute samples against four thresholds: minimum percent sunlit,
          minimum percent coverage, longest contact gap and longest darkness. The defaults are a 14-day mission, 70 %
          sunlit, 50 % coverage, a longest contact gap of 48 h and a longest darkness of 72 h. They are proposed defaults, and
          all can be edited. Neighbouring candidates that qualify are merged into one landing window. Windows are
          ranked by coverage, then percent sunlit, then date. If nothing qualifies, the app shows the nearest miss and
          the thresholds it fails.
        </p>
        <p>
          <strong>Slope and the 5° limit.</strong> A site's slope is taken over a 100 m baseline: the heights 50 m east,
          west, north and south of the site on the 20 m model. A site passes at 5.0° or less and fails above it; without
          a value it is unknown. The 5° is the team's project criterion, not a sourced NASA or vehicle limit.
        </p>
        <p>
          <strong>Site ranking.</strong> First the slope limit filters the sites. Those that pass are ordered by the
          rule of the chosen science goal, then by coverage, then by percent sunlit. "Consistent light" orders by
          percent sunlit, then by the shortest longest darkness. "Water ice", "Cold traps" and "Science targets" order by
          the best evidence label among the site's sourced entries for that goal: direct measurement, remote
          observation, modeled condition, hypothesis, unknown. "Any" orders by coverage. There is no weighted score.
          The keys are compared one after another, so each row's place can be checked by hand. Ties share a rank and
          are named.
        </p>
        <p>
          <strong>Power and battery estimate.</strong> First estimate, not a power budget; stated as validated by the science lead on 15 Nov 2026 (no per-check sign-off; see record). One
          panel that always faces the Sun gives S × A × η × f × (AU / r)²: S = 1361 W/m² at 1 AU (
          <Ext href="https://doi.org/10.1029/2010GL045777">Kopp &amp; Lean 2011</Ext>), A the panel area, η the cell
          efficiency, f the visible share of the Sun&apos;s disc, r the distance to the Sun (AU from
          {' '}<Ext href="https://ssd.jpl.nasa.gov/astro_par.html">JPL Solar System Dynamics</Ext>). A constant load and
          a battery give the answer: does the battery last through the longest dark window.
        </p>
        <p>
          <strong>Rocket flight.</strong> Launch, transfer under Earth, Moon and Sun gravity, lunar orbit, a finite-burn
          descent and the return. Its results never enter a site value. Maximum payload, the cheapest route and the
          landing dispersion with the Moon&apos;s J2 term are stated as validated by the science lead on 15 Nov 2026 (no per-check sign-off; see
          record).
        </p>
        <p>
          <strong>3D scene.</strong> The scene shows the same geometry; it is not a source of numbers. The Sun, Earth
          and stars are drawn at their true directions and true angular sizes. Lit and dark are never taken from
          rendered shadows. At eye level the terrain silhouette is the computed horizon.
        </p>
      </>
    ),
  },
  {
    id: 'doc-limits',
    title: 'Limits',
    body: (
      <>
        <h4>Not modelled</h4>
        <ul className="docs-list">
          <li>A radio link: no link budget, frequency, antenna schedule or availability, weather or equipment.</li>
          <li>
            Relay satellites, and stations other than the five listed. ESA ESTRACK antennas are not included: no
            sourced minimum elevation was found.
          </li>
          <li>Horizon masks of the stations per direction. One minimum elevation per antenna is used.</li>
          <li>
            Precise Earth orientation. The <Path>IAU_EARTH</Path> frame is an approximation.
          </li>
          <li>Power beyond a first estimate: one Sun-facing panel and a constant load; no temperature, degradation, dust, tilt or partial shading. Stated as validated by the science lead on 15 Nov 2026 (no per-check sign-off; see record).</li>
          <li>Temperature over a mission period. Only annual mean and annual maximum exist, in the site assessments.</li>
          <li>Boulders and obstacles. They are below the resolution of the terrain models and are reported as unknown.</li>
          <li>
            Routes and access. Only a straight-line slope check to the nearest shadow cluster exists, in the site
            assessments.
          </li>
          <li>Landing safety. Passing the 5° slope limit is one criterion on one measurement.</li>
          <li>
            Terrain beyond 80° S at 20 m detail. There the horizon uses the 120 m model, coarser than the 20 m model used
            near the site. This matters for IM-1 only, which lies about 4 km from the edge of the 20 m model: its
            skyline to the north-north-east (52 of 720 directions) comes from 120 m data.
          </li>
          <li>The change of the horizon across the width of a disc. The horizon is taken at the disc centre's direction.</li>
          <li>Scattered light, earthshine and heat from surrounding terrain, as inputs to any result.</li>
          <li>Arbitrary coordinates outside the south cap. A place south of 80° S can be set as a custom landing site; its numbers are approximate (see &quot;Custom landing sites&quot; under &quot;How to read each view&quot;). North of 80° S only the listed sites can be analysed.</li>
          <li>
            Launch, transfer and descent in the site analysis. The Flight plan panel computes them separately; its
            result does not enter any site value or ranking. Its flight plans leave out the Moon&apos;s uneven gravity
            (its J2 term is in the landing dispersion only).
          </li>
          <li>Uncertainty of the site results: errors of the terrain model are not propagated. The budget of every number shown is in <Path>docs/scientific-proof/uncertainty.md</Path>.</li>
        </ul>

        <h4>Resolution of each result</h4>
        <div className="docs-table">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Result</th>
                <th scope="col">Holds at</th>
              </tr>
            </thead>
            <tbody>
              {RESOLUTION.map(([result, holds]) => (
                <tr key={result}>
                  <th scope="row">{result}</th>
                  <td>{holds}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h4>Validation status</h4>
        <p>
          <strong>What was checked.</strong> One row per check recorded in <Path>docs/event/validation.md</Path>, with
          the status wording of that file; the science lead&apos;s statement below covers every row. Tolerances are
          those of the build plan unless the row says otherwise.
        </p>
        <div className="docs-table">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Check: what against what</th>
                <th scope="col">Points</th>
                <th scope="col">Largest difference</th>
                <th scope="col">Tolerance</th>
                <th scope="col">Who ran it, when</th>
                <th scope="col">Status in the record</th>
              </tr>
            </thead>
            <tbody>
              {CHECKS.map((c) => (
                <tr key={c.check}>
                  <th scope="row">{c.check}</th>
                  <td>{c.points}</td>
                  <td>{c.largest}</td>
                  <td>{c.tolerance}</td>
                  <td>{c.who}</td>
                  <td>{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          <strong>Every check that existed at about 08:50 on 15 Nov 2026: stated as validated by the science lead on 15 Nov 2026 (no per-check sign-off; see record).</strong> On 15 Nov
          2026, about 08:50, in chat with the build session, the science lead stated &quot;validated everything means
          EVERYTHING&quot;, including what had been built that day by then. <Path>docs/event/validation.md</Path> records it in the
          section &quot;Validation status 15 Nov&quot;, one row per check. The statement does not say what was compared
          against what, and no item has a sign-off written by the science lead. Since 16 Nov 2026, by the science
          lead&apos;s decision, the app therefore says &quot;stated as validated&quot; and not &quot;validated&quot; until the record is signed. The app's switch{' '}
          <Path>VALIDATED</Path> was set to true on 14 Nov 2026 by team decision, after an independent recomputation by
          an AI tool agreed with the app. Before that, every value carried the marker "sample values — not validated".
        </p>
        <p>
          <strong>Built after the statement: not yet validated by the science lead.</strong> The SLS Block 1 parking orbit
          as flown on Artemis I (built 15 Nov 2026, 21:20; its results are marked), the &quot;If the mission
          slips&quot; rows and the year rows as displayed, the slope warning thresholds as displayed (8° and 10°), and the
          terrain shadow and lighting rendering choices in the 3D view. The computations beneath the rows and the slope
          warning existed before the statement. The record also lists two input figures as open decisions (ICPS dry mass,
          Orion mass through the injection). Post-deadline fix, 16 Nov 2026: the terrain cast shadows (16 Nov 2026) and
          this wording change were made after the event&apos;s submission deadline.
        </p>
        <p>
          What that file recorded before the statement, copied on 15 Nov 2026. That file is the
          record.
        </p>
        <ul className="docs-list">
          <li>
            V1, 10 site and time points against JPL Horizons, tolerance 0.05°: passed, as reported by a team member in
            chat on 14 Nov 2026, 15:56; no written sign-off. In the recorded inputs (20 rows: Sun and Earth, two sites,
            five times each) the largest difference is 0.0000° in azimuth and 0.0001° in elevation.
          </li>
          <li>
            V2, one row by hand (Sun elevation near the pole ≈ −(sub-solar latitude)): passed, reported the same way;
            no written sign-off. From the Horizons sub-solar point for 14 Nov 2026 12:00 UTC, the spherical formula
            gives an elevation of 1.4376° at Connecting Ridge; the pipeline gives 1.4369°; the difference is 0.0007°.
          </li>
          <li>
            Station check, Moon elevation at two DSN stations against Horizons: open. In 10 values at Madrid DSS-54 and
            Canberra DSS-34 the largest difference is 0.0763°. The tolerance, and whether the <Path>IAU_EARTH</Path>{' '}
            approximation is acceptable, are not decided.
          </li>
          <li>
            Station check: open. An AI recheck on 15 Nov found a worst difference of 0.0782° over all five stations.
          </li>
          <li>
            V3 to V9, the horizon-range check and the truncated-horizon check: open. AI rechecks agree for synthetic
            horizons, window edges, interface values, coarse terrain and truncated horizons; the finder missed a window
            with its old 6-hour grid and now tries landing times every 30 minutes; panel types were not built.
          </li>
          <li>
            The science lead&apos;s statement that the flight physics are validated (14 Nov 2026, 20:59) is recorded
            in <Path>BUILD_LOG.md</Path>, not in <Path>docs/event/validation.md</Path>; who validated them against
            what is not recorded. Everything built on 15 Nov 2026 (maximum payload, cheapest route, landing
            dispersion, power estimate) was not yet validated before the statement of 15 Nov.
          </li>
        </ul>
        <p>
          The recorded inputs for these checks were filled in by an SI tool; they are not a sign-off. Automated tests
          show that the code does what it was written to do. They are not scientific validation.
        </p>
      </>
    ),
  },
  {
    id: 'doc-ai',
    title: 'How AI was used',
    body: (
      <>
        <p>
          <Path>docs/documentation.md</Path> and <Path>docs/reference/data-sources.md</Path> record these uses of SI
          (AI) tools:
        </p>
        <ul className="docs-list">
          <li>
            <strong>This documentation.</strong> Written and simplified for this panel by Claude Code on 14 and 15 Nov
            2026, as marked at the top. Reviewed as a whole by the team on 15 Nov 2026 (statement of a team member that
            day, no per-section record).
          </li>
          <li>
            <strong>Independent recomputation.</strong> An independent recomputation by an SI tool agreed with the app.
            On that basis the team set the switch <Path>VALIDATED</Path> to true on 14 Nov 2026. This is not a sign-off
            by the science lead.
          </li>
          <li>
            <strong>Check records.</strong> The recorded inputs for V1, V2 and the station check were filled in by an
            SI tool. They are not a sign-off.
          </li>
          <li>
            <strong>Data downloads.</strong> Claude Code downloaded the SPICE, elevation and illumination files on 1 Nov
            2026, the set a team member had confirmed on 28 Oct 2026. On 14 Nov 2026 it downloaded the 120 m elevation
            model and the three Diviner files, each after a team member approved the download.
          </li>
        </ul>
      </>
    ),
  },
]
