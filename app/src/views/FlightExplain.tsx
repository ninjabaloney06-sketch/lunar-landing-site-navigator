// The explanatory sections of the Flight plan panel: why the halo orbit looks the way it does and what it costs
// and buys, how Apollo and Artemis land, how long crews stay on the surface, and the glossary.
// Plain text with its sources; where the plan computed a number, that number is shown beside the
// published one. Each export is the content of one collapsible section of FlightPanel.
import type { ReactNode } from 'react'
import type { ArchitectureSpec } from '../flight/hardware'
import type { MissionPlan, SourceRef } from '../flight/types'
import { burnName, fmtDays, fmtKms } from './flightFormat'
import { Abbr, GLOSSARY, GLOSSARY_GROUPS, GLOSSARY_SOURCES } from './flightGlossary'

type Rendezvous = ArchitectureSpec['rendezvous']

// ---------- sources ----------

const S = {
  capstone: { label: 'NASA: CAPSTONE Launches to Test New Orbit for NASA’s Artemis Moon Missions (2022)', url: 'https://www.nasa.gov/news-release/capstone-launches-to-test-new-orbit-for-nasas-artemis-moon-missions/' },
  justRight: { label: 'NASA: A Lunar Orbit That’s Just Right for the International Gateway (2022)', url: 'https://www.nasa.gov/missions/artemis/lunar-near-rectilinear-halo-orbit-gateway/' },
  lee: { label: 'Lee: Gateway Destination Orbit Model, a Continuous 15 Year NRHO Reference Trajectory (NASA, 2019)', url: 'https://ntrs.nasa.gov/citations/20190030294' },
  whitley: { label: 'Whitley, Martinez: Options for Staging Orbits in Cis-Lunar Space (NASA, 2015)', url: 'https://ntrs.nasa.gov/citations/20150019648' },
  mahajan: { label: 'Mahajan, Condon: HLS NRHO to Lunar Surface and Back Mission Design (NASA, 2022)', url: 'https://ntrs.nasa.gov/citations/20230002566' },
  moonFacts: { label: 'NASA: Moon Fact Sheet (the Moon’s period around Earth)', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html' },
  pause: { label: 'NASA: NASA Unveils Initiatives to Achieve America’s National Space Policy (24 March 2026)', url: 'https://www.nasa.gov/news-release/nasa-unveils-initiatives-to-achieve-americas-national-space-policy/' },
  landers2028: { label: 'NASA: NASA, Partners Accelerate Lander Development for 2028 Moon Missions (23 October 2026)', url: 'https://www.nasa.gov/missions/artemis/nasa-partners-accelerate-lander-development-for-2028-moon-missions/' },
  artemis3: { label: 'NASA: Artemis III, NASA’s First Human Mission to the Lunar South Pole (2023, the plan with the halo orbit)', url: 'https://www.nasa.gov/missions/artemis/artemis-iii/' },
  a11Orbit: { label: 'NASA: Apollo by the Numbers, Apollo 11 lunar orbit phase', url: 'https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_11g_Lunar_Orbit_Phase.htm' },
  a11Home: { label: 'NASA: Apollo by the Numbers, Apollo 11 transearth phase', url: 'https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_11h_Transearth_Phase.htm' },
  a11Summary: { label: 'NASA: Apollo by the Numbers, Apollo 11 summary (Sun angle at landing)', url: 'https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_11a_Summary.htm' },
  a11Lm: { label: 'NASA NSSDCA: Apollo 11 Lunar Module (stay, the two stages, batteries)', url: 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1969-059C' },
  houbolt: { label: 'NASA: John C. Houbolt (lunar orbit rendezvous)', url: 'https://www.nasa.gov/centers-and-facilities/langley/john-c-houbolt/' },
  elm: { label: 'NASA: Apollo Lunar Lander Module Design, OCHMO-TB-022 (Extended Lunar Module)', url: 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-022-apollo-lunar-lander.pdf' },
  a15: { label: 'NASA: Apollo 15 Mission Details', url: 'https://www.nasa.gov/missions/apollo/apollo-15-mission-details/' },
} satisfies Record<string, SourceRef>

function Sources({ list }: { list: SourceRef[] }) {
  // A design's own sources and the ones of the text can name the same page: each is listed once.
  const unique = list.filter((s, i) => s.url && list.findIndex((x) => x.url === s.url) === i)
  return (
    <ul className="plain flight-sources" aria-label="Sources">
      {unique.map((s) => (
        <li key={s.url}>
          <a href={s.url} target="_blank" rel="noreferrer">
            {s.label}
          </a>
        </li>
      ))}
    </ul>
  )
}

/** A line of the plan's own numbers, set apart from the published ones. */
function PlanLine({ children }: { children: ReactNode }) {
  return (
    <p className="flight-own">
      <span className="flight-own-tag">This plan</span>
      {children}
    </p>
  )
}

// ---------- what a plan spent, by craft ----------

interface PlanSums {
  design: string
  capsule: { name: string; dvKms: number }[] // the capsule's burns after the trans-lunar injection
  capsuleDvKms: number
  landerDvKms: number
  /** The lander's burns between the halo orbit and low lunar orbit, down and up; null in a design without them. */
  transfer: { downKms: number; upKms: number } | null
  stayDays: number
}

function sumsOf(plan: MissionPlan): PlanSums {
  const burns = plan.events.filter((e) => e.kind === 'burn' && e.dvKms !== null)
  const capsule = burns
    .filter((e) => e.craft === 'capsule' && e.id !== 'ascent' && e.id !== 'tli' && e.dvKms! >= 0.0005)
    .map((e) => ({ name: burnName(e), dvKms: e.dvKms! }))
  const sum = (ids: string[]) => burns.filter((e) => ids.includes(e.id)).reduce((s, e) => s + e.dvKms!, 0)
  const down = sum(['lander-nrd', 'lander-loi'])
  const up = sum(['llo-departure', 'lander-nri'])
  return {
    design: plan.architecture.name,
    capsule,
    capsuleDvKms: capsule.reduce((s, b) => s + b.dvKms, 0),
    landerDvKms: burns.filter((e) => e.craft === 'lander').reduce((s, e) => s + e.dvKms!, 0),
    transfer: down > 0 || up > 0 ? { downKms: down, upKms: up } : null,
    stayDays: plan.facts.surfaceStayDays,
  }
}

// The last plan of each kind computed in this session, so that a halo-orbit plan can be set beside a low-orbit
// one (and the other way round) once the reader has looked at both designs.
const lastSums = new Map<Rendezvous, PlanSums>()

export function rememberPlan(rendezvous: Rendezvous, plan: MissionPlan): void {
  lastSums.set(rendezvous, sumsOf(plan))
}

const capsuleLine = (s: PlanSums) => `${s.capsule.map((b) => `${b.name} ${b.dvKms.toFixed(2)}`).join(' + ')} = ${fmtKms(s.capsuleDvKms)}`

// ---------- the halo orbit ----------

export function HaloOrbit({ plan, rendezvous }: { plan: MissionPlan | null; rendezvous: Rendezvous }) {
  const own = plan && rendezvous === 'nrho' ? sumsOf(plan) : null
  const low = rendezvous === 'nrho' ? lastSums.get('llo') : plan ? sumsOf(plan) : lastSums.get('llo')
  const f = plan?.facts
  const int = (v: number) => Math.round(v).toLocaleString('en-US')
  return (
    <div className="flight-prose">
      {rendezvous !== 'nrho' && <p className="quiet">The design chosen above does not use this orbit. Choose an Artemis design to see it in the 3D view.</p>}
      <h4>What it is</h4>
      <p>
        A near-rectilinear halo orbit (<Abbr>NRHO</Abbr>) is not an orbit around the Moon alone. It is a path balanced between the pull of Earth and
        the pull of the Moon. The one NASA chose for its Gateway station comes within about 1,600 km of the Moon over the north pole and swings out to
        about 70,000 km over the south pole, once every six and a half days.
      </p>
      {own && f && (
        <PlanLine>
          {int(f.lunarPeriluneKm)} × {int(f.lunarApoluneKm)} km above the surface, inclined {f.lunarInclDeg.toFixed(1)}° to the Moon’s equator.
        </PlanLine>
      )}
      <h4>Why it looks like a long loop over the poles</h4>
      <p>
        The orbit stands almost at right angles to the Moon’s equator, so the craft passes over the poles instead of around the middle. It is very
        stretched: the craft rushes past the north pole in hours and then spends most of the week far out over the south pole. That is the long
        loop.
      </p>
      <h4>Why the path coils in this view</h4>
      <p>
        The orbit closes on itself only for an observer who turns with the line from Earth to the Moon, because it is that line the orbit is balanced
        on. This view does not turn: its directions are fixed to the stars, and the lines near the Moon travel along with the Moon. While the craft
        goes round once (6.56 days), the Moon moves on by about 86° of its 27.3-day path around Earth, and the loop turns with it. Each revolution
        is therefore drawn turned against the one before, and several of them fan out like a rosette. Nothing is being corrected there: it is one
        steady orbit, seen from a frame that does not turn with it.
      </p>
      <h4>What it buys</h4>
      <ul>
        <li>
          <strong>Orion can get in and out.</strong> Orion’s service module was built for about 1.25 km/s of <Abbr>Δv</Abbr> in total. A 100 km low lunar
          orbit costs about 0.9 km/s to enter and about 0.9 km/s to leave: Orion could enter it but not come home. The halo orbit costs about
          0.84 km/s for both (Whitley and Martinez).
        </li>
        <li>
          <strong>Constant contact.</strong> From the halo orbit Earth is always in view. A craft in low lunar orbit is behind the Moon about half of
          the time.
        </li>
        <li>
          <strong>Cheap to hold.</strong> Under 10 m/s per year of small corrections, against 50 m/s or more in low lunar orbit.
        </li>
        <li>
          <strong>The poles in reach.</strong> Every revolution passes over the poles, where Artemis wants to land.
        </li>
        <li>
          <strong>Sunlight.</strong> Nine revolutions fit into two months of the Moon’s phases, and the orbit is timed so that it almost never passes
          through Earth’s shadow (Lee).
        </li>
      </ul>
      {own && <PlanLine>The capsule’s burns after <Abbr>TLI</Abbr>: <Abbr>{capsuleLine(own)}</Abbr>.</PlanLine>}
      {low ? (
        <p className="flight-own">
          <span className="flight-own-tag">{rendezvous === 'nrho' ? 'Your last low-orbit plan' : 'This plan'}</span>
          {low.design}: the capsule’s burns after <Abbr>TLI</Abbr>: <Abbr>{capsuleLine(low)}</Abbr>.
        </p>
      ) : (
        <p className="quiet">Choose the Apollo design once to see what the same trip costs a capsule that goes to low lunar orbit.</p>
      )}
      <p>
        Apollo 11 for comparison: 889 m/s and 48 m/s to enter and round its low orbit, 999 m/s to leave it (2,917.5, 158.8 and 3,279.0 ft/s).
      </p>
      <h4>What it costs</h4>
      <ul>
        <li>
          <strong>The lander does the work instead.</strong> It has to fly from the halo orbit down to a low orbit and back up, about 0.73 km/s and half
          a day each way, on top of the landing and the ascent.
        </li>
        <li>
          <strong>A timetable.</strong> The lander can leave for the surface and come back only around the close pass, once per revolution. A stay
          therefore lasts about six days, or about thirteen, and a crew that has to leave early can wait days for the capsule.
        </li>
        <li>
          <strong>Distance.</strong> In Apollo the mother ship passed overhead every two hours. Here it is up to 70,000 km away.
        </li>
      </ul>
      {own?.transfer && (
        <PlanLine>
          The lander’s burns between the two orbits: {fmtKms(own.transfer.downKms)} down, {fmtKms(own.transfer.upKms)} up. All lander burns:{' '}
          {fmtKms(own.landerDvKms)}.
        </PlanLine>
      )}
      <h4>So is it the best way?</h4>
      <p>
        It is the best orbit for a capsule with Orion’s engine and for a station that is to stay for years: the cheapest place near the Moon that
        Orion can reach and leave, always in contact with Earth. It is not the cheapest way to land. Counted in <Abbr>Δv</Abbr>, 0.84 km/s for the
        capsule and about 0.73 km/s each way for the lander is more than the 1.8 km/s of a low orbit, and the larger share falls on the lander.
      </p>
      <p>
        NASA has since changed the plan. In March 2026 it paused the Gateway, and in October 2026 it said that Orion and the landers will no longer
        meet in the halo orbit: Starship is to take Orion along to low lunar orbit, and Blue Moon is to meet Orion in an elliptical polar orbit. The
        Artemis designs in this tab show the plan as it stood before.
      </p>
      <Sources list={[S.capstone, S.lee, S.whitley, S.justRight, S.mahajan, S.moonFacts, S.a11Orbit, S.a11Home, S.pause, S.landers2028]} />
    </div>
  )
}

// ---------- Apollo and Artemis: two ways to land ----------

export function LandingWays({ plan, rendezvous }: { plan: MissionPlan | null; rendezvous: Rendezvous }) {
  const own = plan ? sumsOf(plan) : null
  const other = lastSums.get(rendezvous === 'nrho' ? 'llo' : 'nrho')
  const line = (s: PlanSums) =>
    `${s.design}: capsule after TLI ${fmtKms(s.capsuleDvKms)}, lander ${fmtKms(s.landerDvKms)}, ${fmtDays(s.stayDays, 1)} on the surface.`
  return (
    <div className="flight-prose">
      <h4>Apollo: one launch, a small lander in two stages</h4>
      <p>
        One Saturn V carries everything. The Command and Service Module (<Abbr>CSM</Abbr>) and the Lunar Module (<Abbr>LM</Abbr>) fly to the Moon
        docked, and the <Abbr>CSM</Abbr>’s engine brakes both into a low orbit about 110 km up. Two of the three astronauts go down in the{' '}
        <Abbr>LM</Abbr>. Its descent stage lands them and then serves as the launch platform: only the small ascent stage lifts off, meets the{' '}
        <Abbr>CSM</Abbr> in lunar orbit and is cast off. The <Abbr>CSM</Abbr>’s engine then sends the crew home. This is lunar orbit rendezvous:
        only the small lander goes down, so far less has to be braked onto the Moon and lifted off it again.
      </p>
      <h4>Artemis, as shown here: two ships that meet at the Moon</h4>
      <p>
        The lander is launched on its own, without a crew, and goes ahead. Starship is first refilled in Earth orbit from a depot that tanker flights
        fill. It waits in the halo orbit. Then one <Abbr>SLS</Abbr> sends Orion with four astronauts to that orbit: Orion never goes down to a low
        orbit, because its engine could not bring it back from there. Two of the crew change over, and the lander flies down to a low orbit, lands,
        lifts off again in one piece and climbs back to Orion. Orion brings everyone home.
      </p>
      <table className="tbl flight-compare">
        <thead>
          <tr>
            <th scope="col" />
            <th scope="col">Apollo</th>
            <th scope="col">Artemis, as shown here</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Launches</th>
            <td>One Saturn V</td>
            <td>
              One <Abbr>SLS</Abbr> for the crew; the lander and its propellant separately
            </td>
          </tr>
          <tr>
            <th scope="row">Lander</th>
            <td>Two stages, the lower one stays on the Moon</td>
            <td>One stage that lands and comes back whole</td>
          </tr>
          <tr>
            <th scope="row">Where they meet</th>
            <td>Low lunar orbit, about 110 km up, 2 hours per revolution</td>
            <td>Halo orbit, up to 70,000 km out, 6.5 days per revolution</td>
          </tr>
          <tr>
            <th scope="row">Who brakes at the Moon</th>
            <td>The capsule’s engine, for both craft</td>
            <td>Each craft for itself; the lander also flies between the two orbits</td>
          </tr>
          <tr>
            <th scope="row">Crew</th>
            <td>2 of 3 land</td>
            <td>2 of 4 land</td>
          </tr>
          <tr>
            <th scope="row">On the surface</th>
            <td>21 to 75 hours</td>
            <td>About 6.5 days</td>
          </tr>
        </tbody>
      </table>
      {own && <PlanLine><Abbr>{line(own)}</Abbr></PlanLine>}
      {other && (
        <p className="flight-own">
          <span className="flight-own-tag">Your last plan of the other kind</span>
          <Abbr>{line(other)}</Abbr>
        </p>
      )}
      <p>
        In 2026 NASA changed how Orion and the landers meet (see “The halo orbit”): the first landing is now planned for Artemis IV, with a meeting in
        Earth orbit or in an elliptical lunar orbit, depending on the lander.
      </p>
      <Sources list={[S.houbolt, S.a11Lm, S.a11Orbit, S.a11Home, S.artemis3, S.whitley, S.pause, S.landers2028]} />
    </div>
  )
}

// ---------- time on the surface ----------

const NSSDCA = 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id='

// Touchdown to liftoff. NASA NSSDCA, the page of each Lunar Module; Apollo 17 to the second from Apollo by the
// Numbers (NASA SP-2000-4029), the figure the Apollo design in this tab takes as its longest stay.
const APOLLO_STAYS: [mission: string, stay: string, url: string][] = [
  ['Apollo 11', '21 h 36 min', `${NSSDCA}1969-059C`],
  ['Apollo 12', '31 h 31 min', `${NSSDCA}1969-099C`],
  ['Apollo 14', '33 h 31 min', `${NSSDCA}1971-008C`],
  ['Apollo 15', '66 h 55 min', `${NSSDCA}1971-063C`],
  ['Apollo 16', '71 h 2 min', `${NSSDCA}1972-031C`],
  ['Apollo 17', '74 h 59 min 40 s', 'https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_17a_Summary.htm'],
]

export interface SurfaceStayProps {
  plan: MissionPlan | null
  rendezvous: Rendezvous
  askedDays: number
  stay: ArchitectureSpec['surfaceStay']
}

export function SurfaceStay({ plan, rendezvous, askedDays, stay }: SurfaceStayProps) {
  return (
    <div className="flight-prose">
      <h4>How long Apollo stayed</h4>
      <table className="tbl flight-stays">
        <thead>
          <tr>
            <th scope="col">Mission</th>
            <th scope="col" className="flight-num">
              Touchdown to liftoff
            </th>
          </tr>
        </thead>
        <tbody>
          {APOLLO_STAYS.map(([mission, time, url]) => (
            <tr key={mission}>
              <th scope="row">
                <a href={url} target="_blank" rel="noreferrer">
                  {mission}
                </a>
              </th>
              <td className="flight-num mono">{time}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Less than a day at first, three days at the end. Apollo 13 did not land. The Lunar Module ran on batteries and was built for a short
        visit. From Apollo 15 on, the Extended Lunar Module, with a stronger descent engine and more storage, allowed almost three days. The time
        of day was fixed as well: Apollo 11 had to land with the Sun 5° to 14° above the horizon behind it, in the lunar morning, so that long
        shadows showed the ground. Such a window came once every 29.5 days.
      </p>
      <h4>Artemis</h4>
      <p>
        The plan with the halo orbit foresaw about 6.5 days on the surface. That number is not a choice: the lander can come back only when the orbit
        passes the Moon again, every 6.56 days, so a stay is one revolution less the flight down and up (6.1 to 6.2 days in NASA’s mission design),
        or two revolutions.
      </p>
      {plan && (
        <PlanLine>
          Asked for {fmtDays(Number(askedDays.toFixed(2)))}, the plan stays {fmtDays(plan.facts.surfaceStayDays, 2)}
          {rendezvous === 'nrho' ? ': the nearest whole number of halo-orbit revolutions.' : '.'}
        </PlanLine>
      )}
      {stay && (
        <p>
          <strong>The stay this design starts with: {fmtDays(Number(stay.defaultDays.toFixed(2)))}</strong>
          {stay.maxDays !== null && ` (longest: ${fmtDays(Number(stay.maxDays.toFixed(2)))})`}. <Abbr>{stay.basis}</Abbr>
        </p>
      )}
      <Sources list={[...(stay?.sources ?? []), S.a11Lm, S.elm, S.a15, S.a11Summary, S.artemis3, S.mahajan]} />
    </div>
  )
}

// ---------- glossary ----------

export function Glossary() {
  return (
    <div className="flight-prose" data-testid="flight-glossary">
      {GLOSSARY_GROUPS.map((group) => (
        <section key={group.id}>
          <h4>{group.title}</h4>
          <dl className="flight-glossary">
            {GLOSSARY.filter((g) => g.group === group.id).map((g) => (
              <div key={g.term}>
                <dt className="mono">{g.term}</dt>
                <dd>
                  <strong>{g.name}.</strong> {g.meaning}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <Sources list={GLOSSARY_SOURCES} />
    </div>
  )
}
