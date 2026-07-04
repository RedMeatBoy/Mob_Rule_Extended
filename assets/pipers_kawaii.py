# pipers_kawaii.py — the four bandleaders, chibi-kawaii per assets/STYLE.md.
# Big head, tiny body, happy/confident faces, chunky outline, vivid color.
# 12 frames x 3 views: idle sway 1-6, marching step 7-12.
# Run:  blender.exe -b -P pipers_kawaii.py -- <pip|bam|vivi|echo> <out_dir>
import bpy, sys, math

args = sys.argv[sys.argv.index('--') + 1:]
who, out_dir = args[0], args[1]

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
    scene.view_settings.view_transform = 'Standard'
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

SKIN = flat_mat('skin', (1.0, 0.83, 0.66, 1))
WHITE = flat_mat('white', (0.98, 0.98, 0.96, 1))
PUPIL = flat_mat('pupil', (0.08, 0.07, 0.08, 1))
BLUSH = flat_mat('blush', (1.0, 0.55, 0.62, 1))
DARK = flat_mat('dark', (0.10, 0.09, 0.10, 1))
GOLD = flat_mat('gold', (1.0, 0.80, 0.25, 1))
PANTS = flat_mat('pants', (0.28, 0.32, 0.42, 1))
WOOD = flat_mat('wood', (0.52, 0.34, 0.16, 1))
OUTLINE = flat_mat('outline', (0.06, 0.06, 0.08, 1), backface=True)

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
        mod.thickness = -0.06
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

def cyl(name, loc, r, depth, mat, rot=None):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc)
    ob = bpy.context.active_object
    ob.name = name
    if rot:
        ob.rotation_euler = rot
    ob.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    ob.parent = root
    return ob

# ---- shared chibi body: big head, small torso, stub legs ----
def chibi(jacket_mat):
    sphere('head', (0, 0, 1.06), (0.42, 0.40, 0.40), SKIN)
    sphere('body', (0, 0, 0.42), (0.30, 0.26, 0.34), jacket_mat)
    for sx in (-0.13, 0.13):
        sphere('leg', (sx, -0.02, 0.06), (0.10, 0.10, 0.13), PANTS)
        sphere('hand', (sx * 2.6, -0.05, 0.42), (0.09, 0.09, 0.09), SKIN)
    # Face: wide-set glint eyes, happy smile, blush.
    for sx in (-1, 1):
        sphere('eye', (sx * 0.16, -0.335, 1.12), (0.075, 0.045, 0.095), PUPIL, outline=False)
        sphere('glint', (sx * 0.13, -0.375, 1.16), (0.022, 0.014, 0.022), WHITE, outline=False)
        sphere('blush', (sx * 0.28, -0.30, 1.00), (0.06, 0.02, 0.04), BLUSH, outline=False)
    sphere('smile', (0, -0.385, 0.98), (0.06, 0.025, 0.04), DARK, outline=False)

if who == 'pip':
    RED = flat_mat('jacket', (0.96, 0.12, 0.14, 1))
    chibi(RED)
    cube('braid', (0, -0.26, 0.42), (0.03, 0.03, 0.30), GOLD)
    # The big band hat with pom.
    cyl('hat', (0, 0, 1.62), 0.30, 0.42, RED)
    cyl('hatband', (0, 0, 1.44), 0.31, 0.07, GOLD)
    sphere('pom', (0, 0, 1.88), (0.10, 0.10, 0.10), GOLD)
    # Flute held out at hand height (NOT through the face).
    cyl('flute', (0.40, -0.20, 0.46), 0.035, 0.52, WOOD, rot=(0, math.radians(90), 0))

elif who == 'bam':
    BLUE = flat_mat('jacket', (0.10, 0.45, 0.98, 1))
    chibi(BLUE)
    # Backwards cap.
    sphere('cap', (0, 0.04, 1.40), (0.40, 0.40, 0.22), BLUE)
    cube('brim', (0, 0.42, 1.36), (0.22, 0.16, 0.045), BLUE)
    # The marching drum, worn proud: white shell, BOLD red rims.
    cyl('drum', (0, -0.40, 0.40), 0.27, 0.24, WHITE, rot=(math.radians(90), 0, 0))
    cyl('drumrim1', (0, -0.29, 0.40), 0.285, 0.045, flat_mat('rim', (0.94, 0.10, 0.16, 1)), rot=(math.radians(90), 0, 0))
    cyl('drumrim2', (0, -0.52, 0.40), 0.285, 0.045, flat_mat('rim2', (0.94, 0.10, 0.16, 1)), rot=(math.radians(90), 0, 0))
    cube('strapL', (-0.16, -0.20, 0.62), (0.03, 0.16, 0.03), flat_mat('strap', (0.94, 0.10, 0.16, 1)), rot=(math.radians(-30), 0, 0))
    cube('strapR', (0.16, -0.20, 0.62), (0.03, 0.16, 0.03), flat_mat('strap2', (0.94, 0.10, 0.16, 1)), rot=(math.radians(-30), 0, 0))
    # Drumsticks in both hands.
    for sx in (-1, 1):
        cyl('stick', (sx * 0.36, -0.28, 0.56), 0.025, 0.36, WOOD, rot=(math.radians(-40), sx * math.radians(24), 0))

elif who == 'vivi':
    PINKD = flat_mat('dress', (1.0, 0.55, 0.75, 1))
    chibi(PINKD)
    # The dress: a cone skirt over the body.
    bpy.ops.mesh.primitive_cone_add(radius1=0.44, radius2=0.16, depth=0.5, location=(0, 0, 0.30))
    skirt = bpy.context.active_object
    skirt.data.materials.append(PINKD)
    bpy.ops.object.shade_smooth()
    skirt.parent = root
    # Hair + two big bows.
    sphere('hair', (0, 0.05, 1.32), (0.44, 0.42, 0.26), flat_mat('hair', (0.55, 0.36, 0.22, 1)))
    for sx in (-1, 1):
        sphere('bowL', (sx * 0.40 - sx * 0.05, 0.02, 1.44), (0.11, 0.06, 0.08), flat_mat('bow', (1.0, 0.36, 0.62, 1)), rot=(0, sx * math.radians(-28), 0))
        sphere('bowR', (sx * 0.40 + sx * 0.09, 0.02, 1.40), (0.09, 0.05, 0.07), flat_mat('bow2', (1.0, 0.36, 0.62, 1)), rot=(0, sx * math.radians(30), 0))
        sphere('bowknot', (sx * 0.42, 0.0, 1.42), (0.045, 0.045, 0.045), flat_mat('knot', (1.0, 0.75, 0.85, 1)))
    # Violin held at her side (dark wood, off the face).
    sphere('violin', (0.34, -0.24, 0.52), (0.12, 0.055, 0.17), WOOD, rot=(0, 0, math.radians(-16)))
    cyl('neck', (0.41, -0.24, 0.74), 0.02, 0.26, DARK, rot=(0, 0, math.radians(-16)))

elif who == 'echo':
    BLACK = flat_mat('tux', (0.16, 0.15, 0.20, 1))
    chibi(BLACK)
    # Slick hair + gold bow tie + tails.
    sphere('hair', (0, 0.05, 1.36), (0.42, 0.40, 0.20), DARK)
    sphere('bowtie', (0, -0.26, 0.66), (0.10, 0.04, 0.05), GOLD)
    cube('tailL', (-0.16, 0.20, 0.16), (0.08, 0.03, 0.16), BLACK, rot=(math.radians(18), 0, math.radians(-10)))
    cube('tailR', (0.16, 0.20, 0.16), (0.08, 0.03, 0.16), BLACK, rot=(math.radians(18), 0, math.radians(10)))
    # The baton, raised from the hand — tip ATTACHED to its end.
    cyl('baton', (0.42, -0.14, 0.66), 0.02, 0.42, WHITE, rot=(0, math.radians(38), 0))
    sphere('batontip', (0.55, -0.14, 0.82), (0.035, 0.035, 0.035), GOLD, outline=False)

else:
    raise SystemExit('unknown piper: ' + who)

# ---- light + camera ----
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

bpy.ops.object.camera_add(location=(0, -6, 1.1))
cam = bpy.context.active_object
cam.rotation_euler = (math.radians(82), 0, 0)
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 2.6
scene.camera = cam

# ---- animation: idle sway 1-6, marching step 7-12 ----
def key(frame, loc_z, sy, rot_z):
    root.location = (0, 0, loc_z)
    root.scale = (1, 1, sy)
    root.rotation_euler = (0, 0, root.rotation_euler.z)  # keep view yaw
    root.keyframe_insert(data_path='location', frame=frame)
    root.keyframe_insert(data_path='scale', frame=frame)

key(1, 0.00, 1.00, 0)
key(2, 0.00, 0.985, 0)
key(3, 0.00, 0.97, 0)
key(4, 0.00, 0.985, 0)
key(5, 0.00, 1.00, 0)
key(6, 0.00, 1.008, 0)
key(7, 0.03, 0.97, 0)
key(8, 0.09, 1.02, 0)
key(9, 0.03, 0.99, 0)
key(10, 0.03, 0.97, 0)
key(11, 0.09, 1.02, 0)
key(12, 0.03, 0.99, 0)

VIEWS = [('front', 0.0), ('back', math.pi), ('side', math.radians(40))]
for vname, yaw in VIEWS:
    root.rotation_euler = (0, 0, yaw)
    for f in range(1, 13):
        scene.frame_set(f)
        scene.render.filepath = f"{out_dir}/{who}_{vname}_{f:02d}.png"
        bpy.ops.render.render(write_still=True)

print('PIPER RENDER COMPLETE:', who, out_dir)
