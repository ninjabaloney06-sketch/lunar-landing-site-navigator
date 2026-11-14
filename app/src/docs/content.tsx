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
    about: <>Used for the site assessments of 7 sites, which are computed but not shown in the app.</>,
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
    'Found numerically to ±10 s on the interpolated model; events shorter than 1 min (5 min for periods over 31 days) can be missed. This is the numerical resolution, not a validated accuracy: the window-edge check V5 is open',
  ],
  ['Find better dates', '30-minute samples; landing times 6 hours apart'],
  ['Station geometry', 'Moon elevation at a station differs from JPL Horizons by up to 0.0763° in the 10 recorded values (station check open)'],
  ['Site position', "As printed in each site's source, a representative point of a region; frame assumed where the source does not name it"],
  ['Site slope (5° limit)', 'One value per site over a 100 m baseline on the 20 m model, stored to 0.1°'],
  ['3D terrain', '20 m within ±2.5 km, 80 m within ±20 km, 400 m within ±60 km, 2 km within ±300 km; for viewing only'],
]

// ---------- the sections, in reading order ----------

export const DOC_INTRO = (
  <>
    <p className="docs-lede">
      What the Lunar Landing Site Navigator answers, how to read it and where its numbers come from. This page
      describes the app as it was on 14 Nov 2026. Team SFZ | MEXG, NASA Space Apps 2026, local event Heilbronn.
    </p>
    <p className="docs-mark" data-testid="docs-si-marking">
      SI marking: <Path>docs/documentation.md</Path> was drafted by an SI (AI) tool, Claude Code, on 14 Nov 2026 from
      the repository's code and records. It awaits review by the team (code checks against behaviour; science lead
      for the validation part). This in-app version is a simplified version of <Path>docs/documentation.md</Path> and{' '}
      <Path>docs/reference/data-sources.md</Path>, made by an SI (AI) tool, Claude Code, on 14 Nov 2026.
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
          "Comms" and "station contact" in the app mean geometric visibility only: seen from the site, the station is
          above the terrain; seen from the station, the site is at or above the station's minimum elevation. It is not a
          radio link. There is no link budget, frequency, antenna schedule or availability, weather or equipment in
          the model.
        </p>
        <p>The app works for the 18 listed sites only, and for dates from 1 Nov 2026 to 31 Dec 2030.</p>
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
        <p className="docs-quiet">
          Some parts of the app were added after this description was written; they are listed in{' '}
          <Path>BUILD_LOG.md</Path>.
        </p>
        <p>
          <strong>Header (top left).</strong> The mission name, with a rocket icon, opens the Mission panel. Below it
          are the site name, its coordinates and, where the site has one, a caveat label (for example a reference point
          that is not a landing site). The date and time shown is the cursor time in UTC; it opens the date menu.
        </p>
        <p>
          <strong>3D scene.</strong> There are three levels. Globe: the Moon with one pin per site; click a pin to
          select that site. Site: the terrain around the landing site, seen from above. Eye: the view of a person
          standing at the site, 1.75 m above the ground. Labels sit on the objects: "Sun" and "Earth" with their
          elevation in degrees, and "Landing site". A negative elevation means below the horizontal plane. Whether the
          body is hidden depends on the terrain, which the answer sentences and the horizon strip tell. <Key>E</Key>{' '}
          switches between site and eye level; <Key>Esc</Key> goes back to the globe. Without WebGL the scene is
          replaced by the horizon strip.
        </p>
        <p>
          <strong>Moving the camera.</strong> Left-drag orbits. Middle-drag looks around from where the camera is. The
          wheel or a two-finger pinch moves the camera along the view and stops 1.75 m above the terrain. At eye level
          it narrows the lens instead (54° down to 4°), and the Sun and Earth keep their computed angular size. A
          left-click on the terrain at site or eye level moves the camera to stand on that spot. Hovering or tapping a
          pin shows its name.
        </p>
        <p>
          <strong>Viewpoints and points.</strong> "View", beside the timeline, and a right-click on the scene list the
          viewpoints: Moon, Point start, Point end, Earth, Sun and "Solar system — top view". The top view looks down
          the Moon's +z axis; it is not to scale, and it is marked so. "View" also lists Landing site and Eye level, so
          a phone needs no keyboard. "Add point here" in the right-click menu, or coordinates typed in the Mission
          panel, add a user point with a name and an optional role (Start, End). The point is kept in the link. A user
          point has no horizon file, so the app shows its marker, its coordinates and "No terrain data for this point",
          never a value.
        </p>
        <p>
          <strong>Simulate.</strong> "Simulate", beside the timeline, plays the mission by the clock. The speed and
          "Reset to start" are in the Details drawer. None of the camera, viewpoint, point or simulation controls
          changes the site, the dates or a number: the labels and the answer always describe the landing site.
        </p>
        <p>
          <strong>Answer line (above the timeline).</strong> Two sentences for the cursor time. The first is about
          sunlight ("Sunlight for 3 more days.", "Dark for 5 more hours."). The second is about station contact in the
          geometric sense ("Station contact for 9 more hours.", "Next station contact in 2 days."). Durations of 48
          hours or more are given in whole days, shorter ones in whole hours. Good time is rounded down and waiting
          time up, so a sentence never promises more than the data.
        </p>
        <p>
          <strong>Timeline.</strong> Two tracks over the mission, plus three dimmed days before and after for context.
          Light: <span className="docs-sun">yellow</span> is sunlit, dark is not. Comms:{' '}
          <span className="docs-comms">blue</span> is at least one selected station geometrically visible, dark is
          none, hatched is unknown. The bracket marks the mission with its name and length. Drag to move the cursor;
          click a date to jump to that day at 12:00 UTC. <Key>Space</Key> plays and pauses, the arrow keys step 30
          minutes, and with <Key>Shift</Key> one day.
        </p>
        <p>
          <strong>Slope warning.</strong> Shown above the timeline only when the selected site fails the 5° slope
          limit, with the measured slope and the 100 m baseline.
        </p>
        <p>
          <strong>Footer.</strong> The terrain and ephemeris sources in one line, and a link to "how this is computed".
        </p>
        <p>
          <strong>Mission panel.</strong> Fields in this order: name; start and end date (changing the start keeps the
          length); science goal; landing site; ground stations; Play mission. The landing-site list is the site ranking
          for the mission's own dates, stations and goal. It has three groups: "Passes the 5° slope limit" (ranked,
          with rank numbers), "Too steep to land (slope above 5°)" and "Not enough data". Each row shows the values it
          was ranked by: percent lit, percent comms, slope and, for evidence goals, the evidence label with its source
          link. "Best" here means best among the 18 evaluated sites for these inputs. Play mission moves the cursor
          from the first to the last mission day at eye level. "Add mission" saves a mission in this browser only;
          there is no account.
        </p>
        <p>
          <strong>Date menu.</strong> Five named periods and a field for any date and time in the supported range. The
          named periods are the team's test periods, not verified best windows; each says so.
        </p>
        <p>
          <strong>Details drawer (gear button, top right).</strong> One scrolling panel with these parts:
        </p>
        <ul className="docs-list">
          <li>
            Horizon: the terrain horizon in every direction (N, E, S, W) with the Sun and Earth at the cursor time. A
            body below the plotted range is pinned to the bottom edge as a hollow dot and keeps its true value in the
            label. Pointing at a direction shows the terrain angle there, how far away the blocking terrain is, and
            whether the terrain data ends before 300 km.
          </li>
          <li>
            Stations: one row per selected station with its state at the cursor time ("line of sight", "blocked by
            terrain", "Moon below station mask"), its elevation seen from the site and the Moon's elevation at the
            station.
          </li>
          <li>
            Find better dates: the thresholds of the date search and up to five landing windows with percent sunlit,
            coverage and longest gap. "Show" opens exactly the interval that was scored.
          </li>
          <li>
            Compare: the current view next to one other site or named period, with the same stations: sunlit, station
            coverage, unknown, longest darkness, longest coverage gap. "Switch" makes the compared choice the main
            view.
          </li>
          <li>
            All sites: one table with every site once, for the mission's own dates or a whole year of 365 days from its
            first day. The columns show both (sunlit, station coverage), light (sunlit, longest darkness) or comms
            (station coverage, longest coverage gap). "Find better location" orders the rows by the site ranking for
            the mission's science goal, with rank numbers; sites above the slope limit and sites without data follow,
            unranked. "Find better dates" on a row opens the date search for that site. Checked rows show their sunlit
            windows as tracks on one time axis. Saved missions follow as rows, each for its own site, dates and
            stations. A site without a horizon file shows "no data".
          </li>
          <li>
            Site potential: sourced statements about the site, each with a category, an evidence label and a source
            link. Access is not assessed.
          </li>
          <li>Export: the windows and the summary as CSV, and a link that reproduces the view.</li>
          <li>
            How this is computed: the site's source and frame, the terrain and ephemeris sources, the comms definition,
            and the Terms of use.
          </li>
        </ul>
        <p>
          <strong>Points of interest layer.</strong> The top-bar button "Points of interest" switches the layer on and
          off. It is off by default, so a first visit shows the plain scene, and the link has no <Path>poi</Path>{' '}
          setting until the layer is on. While it is on, a key under the top bar lists the six groups with their
          colour, a checkbox per group and, once the data has loaded, the number of pins in each group. The data is
          fetched the first time the layer or the search opens. In the link, <Path>poi=all</Path> means every group and{' '}
          <Path>poi=none</Path> means on with no group. The key's note says "Hover or tap a pin to read about it."; with
          no 3D view it says that no pins are drawn. Both end with "Only south of 80° S. From research notes, not
          validated by the science lead."
        </p>
        <p>
          A pin's info box: with a mouse it shows while the pointer is on the pin and stays while the pointer moves onto
          it. A click on the pin, or a tap, keeps it open. A kept box closes with its "Close" button, <Key>Esc</Key>, a
          press anywhere else, or a camera move away from it. It shows the group and coordinates, the name, the summary,
          the record's facts, "Evidence", "Limitations", the caveat about research notes, and the source links, each
          shown by its host name. A right-click outside the south cap gives "Points can be added only south of 80° S."
        </p>
        <p>
          <strong>Search sites.</strong> The top-bar button "Search" opens the search panel. Its candidates are the
          sites and the points of interest that have a horizon file. Until the points of interest are loaded, the panel
          says "Loading the points of interest…". The defaults: the groups Water and volatiles, Permanent shadow and
          Science features (Hazards, Landing sites and Sunlit points are off); "Within, km" 20 (the field accepts 1 to
          200 km); "Must pass the 5° slope limit" on; "Rank by" Both. The search settings are not part of the link;
          only <Path>drawer=search</Path> is.
        </p>
        <p>
          Each row shows its rank once the list is ordered, "Best" for the first 3 rows (more when tied), the count of
          each chosen group within the radius, Sunlit, Coverage and Slope ("— too steep" when it fails the limit). A
          site row offers "Select". A point row offers "Show" only, which opens the globe with the point's group
          switched on. A group's count is the number of its points within the radius (inclusive), measured along a
          1737.4 km sphere; a candidate's own record is not counted.
        </p>
        <p>
          The order: first the rows that meet the slope filter and have a value, by the number of chosen groups
          covered, then by the number of points nearby, then by that value, the most first each time. For "Both" the
          value is the sunlit percentage plus the coverage percentage; no other weighted score is used. Equal keys share
          a rank (1, 1, 3). Then come the rows that meet the slope filter but have no data, then the rows that fail it.
          With the slope filter off, every row counts as meeting it. Sunlit and Coverage are the values of the
          comparison table for the mission dates; a place without a horizon file shows "no data". The list appears once
          every row is computed; until then the panel shows "Computing X of N places for these dates…".
        </p>
        <p>
          <strong>Documentation view.</strong> The footer link "Docs" opens this documentation as a panel (
          <Path>drawer=docs</Path> in the link). It is loaded as a separate part of the app the first time it is
          opened.
        </p>
        <p>
          <strong>Loading and missing data.</strong> While data loads, the answer line says so and the tracks stay
          empty. A site or date without data gives a plain "no data" message. The previous selection's values are never
          shown under a new selection.
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
          <Path>additional-sites.json</Path>, which adds researched points. Each file states its source, its coordinate
          convention and its validation status.
        </p>
        <ul className="docs-list">
          <li>
            A record becomes a pin only if its geometry is a point and it has at least one source link. Regional
            findings without coordinates are not pins.
          </li>
          <li>
            There are six groups: Hazards, Water and volatiles, Permanent shadow, Sunlit points, Landing sites and Science
            features. <Path>pgda-study-sites.json</Path> has names only and adds no point.
          </li>
          <li>
            The name, category, summary, facts, evidence, limitations and sources are copied from each record by a fixed
            mapping. Nothing is reworded.
          </li>
          <li>
            Latitude is planetocentric, south negative; longitude is east-positive, from −180° to 180°. Where a source
            names no frame, <Path>MOON_ME</Path> is assumed.
          </li>
          <li>
            These are research notes, not validated by the science lead. Landing records carry the note that their
            coordinates still need a check.
          </li>
          <li>
            The app shows only points south of 80° S. On 14 Nov 2026 <Path>pois.json</Path> holds 206 records, of which
            195 lie at or south of 80° S. By group: Landing sites 88, Permanent shadow 69, Sunlit points 18, Science
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
          <strong>Coverage.</strong> At each moment the state is "covered" if at least one selected station is visible
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
          <strong>Find better dates.</strong> Landing times are tried every 6 hours, from the mission start to 60 days
          later. Each candidate mission is scored on 30-minute samples against four thresholds: minimum percent sunlit,
          minimum percent coverage, longest coverage gap and longest darkness. The defaults are a 14-day mission, 70 %
          sunlit, 50 % coverage, a longest coverage gap of 48 h and a longest darkness of 72 h. They are proposed defaults, and
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
          <li>Power. Sunlit is yes or no; there is no solar-panel model and no partial-disc power value.</li>
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
          <li>Arbitrary coordinates. Only the 18 listed sites can be analysed.</li>
          <li>Launch, transfer, descent and any trajectory.</li>
          <li>Uncertainty. No error bars are computed; errors of the terrain model are not propagated.</li>
          <li>
            Site assessments (slope statistics, roughness, shadow clusters, temperature) are computed for all 18 sites
            but not yet shown in the app.
          </li>
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
          <strong>No check carries a written sign-off by the science lead.</strong> The app's switch{' '}
          <Path>VALIDATED</Path> was set to true on 14 Nov 2026 by team decision, after an independent recomputation by
          an SI tool agreed with the app. Before that, every value carried the marker "sample values — not validated".
        </p>
        <p>
          Copied from <Path>docs/event/validation.md</Path> on 14 Nov 2026 with their status. That file is the
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
            V3 to V9 (synthetic horizons, real horizons against PGDA averages, window edges, coarse terrain, values in
            the user interface, finder, panel types): open.
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
            <strong>This documentation.</strong> Drafted, and simplified for this page, by Claude Code, as marked at the
            top. The original awaits review by the team.
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
