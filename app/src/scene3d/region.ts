// The part of the Moon where the terrain model exists and user points can be placed: the south polar cap.
// One constant shared by the scene (highlight on the globe, terrain coverage) and the views ("Add point here").

/** Northern edge of the cap, planetocentric latitude in degrees. Set with the south-cap terrain data. */
export const PIN_REGION_NORTH_LAT = -80

export const inPinRegion = (lat: number) => lat <= PIN_REGION_NORTH_LAT
