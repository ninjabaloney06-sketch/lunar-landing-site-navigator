// Data contracts, build-plan §3. Change only with I + S agreeing.
export type Vec3 = [number, number, number]
export type Quat = [number, number, number, number]

export interface Site {
  id: string
  name: string
  group: 'artemis-2024' | 'artemis-2022' | 'clps' | 'commercial' | 'international' | 'apollo'
  lat: number
  lon: number
  frame_note: string
  elev_m: number | null
  slope_deg: number | null
  far_side: boolean
  source_url: string
  source_label: string
  horizon: string | null
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
