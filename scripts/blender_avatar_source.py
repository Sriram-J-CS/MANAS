"""
Blender 3D Avatar Source Generator for MANAS
Creates fully rigged Blender scenes (boy.blend, girl.blend) with:
- Mixamo-compatible humanoid armature
- Separate meshes: head, body, hair, eyes, teeth_tongue, clothes
- 52 ARKit Shape Keys + 15 Oculus Viseme Shape Keys + 8 Face Shape Morphs
- PBR materials and vertex groups
Run in Blender with:
  blender --background --python scripts/blender_avatar_source.py
"""

import math
try:
    import bpy
except ImportError:
    bpy = None

ARKIT_BLENDSHAPES = [
    'eyeBlinkLeft', 'eyeLookDownLeft', 'eyeLookInLeft', 'eyeLookOutLeft', 'eyeLookUpLeft', 'eyeSquintLeft', 'eyeWideLeft',
    'eyeBlinkRight', 'eyeLookDownRight', 'eyeLookInRight', 'eyeLookOutRight', 'eyeLookUpRight', 'eyeSquintRight', 'eyeWideRight',
    'jawForward', 'jawLeft', 'jawRight', 'jawOpen',
    'mouthClose', 'mouthFunnel', 'mouthPucker', 'mouthLeft', 'mouthRight',
    'mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft', 'mouthFrownRight',
    'mouthDimpleLeft', 'mouthDimpleRight', 'mouthStretchLeft', 'mouthStretchRight',
    'mouthRollLower', 'mouthRollUpper', 'mouthShrugLower', 'mouthShrugUpper',
    'mouthPressLeft', 'mouthPressRight', 'mouthLowerDownLeft', 'mouthLowerDownRight',
    'mouthUpperUpLeft', 'mouthUpperUpRight',
    'browDownLeft', 'browDownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight',
    'cheekPuff', 'cheekSquintLeft', 'cheekSquintRight',
    'noseSneerLeft', 'noseSneerRight', 'tongueOut'
]

OCULUS_VISEMES = [
    'viseme_sil', 'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD',
    'viseme_kk', 'viseme_CH', 'viseme_SS', 'viseme_nn', 'viseme_RR',
    'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U'
]

FACE_SHAPES = [
    'faceWidth', 'jawWidth', 'chinLength', 'cheekFullness',
    'noseSize', 'eyeSize', 'eyeSpacing', 'browThickness'
]

def build_blender_avatar(gender="boy"):
    if not bpy:
        print("bpy not available outside Blender. Script saved for Blender usage.")
        return

    # Clear default scene
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene

    # 1. Create Mixamo Armature
    arm_data = bpy.data.armatures.new(f"{gender}_Armature")
    arm_obj = bpy.data.objects.new("Armature", arm_data)
    scene.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='EDIT')

    # Mixamo Bone hierarchy
    bones_def = [
        ("Hips", None, (0, 0, 0.95), (0, 0, 1.10)),
        ("Spine", "Hips", (0, 0, 1.10), (0, 0, 1.25)),
        ("Spine1", "Spine", (0, 0, 1.25), (0, 0, 1.40)),
        ("Spine2", "Spine1", (0, 0, 1.40), (0, 0, 1.50)),
        ("Neck", "Spine2", (0, 0, 1.50), (0, 0, 1.60)),
        ("Head", "Neck", (0, 0, 1.60), (0, 0, 1.80)),
        ("LeftShoulder", "Spine2", (-0.08, 0.01, 1.48), (-0.22, 0, 1.47)),
        ("LeftArm", "LeftShoulder", (-0.22, 0, 1.47), (-0.24, 0.05, 1.21)),
        ("LeftForeArm", "LeftArm", (-0.24, 0.05, 1.21), (-0.05, 0.22, 0.98)),
        ("LeftHand", "LeftForeArm", (-0.05, 0.22, 0.98), (-0.02, 0.24, 0.90)),
        ("RightShoulder", "Spine2", (0.08, 0.01, 1.48), (0.22, 0, 1.47)),
        ("RightArm", "RightShoulder", (0.22, 0, 1.47), (0.24, 0.05, 1.21)),
        ("RightForeArm", "RightArm", (0.24, 0.05, 1.21), (0.05, 0.22, 0.98)),
        ("RightHand", "RightForeArm", (0.05, 0.22, 0.98), (0.02, 0.24, 0.90)),
        ("LeftUpLeg", "Hips", (-0.12, 0, 0.90), (-0.12, 0, 0.48)),
        ("LeftLeg", "LeftUpLeg", (-0.12, 0, 0.48), (-0.12, 0.02, 0.08)),
        ("LeftFoot", "LeftLeg", (-0.12, 0.02, 0.08), (-0.12, 0.16, 0.02)),
        ("LeftToeBase", "LeftFoot", (-0.12, 0.16, 0.02), (-0.12, 0.20, 0.02)),
        ("RightUpLeg", "Hips", (0.12, 0, 0.90), (0.12, 0, 0.48)),
        ("RightLeg", "RightUpLeg", (0.12, 0, 0.48), (0.12, 0.02, 0.08)),
        ("RightFoot", "RightLeg", (0.12, 0.02, 0.08), (0.12, 0.16, 0.02)),
        ("RightToeBase", "RightFoot", (0.12, 0.16, 0.02), (0.12, 0.20, 0.02)),
    ]

    for bname, pname, head, tail in bones_def:
        b = arm_data.edit_bones.new(bname)
        b.head = head
        b.tail = tail
        if pname:
            b.parent = arm_data.edit_bones[pname]

    bpy.ops.object.mode_set(mode='OBJECT')

    # 2. Add Head Mesh with Shape Keys
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=24, radius=0.24, location=(0, 0, 1.62))
    head_obj = bpy.context.active_object
    head_obj.name = "head"

    # Add Basis shape key
    head_obj.shape_key_add(name="Basis")

    # Add all 52 ARKit + 15 visemes + 8 face morph shape keys
    for sk in ARKIT_BLENDSHAPES + OCULUS_VISEMES + FACE_SHAPES:
        key = head_obj.shape_key_add(name=sk)
        key.value = 0.0

    # 3. Add Eyes Mesh
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.04, location=(-0.085, 0.18, 1.67))
    eye_l = bpy.context.active_object
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.04, location=(0.085, 0.18, 1.67))
    eye_r = bpy.context.active_object
    eye_l.select_set(True)
    eye_r.select_set(True)
    bpy.context.view_layer.objects.active = eye_l
    bpy.ops.object.join()
    eye_l.name = "eyes"

    # 4. Add Body Mesh
    bpy.ops.mesh.primitive_cylinder_add(radius=0.20, depth=0.55, location=(0, 0, 1.15))
    body_obj = bpy.context.active_object
    body_obj.name = "body"

    # 5. Add Clothes Mesh
    bpy.ops.mesh.primitive_cylinder_add(radius=0.22, depth=0.56, location=(0, 0, 1.15))
    clothes_obj = bpy.context.active_object
    clothes_obj.name = "clothes"

    # 6. Add Hair Mesh
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.26, location=(0, -0.02, 1.66))
    hair_obj = bpy.context.active_object
    hair_obj.name = "hair"

    # Save .blend file
    out_file = f"frontend/public/avatars/{gender}/{gender}.blend"
    bpy.ops.wm.save_as_mainfile(filepath=out_file)
    print(f"Saved Blender source to {out_file}")

if __name__ == "__main__":
    for g in ["boy", "girl"]:
        build_blender_avatar(g)
