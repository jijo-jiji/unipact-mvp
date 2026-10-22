"""The front page's hero picture, built and rendered in Blender (Cycles).

Run headless (the full steps are in README.md):
    blender -b -P hero_scene.py -- <textures dir> <output.png> [samples] [objects|shadow] [level|topdown]

Two camera presets: "level" (the default: the camera slightly below, the stand as a ledge, the picture
on the site since 22 Oct 2026) and "topdown" (looking down onto a deeper stand with the screens leaning
back, like Microsoft's Outlook render).

Two passes make the picture: "objects" (the scene on a transparent background) and "shadow" (only the
shadows it casts on the floor under the stand), so the shadow's strength and softness can be set when
the two are combined.

The layout follows the CSS version the picture replaces: one scene, 1 CSS pixel = 1 cm, the client's
project page in a browser window and the student's view on a phone standing on a white stand, three
cyan glass panes, and two cards floating in front. The screens are flat captures of the site's HTML
replicas (textures dir) shown as emission, so their colours come out exactly as on the site. The
background renders transparent; a shadow catcher under the stand keeps its soft shadow, so the picture
sits on the page's pale panel.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
TEXTURES = argv[0] if argv else os.path.join(os.path.dirname(__file__), 'textures')
OUTPUT = argv[1] if len(argv) > 1 else os.path.join(os.path.dirname(__file__), 'hero.png')
SAMPLES = int(argv[2]) if len(argv) > 2 else 192
MODE = argv[3] if len(argv) > 3 else 'objects'
TOP_DOWN = (argv[4] if len(argv) > 4 else 'level') == 'topdown'

# ---- clean slate -------------------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
PARTS = bpy.data.collections.new('parts')
scene.collection.children.link(PARTS)


def hex_rgba(h, a=1.0):
    h = h.lstrip('#')
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*lin, a)


# ---- geometry helpers --------------------------------------------------------------------------------
def rounded_outline(w, h, r, segments=12):
    """Points of a rounded rectangle centred on 0, counter-clockwise."""
    r = min(r, w / 2, h / 2)
    corners = [(w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)]
    pts = []
    for cx, cy, start in corners:
        for i in range(segments + 1):
            a = math.radians(start + 90 * i / segments)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def facing_panel(name, w, h, r, depth=0.0, uv=False):
    """A rounded rectangle standing upright, its front facing the camera (-Y); with depth, a slab
    extending away from the camera."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    verts = [bm.verts.new((x, 0.0, y)) for x, y in rounded_outline(w, h, r)]
    face = bm.faces.new(verts)
    if uv:
        layer = bm.loops.layers.uv.new('UVMap')
        for loop in face.loops:
            co = loop.vert.co
            loop[layer].uv = ((co.x + w / 2) / w, (co.z + h / 2) / h)
    if depth:
        ext = bmesh.ops.extrude_face_region(bm, geom=[face])
        moved = [e for e in ext['geom'] if isinstance(e, bmesh.types.BMVert)]
        bmesh.ops.translate(bm, verts=moved, vec=(0, depth, 0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    if not depth:
        # a single face: make sure it looks at the camera
        for f in bm.faces:
            if f.normal.y > 0:
                f.normal_flip()
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    PARTS.objects.link(obj)
    if depth:
        bevel = obj.modifiers.new('soft edges', 'BEVEL')
        bevel.width = min(0.012, depth / 3)
        bevel.segments = 4
        bevel.limit_method = 'ANGLE'
        bevel.angle_limit = math.radians(40)
        for p in mesh.polygons:
            p.use_smooth = True
    return obj


def lying_slab(name, w, d, r, height):
    """A rounded rectangle lying flat (the stand), its top at z = 0, extending down by height."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    verts = [bm.verts.new((x, y, 0.0)) for x, y in rounded_outline(w, d, r)]
    face = bm.faces.new(verts)
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    bmesh.ops.translate(bm, verts=[e for e in ext['geom'] if isinstance(e, bmesh.types.BMVert)], vec=(0, 0, -height))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    PARTS.objects.link(obj)
    bevel = obj.modifiers.new('soft edges', 'BEVEL')
    bevel.width = 0.05
    bevel.segments = 6
    bevel.limit_method = 'ANGLE'
    bevel.angle_limit = math.radians(40)
    for p in mesh.polygons:
        p.use_smooth = True
    return obj


# ---- materials ------------------------------------------------------------------------------------------
def solid(name, color, roughness=0.45, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = hex_rgba(color)
    bsdf.inputs['Roughness'].default_value = roughness
    if coat:
        bsdf.inputs['Coat Weight'].default_value = coat
        bsdf.inputs['Coat Roughness'].default_value = 0.08
    return m


def screen(name, image_file):
    """A display: the texture glows at its own colour, with transparent rounded corners."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(os.path.join(TEXTURES, image_file))
    tex.interpolation = 'Cubic'
    tex.extension = 'CLIP'
    emit = nt.nodes.new('ShaderNodeEmission')
    emit.inputs['Strength'].default_value = 1.0
    transparent = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(tex.outputs['Color'], emit.inputs['Color'])
    nt.links.new(tex.outputs['Alpha'], mix.inputs['Fac'])
    nt.links.new(transparent.outputs['BSDF'], mix.inputs[1])
    nt.links.new(emit.outputs['Emission'], mix.inputs[2])
    nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])
    return m


def glass(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = hex_rgba('#BFEBFC')
    bsdf.inputs['Transmission Weight'].default_value = 1.0
    bsdf.inputs['Roughness'].default_value = 0.12
    bsdf.inputs['IOR'].default_value = 1.45
    return m


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)


# ---- the scene (CSS scene px / 100 = metres; CSS x -> X, CSS y down -> -Z, CSS z toward viewer -> -Y) ----
def place(obj, left, top, w, h, z_css):
    obj.location = ((left + w / 2) / 100, -z_css / 100, -(top + h / 2) / 100)


parts = []

def lean_back(objs, pivot, degrees):
    """Tip objects back (their top away from the camera) about a level line through pivot."""
    tip = Matrix.Rotation(math.radians(-degrees), 4, 'X')
    for obj in objs:
        local = Vector(pivot) - obj.location
        obj.data.transform(Matrix.Translation(local) @ tip @ Matrix.Translation(-local))


def floor(name, size, z):
    """A level square, for the shadow catcher under the stand in the top-down picture."""
    mesh = bpy.data.meshes.new(name)
    h = size / 2
    mesh.from_pydata([(-h, -h, 0), (h, -h, 0), (h, h, 0), (-h, h, 0)], [], [(0, 1, 2, 3)])
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    obj.location = (4.0, -0.75, z)
    return obj


# Stand: the devices stand on it; its top is level with the screens' bottom edge. Seen from above it's
# a deeper, thicker block, with room for the phone and the glass.
if TOP_DOWN:
    stand = lying_slab('stand', 7.6, 3.6, 0.32, 0.8)
    stand.location = (3.85, -0.75, -4.46)
else:
    stand = lying_slab('stand', 6.4, 2.6, 0.26, 0.44)
    stand.location = (4.0, -0.55, -4.46)
assign(stand, solid('stand white', '#F7FAFD', roughness=0.35, coat=0.3))
parts.append(stand)

# Browser window: a light slab with the client's project page on its face
window = facing_panel('window body', 5.6, 3.82, 0.16, depth=0.10)
place(window, 160, 64, 560, 382, 0)
assign(window, solid('window body', '#C9D4E3', roughness=0.3))
window_face = facing_panel('window screen', 5.6, 3.82, 0.16, uv=True)
place(window_face, 160, 64, 560, 382, 0.2)
assign(window_face, screen('window screen', 'window.png'))
parts += [window, window_face]

# Phone: a navy body with an even bezel, the student's view on its screen
phone = facing_panel('phone body', 1.78, 3.72, 0.30, depth=0.10)
place(phone, 26, 75, 178, 372, 160)
assign(phone, solid('phone navy', '#050C2E', roughness=0.55, coat=0.1))
phone_face = facing_panel('phone screen', 1.66, 3.60, 0.24, uv=True)
place(phone_face, 32, 81, 166, 360, 160.3)
assign(phone_face, screen('phone screen', 'phone.png'))
parts += [phone, phone_face]

if TOP_DOWN:
    # leaning back on the stand, like a laptop screen and a phone on a dock
    lean_back([window, window_face], (4.40, 0.0, -4.46), 14)
    # further left than in the level picture, so it doesn't hide the start of the page's title
    for obj in (phone, phone_face):
        obj.location.x -= 0.45
    lean_back([phone, phone_face], (0.70, -1.6, -4.47), 12)

# Cyan glass: three panes standing at the window's lower right (seen from above, a little further
# forward on the stand, so they don't hide behind the card)
glass_mat = glass('cyan glass')
if TOP_DOWN:
    # seen from above, clear glass mostly shows the white stand and turns grey; tinted acrylic keeps its cyan
    bsdf = glass_mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = hex_rgba('#6CCDF2')
    bsdf.inputs['Transmission Weight'].default_value = 0.35
    bsdf.inputs['Alpha'].default_value = 0.55
    bsdf.inputs['Roughness'].default_value = 0.15
    bsdf.inputs['Coat Weight'].default_value = 1.0
    bsdf.inputs['Coat Roughness'].default_value = 0.05
for i in range(3):
    pane = facing_panel(f'glass {i}', 1.2, 1.5, 0.18, depth=0.035)
    if TOP_DOWN:
        place(pane, 620 + i * 24, 296, 120, 150, 70 + i * 34)
    else:
        place(pane, 600 + i * 22, 296, 120, 150, 40 + i * 32)
    assign(pane, glass_mat)
    parts.append(pane)

# Cards floating in front: a thin white body with the card's face on it
for name, (left, top, w, h, z) in {
    'card-approved': (330, 352, 257, 62, 230),
    'card-message': (470, 14, 250, 77, 110),
}.items():
    body = facing_panel(f'{name} body', w / 100, h / 100, 0.14, depth=0.03)
    place(body, left, top, w, h, z)
    assign(body, solid(f'{name} white', '#FFFFFF', roughness=0.4))
    face = facing_panel(f'{name} face', w / 100, h / 100, 0.14, uv=True)
    place(face, left, top, w, h, z + 0.15)
    assign(face, screen(f'{name} face', f'{name}.png'))
    parts += [body, face]

# Shadow catcher: an invisible floor under the stand that keeps only the shadows, so the picture rests
# on a surface. (A wall behind the scene instead caught the screens' shadows beside them, which on the
# site's flat panel looked like stray grey patches.)
catcher = floor('floor', 60, -4.46 - (0.8 if TOP_DOWN else 0.44))
catcher.is_shadow_catcher = True
assign(catcher, solid('backdrop', '#FFFFFF'))
if MODE == 'objects':
    catcher.hide_render = True
else:
    # the scene still casts its shadows but renders transparent, leaving only the shadow
    bpy.context.view_layer.layer_collection.children['parts'].holdout = True

# ---- turn the scene about its middle: level, like the CSS version (rotateY 20deg, then the camera 12deg
# below), or top-down (turned further, the camera 26deg above) ----------------------------------------
centre = Vector((4.0, -0.75, -3.0)) if TOP_DOWN else Vector((4.0, -0.6, -2.6))
pivot = bpy.data.objects.new('turn', None)
scene.collection.objects.link(pivot)
tilt = bpy.data.objects.new('tilt', None)
scene.collection.objects.link(tilt)
pivot.parent = tilt
tilt.rotation_euler = (math.radians(26 if TOP_DOWN else -12), 0, 0)
pivot.rotation_euler = (0, 0, math.radians(32 if TOP_DOWN else 20))
for obj in parts + [catcher]:
    obj.location -= centre
    obj.parent = pivot

# ---- camera, light, render ---------------------------------------------------------------------------
cam_data = bpy.data.cameras.new('camera')
cam_data.lens = 50 if TOP_DOWN else 85
cam = bpy.data.objects.new('camera', cam_data)
scene.collection.objects.link(cam)
cam.location = (0.3, -19, -0.2) if TOP_DOWN else (0.4, -27, 0.2)
cam.rotation_euler = (math.radians(90), 0, 0)
scene.camera = cam


def area_light(name, location, energy, size, color='#FFFFFF'):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = energy
    data.size = size
    data.color = hex_rgba(color)[:3]
    light = bpy.data.objects.new(name, data)
    scene.collection.objects.link(light)
    light.location = location
    direction = Vector((0, 0, 0)) - Vector(location)
    light.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    return light


area_light('key', (-9, -16, 11), 9000, 6)
area_light('fill', (12, -12, 1), 2500, 10, '#EAF4FF')
area_light('rim', (2, 10, 9), 3000, 6)

world = bpy.data.worlds.new('studio')
scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = hex_rgba('#EEF4FA')
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.3

scene.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
for device_type in ('OPTIX', 'CUDA'):
    try:
        prefs.compute_device_type = device_type
        prefs.get_devices()
        if any(d.type == device_type for d in prefs.devices):
            for d in prefs.devices:
                d.use = d.type == device_type
            scene.cycles.device = 'GPU'
            print('rendering on', device_type, [d.name for d in prefs.devices if d.use])
            break
    except TypeError:
        continue
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.cycles.film_transparent_glass = True
scene.render.film_transparent = True
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.render.resolution_x = 1800
scene.render.resolution_y = 1500
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.filepath = OUTPUT
bpy.ops.render.render(write_still=True)
print('wrote', OUTPUT)
