# frog_kawaii.py — MOB RULE art style test #1.
# Builds a kawaii-with-edge frog (big head, wide dot eyes, determined brows,
# thick outline, bold flat color) and renders a 12-frame sprite set:
#   frames 01-06: idle bounce   frames 07-12: hop
# Run:  blender.exe -b -P frog_kawaii.py -- <output_dir>
import bpy, sys, math

out_dir = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else './frog_out'

# ---------- clean scene ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------- render engine (version-proof) ----------
for eng in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE', 'CYCLES'):
    try:
        scene.render.engine = eng
        break
    except Exception:
        continue
scene.render.film_transparent = True
# Kill AgX tonemapping — kawaii needs POP, not filmic grey.
try:
    scene.view_settings.view_transform = 'Standard'
except Exception:
    pass
scene.render.resolution_x = 256
scene.render.resolution_y = 256
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'

# ---------- materials ----------
def flat_mat(name, rgba, backface=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = None
    for n in m.node_tree.nodes:
        if n.type == 'BSDF_PRINCIPLED':
            bsdf = n
            break
    if bsdf:
        bsdf.inputs['Base Color'].default_value = rgba
        bsdf.inputs['Roughness'].default_value = 1.0
        # kill specularity if the socket exists in this version
        for sock in ('Specular IOR Level', 'Specular'):
            if sock in bsdf.inputs:
                bsdf.inputs[sock].default_value = 0.0
                break
    m.use_backface_culling = backface
    return m

BODY   = flat_mat('body',   (0.10, 0.85, 0.20, 1))   # VIVID frog green
BELLY  = flat_mat('belly',  (0.85, 1.0, 0.55, 1))    # sunny pale green
WHITE  = flat_mat('white',  (0.98, 0.98, 0.96, 1))
PUPIL  = flat_mat('pupil',  (0.05, 0.05, 0.06, 1))
BLUSH  = flat_mat('blush',  (1.0, 0.45, 0.62, 1))    # the VIVI pink
DARK   = flat_mat('dark',   (0.05, 0.09, 0.05, 1))
OUTLINE = flat_mat('outline', (0.03, 0.07, 0.04, 1), backface=True)

def sphere(name, loc, scale, mat, outline=True, seg=32):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=1, location=loc)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = scale
    ob.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    if outline:
        ob.data.materials.append(OUTLINE)
        mod = ob.modifiers.new('outline', 'SOLIDIFY')
        mod.thickness = -0.07
        mod.offset = 1.0
        mod.use_flip_normals = True
        mod.material_offset = 1
    return ob

# ---------- root ----------
bpy.ops.object.empty_add(location=(0, 0, 0))
root = bpy.context.active_object
root.name = 'root'
parts = []

def add(ob):
    ob.parent = root
    parts.append(ob)
    return ob

# ---------- the frog (kawaii proportions: one big head-blob) ----------
add(sphere('bod',   (0, 0, 0.52),  (0.62, 0.55, 0.50), BODY))
add(sphere('belly', (0, -0.42, 0.38), (0.42, 0.22, 0.33), BELLY, outline=False))
# Eyes ON TOP, wide apart (frog + kawaii = same instinct)
for sx, nm in ((-0.34, 'L'), (0.34, 'R')):
    add(sphere('eye' + nm,   (sx, -0.18, 0.98), (0.21, 0.20, 0.21), WHITE))
    add(sphere('pupil' + nm, (sx, -0.345, 0.965), (0.12, 0.055, 0.12), PUPIL, outline=False))
    add(sphere('glint' + nm, (sx - 0.05, -0.415, 1.02), (0.035, 0.02, 0.035), WHITE, outline=False))
    # THE EDGE: determined little eyebrows, hugging the eyes, angled inward.
    bpy.ops.mesh.primitive_cube_add(location=(sx * 1.0, -0.40, 1.10))
    brow = bpy.context.active_object
    brow.name = 'brow' + nm
    brow.scale = (0.13, 0.04, 0.038)
    brow.rotation_euler = (0, math.radians(-24 if sx < 0 else 24), 0)
    brow.data.materials.append(DARK)
    add(brow)
# Small open happy mouth (the Kirby rule: round = joy)
add(sphere('mouth', (0, -0.565, 0.615), (0.085, 0.035, 0.068), DARK, outline=False))
# Blush spots, proudly on the cheeks
for sx in (-0.45, 0.45):
    add(sphere('blush', (sx, -0.47, 0.66), (0.10, 0.03, 0.062), BLUSH, outline=False))
# Front feet
for sx in (-0.3, 0.3):
    add(sphere('foot', (sx, -0.38, 0.09), (0.16, 0.14, 0.09), BODY))
# Back haunches
for sx in (-0.52, 0.52):
    add(sphere('haunch', (sx, 0.10, 0.22), (0.22, 0.24, 0.20), BODY))

# ---------- light: soft key + strong ambient = flat kawaii shading ----------
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

# ---------- camera: orthographic, front + a touch above ----------
bpy.ops.object.camera_add(location=(0, -6, 1.35))
cam = bpy.context.active_object
cam.rotation_euler = (math.radians(80), 0, 0)
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 2.6
scene.camera = cam

# ---------- animation: idle bounce (1-6) + hop (7-12) ----------
def key(frame, loc_z, s):
    root.location = (0, 0, loc_z)
    root.scale = s
    root.keyframe_insert(data_path='location', frame=frame)
    root.keyframe_insert(data_path='scale', frame=frame)

# idle: soft squash-and-stretch breathing
key(1, 0.00, (1.00, 1.00, 1.00))
key(2, 0.00, (1.03, 1.03, 0.955))
key(3, 0.00, (1.05, 1.05, 0.93))
key(4, 0.00, (1.03, 1.03, 0.955))
key(5, 0.00, (1.00, 1.00, 1.00))
key(6, 0.00, (0.985, 0.985, 1.02))
# hop: crouch, launch (stretch), peak, land (squash)
key(7, 0.00, (1.10, 1.10, 0.82))
key(8, 0.28, (0.92, 0.92, 1.16))
key(9, 0.52, (0.96, 0.96, 1.06))
key(10, 0.44, (1.00, 1.00, 1.00))
key(11, 0.12, (1.00, 1.00, 1.00))
key(12, 0.00, (1.14, 1.14, 0.80))

# ---------- render all frames ----------
for f in range(1, 13):
    scene.frame_set(f)
    scene.render.filepath = f"{out_dir}/frog_{f:02d}.png"
    bpy.ops.render.render(write_still=True)

print('FROG TEST RENDER COMPLETE:', out_dir)
