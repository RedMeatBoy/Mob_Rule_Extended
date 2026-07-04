# critters_kawaii.py — MOB RULE kawaii-with-edge species builder.
# STYLE RULES: big head, wide glint eyes, CONFIDENT brows (inner ends low),
# happy mouths, blush, chunky outline, vivid flat color (Standard transform).
# Run:  blender.exe -b -P critters_kawaii.py -- <species> <output_dir>
import bpy, sys, math

args = sys.argv[sys.argv.index('--') + 1:]
species, out_dir = args[0], args[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
for eng in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE', 'CYCLES'):
    try:
        scene.render.engine = eng
        break
    except Exception:
        continue
scene.render.film_transparent = True
try:
    scene.view_settings.view_transform = 'Standard'  # kawaii needs POP
except Exception:
    pass
scene.render.resolution_x = 256
scene.render.resolution_y = 256
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'

def flat_mat(name, rgba, backface=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    for n in m.node_tree.nodes:
        if n.type == 'BSDF_PRINCIPLED':
            n.inputs['Base Color'].default_value = rgba
            n.inputs['Roughness'].default_value = 1.0
            for sock in ('Specular IOR Level', 'Specular'):
                if sock in n.inputs:
                    n.inputs[sock].default_value = 0.0
                    break
    m.use_backface_culling = backface
    return m

WHITE = flat_mat('white', (0.98, 0.98, 0.96, 1))
PUPIL = flat_mat('pupil', (0.05, 0.05, 0.06, 1))
BLUSH = flat_mat('blush', (1.0, 0.45, 0.62, 1))
DARK = flat_mat('dark', (0.07, 0.06, 0.06, 1))
OUTLINE = flat_mat('outline', (0.05, 0.05, 0.06, 1), backface=True)

bpy.ops.object.empty_add(location=(0, 0, 0))
root = bpy.context.active_object

def sphere(name, loc, scale, mat, outline=True, seg=32, rot=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=1, location=loc)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = scale
    if rot:
        ob.rotation_euler = rot
    ob.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    if outline:
        ob.data.materials.append(OUTLINE)
        mod = ob.modifiers.new('outline', 'SOLIDIFY')
        mod.thickness = -0.07
        mod.offset = 1.0
        mod.use_flip_normals = True
        mod.material_offset = 1
    ob.parent = root
    return ob

def cube(name, loc, scale, mat, rot=None):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = scale
    if rot:
        ob.rotation_euler = rot
    ob.data.materials.append(mat)
    ob.parent = root
    return ob

# Shared face kit: eyes + glints + confident brows + blush + happy mouth.
def face(eye_z=0.98, eye_x=0.34, eye_y=-0.18, eye_r=0.21, brow=True,
         brow_deg=16, brow_w=0.12,
         mouth_z=0.60, mouth_y=-0.565, blush_z=0.66, blush_y=-0.47, blush_x=0.45):
    for sx in (-1, 1):
        ex = sx * eye_x
        sphere('eye', (ex, eye_y, eye_z), (eye_r, eye_r * 0.95, eye_r), WHITE)
        sphere('pupil', (ex, eye_y - 0.165, eye_z - 0.015), (eye_r * 0.57, 0.055, eye_r * 0.57), PUPIL, outline=False)
        sphere('glint', (ex - 0.05, eye_y - 0.235, eye_z + 0.04), (0.035, 0.02, 0.035), WHITE, outline=False)
        if brow:
            cube('brow', (ex, eye_y - 0.22, eye_z + 0.145),
                 (brow_w, 0.04, 0.03), DARK,
                 rot=(0, math.radians(brow_deg if sx < 0 else -brow_deg), 0))
        sphere('blush', (sx * blush_x, blush_y, blush_z), (0.10, 0.03, 0.062), BLUSH, outline=False)
    sphere('mouth', (0, mouth_y, mouth_z), (0.135, 0.035, 0.075), DARK, outline=False)

# ---------------- species ----------------
if species == 'frog':
    BODY = flat_mat('body', (0.10, 0.85, 0.20, 1))
    BELLY = flat_mat('belly', (0.85, 1.0, 0.55, 1))
    sphere('bod', (0, 0, 0.52), (0.62, 0.55, 0.50), BODY)
    sphere('belly', (0, -0.42, 0.38), (0.42, 0.22, 0.33), BELLY, outline=False)
    face()
    for sx in (-0.3, 0.3):
        sphere('foot', (sx, -0.38, 0.09), (0.16, 0.14, 0.09), BODY)
    for sx in (-0.52, 0.52):
        sphere('haunch', (sx, 0.10, 0.22), (0.22, 0.24, 0.20), BODY)

elif species == 'bunny':
    BODY = flat_mat('body', (1.0, 0.90, 0.76, 1))     # warm cream
    INNER = flat_mat('inner', (1.0, 0.62, 0.75, 1))   # ear pink
    sphere('bod', (0, 0, 0.50), (0.55, 0.52, 0.50), BODY)
    sphere('belly', (0, -0.36, 0.28), (0.30, 0.15, 0.20), flat_mat('belly', (1, 0.98, 0.94, 1)), outline=False)
    # Tall ears — right one bent at the tip (the edge: a scrappy flop).
    sphere('earL', (-0.24, 0.02, 1.30), (0.13, 0.10, 0.42), BODY)
    sphere('earLin', (-0.24, -0.055, 1.28), (0.065, 0.05, 0.30), INNER, outline=False)
    sphere('earR', (0.26, 0.02, 1.22), (0.13, 0.10, 0.36), BODY, rot=(0, math.radians(24), 0))
    sphere('earRin', (0.285, -0.05, 1.20), (0.065, 0.05, 0.25), INNER, outline=False, rot=(0, math.radians(24), 0))
    # No brows: the bunny is PURE JOY (style rule: the favorite is the happiest).
    face(eye_z=0.70, eye_x=0.25, eye_y=-0.36, eye_r=0.16, brow=False,
         mouth_z=0.44, mouth_y=-0.545, blush_z=0.52, blush_y=-0.48, blush_x=0.36)
    # Tiny pink nose above a tiny mouth (shrink the generic one).
    for ob in list(bpy.data.objects):
        if ob.name.startswith('mouth'):
            ob.scale = (0.07, 0.035, 0.05)
    sphere('nose', (0, -0.555, 0.56), (0.06, 0.03, 0.045), INNER, outline=False)
    # Paws + fluffy tail.
    for sx in (-0.24, 0.24):
        sphere('paw', (sx, -0.34, 0.08), (0.14, 0.12, 0.09), BODY)
    sphere('tail', (0, 0.50, 0.35), (0.14, 0.12, 0.13), WHITE)

elif species == 'duck':
    BODY = flat_mat('body', (1.0, 0.78, 0.12, 1))     # sunny yellow
    BEAK = flat_mat('beak', (1.0, 0.52, 0.12, 1))     # bold orange
    sphere('bod', (0, 0, 0.52), (0.55, 0.52, 0.48), BODY)
    sphere('belly', (0, -0.40, 0.38), (0.36, 0.20, 0.30), flat_mat('belly', (1, 0.95, 0.62, 1)), outline=False)
    face(eye_z=0.82, eye_x=0.26, eye_y=-0.32, eye_r=0.16, brow_deg=10, brow_w=0.10,
         mouth_z=0.52, mouth_y=-0.56, blush_z=0.70, blush_y=-0.42, blush_x=0.42)
    # The beak REPLACES the mouth: a flat, upturned little bill = smile.
    sphere('bill', (0, -0.555, 0.60), (0.20, 0.10, 0.045), BEAK, rot=(math.radians(-12), 0, 0))
    # Little wings, tucked low and behind like a proper round duck.
    for sx in (-0.5, 0.5):
        sphere('wing', (sx, 0.08, 0.34), (0.11, 0.20, 0.17), BODY, rot=(0, math.radians(-12 if sx < 0 else 12), 0))
    # A single confident head-feather curl.
    sphere('tuft', (0.02, 0.02, 1.05), (0.06, 0.06, 0.14), BODY, rot=(math.radians(-18), 0, math.radians(16)))

else:
    raise SystemExit('unknown species: ' + species)

# For the duck, the generic dark mouth hides under the bill — remove it.
if species == 'duck':
    for ob in list(bpy.data.objects):
        if ob.name.startswith('mouth'):
            bpy.data.objects.remove(ob, do_unlink=True)

# ---------------- light + camera ----------------
bpy.ops.object.light_add(type='SUN', location=(2, -3, 6))
sun = bpy.context.active_object
sun.data.energy = 2.4
sun.rotation_euler = (math.radians(35), math.radians(-12), math.radians(20))
world = bpy.data.worlds.new('World')
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get('Background')
if bg:
    bg.inputs[0].default_value = (0.9, 0.95, 0.9, 1)
    bg.inputs[1].default_value = 0.85

bpy.ops.object.camera_add(location=(0, -6, 1.35))
cam = bpy.context.active_object
cam.rotation_euler = (math.radians(80), 0, 0)
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 3.0 if species == 'bunny' else 2.6  # ears need headroom
scene.camera = cam

# ---------------- animation: idle 1-6, hop 7-12 ----------------
def key(frame, loc_z, s):
    root.location = (0, 0, loc_z)
    root.scale = s
    root.keyframe_insert(data_path='location', frame=frame)
    root.keyframe_insert(data_path='scale', frame=frame)

key(1, 0.00, (1.00, 1.00, 1.00))
key(2, 0.00, (1.03, 1.03, 0.955))
key(3, 0.00, (1.05, 1.05, 0.93))
key(4, 0.00, (1.03, 1.03, 0.955))
key(5, 0.00, (1.00, 1.00, 1.00))
key(6, 0.00, (0.985, 0.985, 1.02))
key(7, 0.00, (1.10, 1.10, 0.82))
key(8, 0.28, (0.92, 0.92, 1.16))
key(9, 0.52, (0.96, 0.96, 1.06))
key(10, 0.44, (1.00, 1.00, 1.00))
key(11, 0.12, (1.00, 1.00, 1.00))
key(12, 0.00, (1.14, 1.14, 0.80))

for f in range(1, 13):
    scene.frame_set(f)
    scene.render.filepath = f"{out_dir}/{species}_{f:02d}.png"
    bpy.ops.render.render(write_still=True)

print('KAWAII RENDER COMPLETE:', species, out_dir)
