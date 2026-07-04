# enemies_kawaii.py — the Tidy Empire, kawaii-with-edge per STYLE.md:
# same chunk and charm as the critters, but cool greys + ONE hot accent,
# LED eyes, zero blush. Cute enough not to scare; robotic enough to boo.
# Run: blender.exe -b -P enemies_kawaii.py -- <kind> <out_dir>
# Kinds: dustbot mower tidydrone broom bagbot conebot cone secbot camdrone
#        mowtron succ bunnytron
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

GREY = flat_mat('grey', (0.62, 0.64, 0.70, 1))
DGREY = flat_mat('dgrey', (0.38, 0.40, 0.48, 1))
STEEL = flat_mat('steel', (0.78, 0.80, 0.86, 1))
LEDB = flat_mat('ledb', (0.35, 0.85, 1.0, 1))
LEDR = flat_mat('ledr', (1.0, 0.30, 0.30, 1))
DARK = flat_mat('dark', (0.10, 0.10, 0.13, 1))
OUTLINE = flat_mat('outline', (0.05, 0.05, 0.08, 1), backface=True)

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

def led_eyes(z, x=0.16, y=-0.42, mat=LEDB, w=0.06):
    for sx in (-1, 1):
        cube('led', (sx * x, y, z), (w, 0.02, 0.045), mat)

# ---------------- the bots ----------------
if kind == 'dustbot':
    sphere('dome', (0, 0, 0.42), (0.5, 0.48, 0.30), GREY)
    cyl('base', (0, 0, 0.16), 0.52, 0.16, DGREY)
    led_eyes(0.46, x=0.18, y=-0.44)
    # Brush skirt.
    for i in range(8):
        a = i / 8 * 6.283
        cube('brush', (math.cos(a) * 0.5, math.sin(a) * 0.5, 0.06), (0.06, 0.06, 0.045), STEEL, rot=(0, 0, a))

elif kind == 'mower':
    cube('body', (0, 0, 0.36), (0.44, 0.52, 0.24), flat_mat('green', (0.42, 0.62, 0.25, 1)))
    cyl('blade', (0, -0.55, 0.18), 0.30, 0.34, DGREY, rot=(0, math.radians(90), 0))
    led_eyes(0.50, x=0.16, y=-0.40, mat=LEDR)
    cube('exhaust', (0.30, 0.42, 0.60), (0.05, 0.05, 0.14), DGREY)
    for sx in (-0.34, 0.34):
        cyl('wheel', (sx, 0.25, 0.14), 0.14, 0.10, DARK, rot=(0, math.radians(90), 0))

elif kind == 'tidydrone':
    sphere('body', (0, 0, 0.62), (0.34, 0.34, 0.26), STEEL)
    cyl('rotorhub', (0, 0, 0.90), 0.05, 0.10, DGREY)
    cyl('rotor', (0, 0, 0.97), 0.42, 0.02, flat_mat('rblur', (0.75, 0.78, 0.85, 0.6)))
    led_eyes(0.64, x=0.12, y=-0.30, mat=flat_mat('ledy', (1.0, 0.85, 0.25, 1)))
    cube('arm', (0, -0.36, 0.44), (0.05, 0.14, 0.05), DGREY)

elif kind == 'broom':
    cyl('handle', (0, 0, 0.72), 0.07, 0.85, flat_mat('wood2', (0.62, 0.46, 0.28, 1)))
    sphere('head', (0, 0, 1.20), (0.20, 0.20, 0.18), GREY)
    led_eyes(1.22, x=0.09, y=-0.18)
    bpy.ops.mesh.primitive_cone_add(radius1=0.42, radius2=0.14, depth=0.42, location=(0, 0, 0.20))
    br = bpy.context.active_object
    br.data.materials.append(flat_mat('straw', (0.85, 0.70, 0.38, 1)))
    bpy.ops.object.shade_smooth()
    br.parent = root
    for sx in (-1, 1):
        cube('armb', (sx * 0.30, -0.06, 0.85), (0.14, 0.05, 0.05), DGREY, rot=(0, 0, sx * math.radians(-18)))

elif kind == 'bagbot':
    sphere('body', (0, 0, 0.45), (0.42, 0.40, 0.40), DGREY)
    # The open bag mouth: what it wants is CRITTERS.
    sphere('mouth', (0, -0.36, 0.42), (0.24, 0.12, 0.20), DARK, outline=False)
    led_eyes(0.72, x=0.14, y=-0.34)
    for sx in (-1, 1):
        cube('grab', (sx * 0.44, -0.18, 0.40), (0.05, 0.16, 0.05), STEEL, rot=(0, 0, sx * math.radians(24)))
        cube('claw', (sx * 0.46, -0.36, 0.40), (0.07, 0.05, 0.07), STEEL)

elif kind == 'conebot':
    cube('body', (0, 0, 0.40), (0.36, 0.40, 0.28), flat_mat('orange', (0.85, 0.45, 0.18, 1)))
    led_eyes(0.56, x=0.14, y=-0.34)
    for i in range(3):
        bpy.ops.mesh.primitive_cone_add(radius1=0.16 - i * 0.02, radius2=0.02, depth=0.24, location=(0, 0.30, 0.68 + i * 0.17))
        cn = bpy.context.active_object
        cn.data.materials.append(flat_mat('cone' + str(i), (0.95, 0.50, 0.18, 1)))
        cn.parent = root
    for sx in (-0.28, 0.28):
        cyl('wheel', (sx, 0.12, 0.12), 0.12, 0.09, DARK, rot=(0, math.radians(90), 0))

elif kind == 'cone':
    bpy.ops.mesh.primitive_cone_add(radius1=0.42, radius2=0.05, depth=0.85, location=(0, 0, 0.45))
    cn = bpy.context.active_object
    cn.data.materials.append(flat_mat('cone', (0.95, 0.48, 0.16, 1)))
    bpy.ops.object.shade_smooth()
    cn.data.materials.append(OUTLINE)
    mod = cn.modifiers.new('outline', 'SOLIDIFY')
    mod.thickness = -0.06
    mod.offset = 1.0
    mod.use_flip_normals = True
    mod.material_offset = 1
    cn.parent = root
    cyl('stripe', (0, 0, 0.52), 0.30, 0.10, flat_mat('white2', (0.97, 0.97, 0.95, 1)))
    cube('base', (0, 0, 0.05), (0.36, 0.36, 0.05), flat_mat('cone2', (0.85, 0.42, 0.14, 1)))

elif kind == 'secbot':
    cube('body', (0, 0, 0.46), (0.36, 0.30, 0.40), flat_mat('navy', (0.22, 0.26, 0.38, 1)))
    cube('visor', (0, -0.31, 0.62), (0.26, 0.02, 0.06), LEDR)
    cube('antenna', (0.22, 0.0, 0.94), (0.02, 0.02, 0.10), STEEL)
    sphere('anttip', (0.22, 0.0, 1.06), (0.035, 0.035, 0.035), LEDR, outline=False)
    for sx in (-0.24, 0.24):
        cube('tread', (sx, 0, 0.10), (0.10, 0.30, 0.10), DARK)

elif kind == 'camdrone':
    sphere('body', (0, 0, 0.60), (0.30, 0.30, 0.24), DARK)
    cyl('rotor', (0, 0, 0.86), 0.38, 0.02, flat_mat('rblur', (0.6, 0.65, 0.75, 0.6)))
    # One big lens eye.
    cyl('lens', (0, -0.28, 0.58), 0.13, 0.10, STEEL, rot=(math.radians(90), 0, 0))
    cyl('lens2', (0, -0.34, 0.58), 0.08, 0.04, LEDB, rot=(math.radians(90), 0, 0))

elif kind == 'mowtron':
    cube('body', (0, 0, 0.52), (0.72, 0.80, 0.40), flat_mat('green', (0.36, 0.56, 0.20, 1)))
    # Chomper grille.
    cube('grille', (0, -0.78, 0.34), (0.60, 0.06, 0.22), DARK)
    for i in range(5):
        cube('tooth', (-0.44 + i * 0.22, -0.80, 0.26), (0.07, 0.05, 0.10), STEEL)
    led_eyes(0.74, x=0.26, y=-0.84, mat=LEDR, w=0.10)
    cube('cab', (0, 0.30, 0.92), (0.34, 0.30, 0.20), DGREY)
    cube('pipe', (0.48, 0.55, 0.95), (0.07, 0.07, 0.25), DGREY)
    for sx in (-0.6, 0.6):
        for sy in (-0.35, 0.45):
            cyl('wheel', (sx, sy, 0.16), 0.19, 0.14, DARK, rot=(0, math.radians(90), 0))

elif kind == 'succ':
    sphere('body', (0, 0, 0.62), (0.55, 0.55, 0.62), flat_mat('purple', (0.46, 0.36, 0.62, 1)))
    sphere('swirl', (0, -0.30, 0.70), (0.34, 0.28, 0.36), flat_mat('purple2', (0.58, 0.48, 0.75, 1)), outline=False)
    led_eyes(0.94, x=0.20, y=-0.44, mat=flat_mat('ledw', (0.95, 0.95, 1.0, 1)), w=0.08)
    # THE NOZZLE.
    cyl('hose', (0.42, -0.42, 0.42), 0.11, 0.55, DGREY, rot=(math.radians(65), 0, math.radians(-35)))
    cyl('nozzle', (0.60, -0.66, 0.24), 0.16, 0.18, DARK, rot=(math.radians(65), 0, math.radians(-35)))
    cyl('canister', (0, 0.42, 0.40), 0.24, 0.5, STEEL)

elif kind == 'bunnytron':
    PINK = flat_mat('pink', (1.0, 0.52, 0.70, 1))
    PINK2 = flat_mat('pink2', (1.0, 0.72, 0.84, 1))
    sphere('bod', (0, 0, 0.52), (0.58, 0.54, 0.50), PINK)
    sphere('belly', (0, -0.42, 0.42), (0.36, 0.16, 0.28), PINK2, outline=False)
    # Robo ears: metal with antenna lights.
    for sx in (-1, 1):
        cube('ear', (sx * 0.26, 0.02, 1.24), (0.10, 0.07, 0.34), STEEL, rot=(0, sx * math.radians(8), 0))
        cube('earpanel', (sx * 0.26, -0.045, 1.22), (0.05, 0.03, 0.24), PINK2)
        sphere('eartip', (sx * 0.30, 0.02, 1.60), (0.055, 0.055, 0.055), LEDR, outline=False)
    # Visor eyes: cute but DEFINITELY a robot.
    cube('visor', (0, -0.47, 0.78), (0.34, 0.03, 0.10), DARK)
    for sx in (-1, 1):
        cube('eye', (sx * 0.15, -0.50, 0.78), (0.08, 0.02, 0.05), LEDR)
    # Buck teeth (steel).
    cube('tooth1', (-0.05, -0.55, 0.52), (0.045, 0.03, 0.07), STEEL)
    cube('tooth2', (0.05, -0.55, 0.52), (0.045, 0.03, 0.07), STEEL)
    # Rivets + panel line.
    for sx in (-0.4, 0.4):
        sphere('rivet', (sx, -0.30, 0.80), (0.03, 0.03, 0.03), DGREY, outline=False)
    # The carrot launcher arm.
    cube('arm', (0.56, -0.10, 0.50), (0.16, 0.10, 0.10), STEEL)
    cyl('barrel', (0.74, -0.24, 0.50), 0.09, 0.22, DGREY, rot=(math.radians(90), 0, math.radians(-20)))
    bpy.ops.mesh.primitive_cone_add(radius1=0.07, radius2=0.01, depth=0.18, location=(0.80, -0.36, 0.50))
    car = bpy.context.active_object
    car.rotation_euler = (math.radians(-90), 0, 0)
    car.data.materials.append(flat_mat('carrot', (1.0, 0.55, 0.20, 1)))
    car.parent = root
    # Stubby feet.
    for sx in (-0.26, 0.26):
        sphere('foot', (sx, -0.30, 0.08), (0.15, 0.13, 0.09), PINK)

else:
    raise SystemExit('unknown kind: ' + kind)

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

BOSSES = ('mowtron', 'succ', 'bunnytron')
bpy.ops.object.camera_add(location=(0, -6, 1.0))
cam = bpy.context.active_object
cam.rotation_euler = (math.radians(82), 0, 0)
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 2.4 if kind not in BOSSES else 3.1
scene.camera = cam

# ---- animation: idle bob 1-6, move 7-12 (fliers float higher) ----
FLIES = kind in ('tidydrone', 'camdrone')
def key(frame, z, sy):
    root.location = (0, 0, z)
    root.scale = (1, 1, sy)
    root.keyframe_insert(data_path='location', frame=frame)
    root.keyframe_insert(data_path='scale', frame=frame)

base = 0.25 if FLIES else 0.0
key(1, base, 1.00); key(2, base + 0.02, 1.005); key(3, base + 0.04, 1.01)
key(4, base + 0.02, 1.005); key(5, base, 1.00); key(6, base - 0.01, 0.995)
key(7, base, 0.99); key(8, base + 0.05, 1.02); key(9, base + 0.01, 1.0)
key(10, base, 0.99); key(11, base + 0.05, 1.02); key(12, base + 0.01, 1.0)

STATIC = kind == 'cone'
VIEWS = [('front', 0.0)] if kind in BOSSES or STATIC else [('front', 0.0), ('back', math.pi), ('side', math.radians(40))]
FRAMES = 1 if STATIC else 12
for vname, yaw in VIEWS:
    root.rotation_euler = (0, 0, yaw)
    for f in range(1, FRAMES + 1):
        scene.frame_set(f)
        scene.render.filepath = f"{out_dir}/{kind}_{vname}_{f:02d}.png"
        bpy.ops.render.render(write_still=True)

print('ENEMY RENDER COMPLETE:', kind, out_dir)
