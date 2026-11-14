import type { Launchpad } from './types'

// Coordinates are geodetic (WGS84-style), decimal degrees, longitude east-positive (west is negative).
// Sources: Wikipedia infobox coordinates (allowed for launch-pad coordinates), except starbase (Launch Library 2).
export const LAUNCHPADS: Launchpad[] = [
  {
    id: 'ksc-39b',
    name: 'LC-39B',
    site: 'Kennedy Space Center, USA',
    // Wikipedia infobox: "28°37′38″N 80°37′15″W / 28.62722°N 80.62083°W"
    latDeg: 28.62722,
    lonDeg: -80.62083,
    source: {
      label: 'Wikipedia: Kennedy Space Center Launch Complex 39B (infobox)',
      url: 'https://en.wikipedia.org/wiki/Kennedy_Space_Center_Launch_Complex_39B',
    },
  },
  {
    id: 'kourou-ela4',
    name: 'ELA-4',
    site: 'Guiana Space Centre, French Guiana',
    // Wikipedia infobox: "5°15′54″N 52°47′31″W / 5.265°N 52.792°W"
    latDeg: 5.265,
    lonDeg: -52.792,
    source: {
      label: 'Wikipedia: ELA-4 (infobox)',
      url: 'https://en.wikipedia.org/wiki/ELA-4',
    },
  },
  {
    id: 'tanegashima-yoshinobu',
    name: 'Yoshinobu (LA-Y)',
    site: 'Tanegashima Space Center, Japan',
    // Wikipedia infobox: "30°24′08″N 130°58′30″E / 30.40222°N 130.97500°E"
    latDeg: 30.40222,
    lonDeg: 130.975,
    source: {
      label: 'Wikipedia: Yoshinobu Launch Complex (infobox)',
      url: 'https://en.wikipedia.org/wiki/Yoshinobu_Launch_Complex',
    },
  },
  {
    id: 'wenchang-lc101',
    name: 'LC-101',
    site: 'Wenchang Space Launch Site, China',
    // Wikipedia launch-pads section, LC-101: "19°36′52.17″N 110°57′4.08″E / 19.6144917°N 110.9511333°E"
    latDeg: 19.6144917,
    lonDeg: 110.9511333,
    source: {
      label: 'Wikipedia: Wenchang Space Launch Site (LC-101 coordinates)',
      url: 'https://en.wikipedia.org/wiki/Wenchang_Space_Launch_Site',
    },
  },
  {
    id: 'baikonur-site81',
    name: 'Site 81 (Proton)',
    site: 'Baikonur Cosmodrome, Kazakhstan',
    // Wikipedia infobox, whole Site 81 (not an individual pad): "46°04′15″N 62°59′05″E / 46.07083°N 62.98472°E"
    latDeg: 46.07083,
    lonDeg: 62.98472,
    source: {
      label: 'Wikipedia: Baikonur Cosmodrome Site 81 (infobox, whole site)',
      url: 'https://en.wikipedia.org/wiki/Baikonur_Cosmodrome_Site_81',
    },
  },
  {
    id: 'starbase',
    name: 'Orbital Launch Pad 2',
    site: 'SpaceX Starbase, Texas, USA',
    // Launch Library 2 pad record 235: latitude 25.99677, longitude -97.15799 (not an agency source)
    latDeg: 25.99677,
    lonDeg: -97.15799,
    source: {
      label: 'Launch Library 2 (The Space Devs): pad 235 Orbital Launch Pad 2',
      url: 'https://lldev.thespacedevs.com/2.3.0/pads/235',
    },
  },
]

export const DEFAULT_PAD_ID = 'ksc-39b'
