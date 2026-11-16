# scene3d/ — Track C1 (build-plan §5.4). No angle-triple rotations, no hand-written matrices, no trig here.

Angles go through geometry/ (scene3d/frames.ts wraps siteVector/azEl); the only matrix is makeBasis(east, north, up).
Test page: /src/scene3d/harness.html?test=1 (dev server only). Debug API: debug.ts. fps counter: ?debug=1.
Keys: the scene binds none. App.tsx maps E/Esc to setLevel; the harness binds E (site → eye) and Esc (eye → site → globe).
Terrain differs by level (site.ts header): site = tile + skirt, eye = tile + mask ring (silhouette = mask).
With extra levels (levels.ts; terrain/<id>-fine|mid|far, listed in the 80 m meta): fine 20 m ⊂ 80 m tile ⊂ near 160 m
(when built, F2 below) ⊂ mid 400 m ⊂ far 2 km to ±300 km, square holes + zipper strips, no skirt; eye = levels + crest strip on the mask.
Without them (meta has no `levels`, or no far file) the 80 m tile renders exactly as before.
Camera input (controls.ts, Brief C4): OrbitControls keeps the left drag and one-finger drag; middle-drag looks around
from the camera's position, wheel and pinch dolly along the view (speed ∝ distance to the nearest surface, floor 1.75 m
above terrain, 1 km above the Moon sphere in space) and change the field of view at eye level (4°–54°, bodies unscaled).
Walk (note 6; 15 Nov: double-click only, within 20 km): a double left-click (< 5 px each) on terrain at site or eye level flies the camera to stand there, 1.75 m up, and
ends at eye level; camera only (sky, labels and numbers stay the landing site's); beyond 20 km from the site (the reach of the fine terrain) it is ignored.
Viewpoints (Brief C4 part 2; U14, 15 Nov): handle.goTo('moon') only. The point start / end, Earth, Sun and
solar-system top viewpoints were removed.
goTo('moon') during a fly (16 Nov) is not refused: a fly down to a site turns back from where it is, a fly through
space is redirected, any other one ends first; onLevel reports 'globe' at once (e2e/goto-moon-during-fly.spec.ts).
Eye level (U5, U16, U19): one placement, index.ts eyeAt(): 1.75 m above site.groundZ, the drawn triangles of the
finest level under the camera (levels.ts surfaceZ), not the bilinear data height; settleEye() re-places the camera
when the terrain is rebuilt (the near level arrives later).
User points (part 3): handle.setMarkers(points): square-headed pins on the globe, and in the site scene where the 80 m
tile has terrain under them. handle.named() gives the hovered or tapped pin's name; handle.onMenu the right-click.
Easing (scene track, 14 Nov): the orbit drag, the middle-drag, the wheel and the pinch all apply the share
1 − e^(−dt/160 ms) of what is pending per frame (controls.ts RESPONSE_MS), so they ease alike at any frame rate and
come to rest after the release. In test mode nothing eases and the animation clock stands still;
__scene.setAnimated(true) turns the easing on and __scene.advance(ms) is one frame (e2e/scene-motion.spec.ts).
Terrain light (S2; terrain shadows since 16 Nov, sunlight.ts): the terrain casts its own shadows. For the Sun of the
frame, shadowmap.ts computes on the GPU, per sample of every terrain level, how high the shadow of the terrain ahead
stands above the ground (three rays: the Sun's lower limb, centre and upper limb; curvature is in the heights), and
the terrain shader takes the share of the Sun's disc above that horizon per fragment, so shadow edges follow the
relief and are penumbras. It runs when the Sun or the terrain changes, not per frame (5 passes per level; while the
time plays, half of the levels per frame).
shadows.ts is the same on the CPU (direct march; __scene.sunShareAt, the unit tests). At the marker the picture
follows the computed mask: the terrain's horizon is shifted by the difference at the site with a round falloff
(250 m scale), which is nothing where they agree (sunlight-seams.test.ts measures how often they do not). Surface
brightness: half Lommel–Seeliger, half Lambert (no wrapped cosine any more). Ground the Sun does not reach gets no
direct sunlight; it keeps earthshine (Earth's disc at the site, unshadowed) and a fill for sunlight scattered from
the sunlit terrain around (even part + a part from the anti-solar side; display levels, site.ts). A change of the
site's own level eases over 500 ms (index.ts LIGHT_EASE_MS); directions, shadows and computed numbers are never
eased. The globe has no such switch. Without half-float render targets the terrain is drawn without cast shadows.
Flights (S3): a fly owns its camera; OrbitControls.update() is not called while one runs (it used to pull the
camera back onto its orbit every frame: the globe → site fly stopped 3000 km from the Moon's centre and cut, the
walk jumped to its end). The fly between the globe and the site (index.ts startDescent, 2.4 s) goes around the
Moon on a great circle with the height falling geometrically, turns into the site view as it arrives, and
cross-dissolves the two scenes drawn from the same pose (dissolve.ts); back is the same path reversed.
Points of interest (S4): handle.setPois(pois) draws every given POI on the globe (pins.ts: instanced, three draw
calls for any number; landing records with the site-pin shape, the others a camera-facing triangle on a short
stem). At site and eye level only those within POI_NEAR_KM (60 km, pins.ts) of the current site are drawn,
together with the other landing sites within that distance, each standing on the loaded terrain. named()
reports a hovered or tapped POI with its poiId; a site pin wins over a user point, a user point over a POI.
Pin region (S5): on the globe the cap south of region.ts PIN_REGION_NORTH_LAT is marked by a 1.5 px line on its
boundary and a 9 % tint, both unlit in the colour of the user points and built from geometry.siteVector at the
constant's latitude (globe.ts buildRegion). Picking is unchanged; the views decide where a point may be added.
Zoom limits (S6): the wheel's outer limit is around the nearest body (20 000 km from the Moon's centre, the same
11.5 radii for Earth and the Sun), not around the scene origin. A trackpad pinch (wheel + ctrlKey) zooms by e^(−deltaY/100).
Moon label anchor (S8): project('moon') and labelPoint('moon') give the Moon's centre (top edge once its disc is
wider than 40 px) where the camera is farther from the Moon than the globe view goes (20 000 km, after a free
zoom out), visible: false off screen or behind Earth or the Sun; null elsewhere.
Bodies hiding each other (S9): of Earth and the Sun the sky layer draws the one nearer to the observer in front;
one that is nearer than the Moon (at its own viewpoint) is drawn after the Moon, over it. project() and
labelPoint() report visible: false for the Sun, Earth or Moon whose centre is behind another body.
After the review (14 Nov): a click on another site's pin on the globe makes the fly wait for that site's frame
(at most 2 s) instead of starting toward the old site; an orbit glide and eased wheel or look input are dropped
when a fly starts or a camera is placed; each scene is drawn once before the fly between them starts, so the
first fly does not stall on uploads; the globe's site pins are rebuilt only for another list of sites.
POI pins have a 1.5 px dark outline (pins.ts: three more instanced meshes); at site and eye level a left-click
on a POI's pin is not a walk (the page keeps its info box open on it).
Site switch (15 Nov night): at site and eye level a click (or second tap) on another landing site's pin selects that
site through onPick with its own coordinates, as on the globe (click.ts siteLevelClick); before, the click fell through
to the walk and nothing happened. e2e/site-switch.spec.ts covers pins, the header picker, rapid switches and Play.
Zoom past a limit (15 Nov night, zoomSwitch.ts): after handle.setZoomSwitch(true) (the app; the harness leaves it off)
more zoom-in at the Moon view's floor opens the landing-site view and more zoom-out at the site view's 60 km limit
goes back to the Moon view, through setLevel, reported by onLevel. It takes three wheel notches' worth (ln 0.384) in at
least three inputs no more than 500 ms apart; after a switch nothing counts for 1.5 s and until the input has paused
250 ms. Eye level is unchanged. e2e/zoom-switch.spec.ts.
Wave 3 (14 Nov evening):
F3 camera at rest: OrbitControls.update() rebuilds the camera from spherical coordinates on every call, and the round
trip moved a camera at rest by a unit in the last place (c4.spec.ts:210 once saw 9.09e-13 m). tick() calls it only
while the controls have input to apply (index.ts orbitBusy); a glide below 1e-9 rad ends.
F2 near level: 160 m to ±40 km (501 × 501) between the 80 m tile and mid, 2 × 2 means of the south-cap 80 m tiles
(data/southcap.ts nearLevel), relative to the site's own ground_m. A prepared site's files have none: index.ts
requestNear builds it after the site is shown and rebuilds the terrain once (after a fly, never during one); a custom
point's cap terrain has it among its levels. 15–28 tiles (2.0–3.7 MB) per site. In test mode only after
__scene.nearLevel(true); __scene.nearReady() resolves when the current site's job has ended. Level normals come from
the grids and blend across each rim band like the heights (levels.ts levelNormals); data next to a nodata fill (im-1:
the polar DEM ends 4 km north of the site) blend into the fill over the same band. tileHeight applies height_scale_m.
F1 south polar cap on the globe: once data/southcap.ts loadCap() resolves, globe.ts swaps the sphere for
globeWithoutCap() and adds capGeometry() (400 m relief, cap_color_2k.webp) south of 80° S; without the cap data the
whole sphere stays, and the checker texture always shows the whole sphere. Within 120 km of the rim
(southcap.ts RIM_SHADING_KM) the cap's normals fade into the normal the sphere's normal map gives there (three's
cotangent frame reproduced in matchRimNormals), so 80° S does not show as a ring. Site pins, user points and POIs
stand on the drawn relief (capSurfacePoint), the pin region's tint is mixed into the cap's own pixels by its shader
(the overlay's 9 %, so it lies exactly on the relief; the boundary line stays at the rim, where the cap is on the
sphere), picking and the right-click hit test both meshes, and the space camera's floor is 1 km above the relief. In test mode
handle.ready waits for the cap, so every test sees the same globe.
