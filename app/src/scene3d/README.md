# scene3d/ — Track C1 (build-plan §5.4). No angle-triple rotations, no hand-written matrices, no trig here.

Angles go through geometry/ (frames.ts wraps siteVector/azEl); the only matrix is makeBasis(east, north, up).
Test page: /src/scene3d/harness.html?test=1 (dev server only). Debug API: debug.ts. fps counter: ?debug=1.
