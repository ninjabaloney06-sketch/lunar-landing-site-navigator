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
