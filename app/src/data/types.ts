// Data contracts, build-plan §3 + Brief A station extension + Brief B site potential.
// Change only with I + S agreeing. Track A is the only track that edits this file.
export type Vec3 = [number, number, number]
export type Quat = [number, number, number, number] // (x, y, z, w)

export interface SitePotential {
  category: 'water-ice' | 'cold-trap' | 'illumination' | 'science' | 'other'
  text: string
  // 'unknown' = the explicit entry for a site without site-specific evidence (Brief B step 3b)
  evidence: 'direct measurement' | 'remote observation' | 'modeled condition' | 'hypothesis' | 'unknown'
  source_url: string
}

export interface Site {
  id: string
  name: string
  group: 'artemis-2024' | 'artemis-2022' | 'clps' | 'commercial' | 'international' | 'apollo' | 'reference'
  label: string | null // caveat shown under the name, e.g. "Blue Moon MK1 target" (ninja, 14 Nov; Leo to confirm)
  lat: number
  lon: number
  frame_note: string
  elev_m: number | null
  slope_deg: number | null
  far_side: boolean
  source_url: string
  source_label: string
  horizon: string | null
  potential: SitePotential[]
}

export interface Horizon {
  site_id: string
  lat: number
  lon: number
  elev_m: number
  observer_height_m: number
  az_step: number
  mask: number[]
  mask_dist_km: number[]
  ray_max_km: number
  truncated: number[]
  dem: string
  slope_deg?: number // written by horizon.py for sites.py
}

export interface EphemMonth {
  start_utc: string
  step_min: number
  n: number
  frame: 'MOON_ME'
  correction: 'LT+S'
  sun_km: Vec3[]
  earth_km: Vec3[]
  q_me_to_j2000: Quat[]
  q_earth_to_me: Quat[]
  kernels: string[]
}

export interface Period {
  id: string
  label: string
  start_utc: string
  end_utc: string
  reason: string
}

export interface Station {
  id: string
  name: string
  network: 'DSN' | 'ESTRACK' | 'JAXA'
  complex: string
  lat_deg: number
  lon_deg: number // east-positive
  h_m: number
  datum: string
  min_elev_deg: number
  source_url: string
  source_label: string
  link_state_inputs: 'unknown'
}

// Terrain tile (Track B writes, C1 reads): terrain/<id>.bin = size × size Int16, row-major.
// Sample (row i, col j) sits at x_east_m = (j - (size-1)/2) * spacing_m, y_north_m = ((size-1)/2 - i) * spacing_m.
export interface TerrainMeta {
  site_id: string
  size: number // 500
  spacing_m: number // 80
  order: string // "row-major; row 0 = north edge; col 0 = west edge"
  height_ref: string // "metres relative to the site's ground height"
  nodata: number // -32768
  illum_png: string | null // file in terrain/, same grid and orientation
  illum_map: string | null // e.g. "avgvisib_85s_060m_201608"
  illum_res_m: number | null
  dem: string
  // Optional extra levels (track-terrain, 14 Nov): terrain/<id>-<level>.json/.bin, same grid convention,
  // Int16 format, nodata and height reference. Absent fields = the 80 m tile alone, rendered as before.
  level?: 'fine' | 'mid' | 'far' // set on a level file; absent on the 80 m tile
  levels?: string[] // on the 80 m tile: the level files that exist for this site
  ground_m?: number // the one reference height (m above 1737.4 km) every level of the site is relative to
  height_scale_m?: number // metres per Int16 unit (levels: 0.1–1); absent = 1
  resampling?: string // how a level was sampled from the DEM
  fill_dem?: string // far level: dataset used outside the polar DEM
  fill_fraction?: number // far level: share of samples taken from fill_dem
}

export interface TerrainTile {
  meta: TerrainMeta
  heights: Int16Array
  levels?: TerrainTile[] // the 80 m tile's extra levels (load.ts), finest first; absent = none
}
