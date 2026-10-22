# Front page hero picture

The picture beside the front page's headline is a 3D render made in Blender. Its screens and cards show
the HTML in `src/components/home/HeroScreens.jsx`, captured as textures. Re-render it when those
change, for example after a redesign of the client's or the student's project page.

There are two versions, both in `public/home`:

- `hero-topdown-*.webp`: looking down onto the stand, like Microsoft's Outlook picture
- `hero-level-*.webp`: the camera slightly below, the stand as a ledge (on the site now: its screens read more clearly)

To switch, change `const HERO = RENDERS.level;` in `src/components/home/HomeHero.jsx` to
`RENDERS.topdown` (each carries its own sizing).

## Re-rendering

You need Blender 5.2 (the portable zip from blender.org works), Chrome, and Python with Pillow (the
backend's venv has it).

1. Start the frontend dev server (`npm run dev`). It serves the screens laid out flat on
   `/dev/hero-textures`, a page that only exists in development.
2. Capture the textures (into `hero-render/textures/`):

   ```
   npm install --no-save playwright-core
   node hero-render/capture-textures.cjs http://localhost:5173
   ```

3. Render the two passes for a version (`level` or `topdown`): the scene on a transparent background,
   then only the shadows it casts on the floor. Each takes about 30 seconds on an RTX 3060.

   ```
   blender -b -P hero-render/hero_scene.py -- hero-render/textures hero-render/renders/objects.png 256 objects level
   blender -b -P hero-render/hero_scene.py -- hero-render/textures hero-render/renders/shadow.png 256 shadow level
   ```

4. Combine them and write the web images. The level version needs `--contact`: its camera sits almost
   at floor height, so it gets a soft shadow drawn under the stand instead.

   ```
   python hero-render/combine.py hero-render/renders/objects.png hero-render/renders/shadow.png public/home hero-level --contact
   ```

The layout (positions, angles, lights) is in `hero_scene.py`; the shadow's strength and softness are in
`combine.py`. The captured textures and raw renders are not committed.
