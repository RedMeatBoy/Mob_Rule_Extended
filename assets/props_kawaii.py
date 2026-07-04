# props_kawaii.py — pickups & interactables in the house style.
# Run: blender.exe -b -P props_kawaii.py -- <cage|rescuecage|apple|acorn> <out>
# Single frames (in-game bob/wobble comes from the canvas transform).
import bpy, sys, math

args = sys.argv[sys.argv.index('--') + 1:]
kind, out_dir = args[0], args[1]

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
scene.render.resolution_x = 192
scene.render.resolution_y = 192
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

OUTLINE = flat_mat('outline', (0.06, 0.06, 0.06, 1), backface=True)

def outline_of(ob):
    ob.data.materials.append(OUTLINE)
    mod = ob.modifiers.new('outline', 'SOLIDIFY')
    mod.thickness = -0.05
    mod.offset = 1.0
    mod.use_flip_normals = True
    mod.material_offset = 1

def sphere(loc, scale, mat, outline=True, rot=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1, location=loc)
    ob = bpy.context.active_object
    ob.scale = scale
    if rot:
        ob.rotation_euler = rot
    ob.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    if outline:
        outline_of(ob)
    return ob

def cube(loc, scale, mat, rot=None):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    ob = bpy.context.active_object
    ob.scale = scale
    if rot:
        ob.rotation_euler = rot
    ob.data.materials.append(mat)
    return ob

if kind in ('cage', 'rescuecage'):
    WOODM = flat_mat('wood', (0.72, 0.52, 0.30, 1) if kind == 'cage' else (0.92, 0.72, 0.28, 1))
    WOODD = flat_mat('woodd', (0.52, 0.38, 0.22, 1) if kind == 'cage' else (0.68, 0.50, 0.18, 1))
    cube((0, 0, 0.45), (0.55, 0.42, 0.42), WOODM)
    for i in (-1, 0, 1):
        cube((i * 0.28, -0.43, 0.45), (0.055, 0.03, 0.40), WOODD)
    cube((0, -0.43, 0.80), (0.55, 0.03, 0.06), WOODD)
    cube((0, -0.43, 0.10), (0.55, 0.03, 0.06), WOODD)
    # Peeking eyes in the dark between bars.
    sphere((-0.13, -0.40, 0.48), (0.055, 0.02, 0.06), flat_mat('w', (0.98, 0.98, 0.96, 1)), outline=False)
    sphere((0.13, -0.40, 0.48), (0.055, 0.02, 0.06), flat_mat('w2', (0.98, 0.98, 0.96, 1)), outline=False)
    sphere((-0.12, -0.42, 0.47), (0.025, 0.015, 0.03), flat_mat('p', (0.08, 0.08, 0.08, 1)), outline=False)
    sphere((0.14, -0.42, 0.47), (0.025, 0.015, 0.03), flat_mat('p2', (0.08, 0.08, 0.08, 1)), outline=False)
    if kind == 'rescuecage':
        # A little glow star on top.
        sphere((0, 0, 0.98), (0.09, 0.09, 0.09), flat_mat('star', (1.0, 0.9, 0.4, 1)), outline=False)

elif kind == 'apple':
    sphere((0, 0, 0.42), (0.42, 0.40, 0.40), flat_mat('red', (0.95, 0.22, 0.22, 1)))
    sphere((-0.12, -0.14, 0.55), (0.14, 0.08, 0.11), flat_mat('shine', (1.0, 0.55, 0.5, 1)), outline=False)
    cube((0.02, 0, 0.86), (0.035, 0.035, 0.10), flat_mat('stem', (0.45, 0.30, 0.15, 1)))
    sphere((0.14, 0, 0.92), (0.14, 0.05, 0.08), flat_mat('leaf', (0.35, 0.75, 0.30, 1)), rot=(0, math.radians(-30), 0))

elif kind == 'acorn':
    sphere((0, 0, 0.36), (0.32, 0.30, 0.36), flat_mat('nut', (0.80, 0.58, 0.32, 1)))
    sphere((0, 0, 0.62), (0.36, 0.34, 0.20), flat_mat('cap', (0.50, 0.35, 0.20, 1)))
    cube((0, 0, 0.82), (0.03, 0.03, 0.08), flat_mat('stem', (0.40, 0.28, 0.16, 1)))
    sphere((-0.1, -0.12, 0.42), (0.08, 0.04, 0.10), flat_mat('shine', (0.95, 0.78, 0.52, 1)), outline=False)

else:
    raise SystemExit('unknown prop: ' + kind)

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

bpy.ops.object.camera_add(location=(0, -6, 0.55))
cam = bpy.context.active_object
cam.rotation_euler = (math.radians(83), 0, 0)
cam.data.type = 'ORTHO'
# Cubes are 2 base units in Blender — crates need the wide lens.
cam.data.ortho_scale = 3.6 if kind in ('cage', 'rescuecage') else 2.1
if kind in ('cage', 'rescuecage'):
    cam.location.z = 0.85
scene.camera = cam

scene.frame_set(1)
scene.render.filepath = f"{out_dir}/{kind}_01.png"
bpy.ops.render.render(write_still=True)
print('PROP RENDER COMPLETE:', kind)
