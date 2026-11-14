# scene3d/ — Track C1 (build-plan §5.4). No angle-triple rotations, no hand-written matrices, no trig here.

Angles go through geometry/ (frames.ts wraps siteVector/azEl); the only matrix is makeBasis(east, north, up).
Test page: /src/scene3d/harness.html?test=1 (dev server only). Debug API: debug.ts. fps counter: ?debug=1.
Keys: the scene binds none. App.tsx maps E/Esc to setLevel; the harness binds E (site → eye) and Esc (eye → site → globe).
Terrain differs by level (site.ts header): site = tile + skirt, eye = tile + mask ring (silhouette = mask).
With extra levels (levels.ts; terrain/<id>-fine|mid|far, listed in the 80 m meta): fine 20 m ⊂ 80 m tile ⊂ mid 400 m
⊂ far 2 km to ±300 km, square holes + zipper strips, no skirt; eye = levels + crest strip on the mask.
Without them (meta has no `levels`, or no far file) the 80 m tile renders exactly as before.
Camera input (controls.ts, Brief C4): OrbitControls keeps the left drag and one-finger drag; middle-drag looks around
from the camera's position, wheel and pinch dolly along the view (speed ∝ distance to the nearest surface, floor 1.75 m
above terrain, 1 km above the Moon sphere in space) and change the field of view at eye level (4°–54°, bodies unscaled).
Walk (note 6): a left-click (< 5 px) on terrain at site or eye level flies the camera to stand there, 1.75 m up, and
ends at eye level; camera only (sky, labels and numbers stay the landing site's); beyond 60 km from the site it is ignored.
Viewpoints (Brief C4 part 2): handle.goTo('moon'|'start'|'end'|'earth'|'sun'|'top'). Earth and Sun reuse the sky layer
(true direction and angular size from the camera's position, 5.5 radii out); 'top' is topview.ts, not to scale.
User points (part 3): handle.setMarkers(points): square-headed pins on the globe, and in the site scene where the 80 m
tile has terrain under them. handle.named() gives the hovered or tapped pin's name; handle.onMenu the right-click.
Easing (scene track, 14 Nov): the orbit drag, the middle-drag, the wheel and the pinch all apply the share
1 − e^(−dt/160 ms) of what is pending per frame (controls.ts RESPONSE_MS), so they ease alike at any frame rate and
come to rest after the release. In test mode nothing eases and the animation clock stands still;
__scene.setAnimated(true) turns the easing on and __scene.advance(ms) is one frame (e2e/scene-motion.spec.ts).
Terrain light (S2): at site and eye level the sunlight is the share of the Sun's disc above the mask at the eye
(geometry.discFraction, the app's own number, read only), from full down to 12 %, plus an even night fill that
takes over as the disc goes; earthshine follows Earth's disc the same way. A change eases over 500 ms
(index.ts LIGHT_EASE_MS); directions and computed numbers are never eased. The globe has no such switch.
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
11.5 radii for Earth and the Sun), not around the scene origin, which blocked one direction at the Earth and Sun
viewpoints depending on the Moon's phase. A trackpad pinch (wheel + ctrlKey) zooms by e^(−deltaY/100).
Body viewpoints over time (S7): after goTo('earth'|'sun') the camera and its orbit target move with the body's
centre on every update(frame), so the body stays in place in the picture and the zoom is kept; any other
viewpoint or level ends it.
Moon label anchor (S8): project('moon') and labelPoint('moon') give the Moon's centre (top edge once its disc is
wider than 40 px) where the camera is farther from the Moon than the globe view goes (20 000 km: the Earth and
Sun viewpoints and the flights to them), visible: false off screen or behind Earth or the Sun; null elsewhere.
Bodies hiding each other (S9): of Earth and the Sun the sky layer draws the one nearer to the observer in front;
one that is nearer than the Moon (at its own viewpoint) is drawn after the Moon, over it. project() and
labelPoint() report visible: false for the Sun, Earth or Moon whose centre is behind another body.
After the review (14 Nov): a click on another site's pin on the globe makes the fly wait for that site's frame
(at most 2 s) instead of starting toward the old site; an orbit glide and eased wheel or look input are dropped
when a fly starts or a camera is placed; each scene is drawn once before the fly between them starts, so the
first fly does not stall on uploads; the globe's site pins are rebuilt only for another list of sites.
