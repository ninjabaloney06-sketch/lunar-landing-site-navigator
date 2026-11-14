# scene3d/ — Track C1 (build-plan §5.4). No angle-triple rotations, no hand-written matrices, no trig here.

Angles go through geometry/ (frames.ts wraps siteVector/azEl); the only matrix is makeBasis(east, north, up).
Test page: /src/scene3d/harness.html?test=1 (dev server only). Debug API: debug.ts. fps counter: ?debug=1.
Keys: the scene binds none. App.tsx maps E/Esc to setLevel; the harness binds E (site → eye) and Esc (eye → site → globe).
Terrain differs by level (site.ts header): site = tile + skirt, eye = tile + mask ring (silhouette = mask).
With extra levels (levels.ts; terrain/<id>-fine|mid|far, listed in the 80 m meta): fine 20 m ⊂ 80 m tile ⊂ mid 400 m
⊂ far 2 km to ±300 km, square holes + zipper strips, no skirt; eye = levels + crest strip on the mask.
Without them (meta has no `levels`, or no far file) the 80 m tile renders exactly as before.
