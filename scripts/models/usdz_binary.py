"""Rewrites a USDZ whose layers are text (usda) with binary layers (usdc), in place.

three's USDZ exporter writes text: for a model of 200,000 triangles, a USDZ three times
the size of its GLB. Pixar's own library (usd-core) writes the binary form and packages
it the way ARKit and Quick Look want: uncompressed, 64-byte aligned, root layer first.
The geometry, materials and textures are the same. Run by ar-variants.ts:

    python usdz_binary.py public/models/ar/iss.usdz [...]
"""

import os
import shutil
import sys
import tempfile
import zipfile

from pxr import Sdf, UsdUtils


def to_binary(path: str) -> None:
    work = tempfile.mkdtemp()
    try:
        with zipfile.ZipFile(path) as package:
            package.extractall(work)
        layers = []
        for root, _, files in os.walk(work):
            for name in files:
                if name.endswith('.usda'):
                    text = os.path.join(root, name)
                    Sdf.Layer.FindOrOpen(text).Export(text[:-5] + '.usdc')
                    os.remove(text)
                    layers.append(text[:-5] + '.usdc')
        # References between layers name the text files: point them at the binary ones.
        for binary in layers:
            layer = Sdf.Layer.FindOrOpen(binary)
            UsdUtils.ModifyAssetPaths(
                layer, lambda asset: asset[:-5] + '.usdc' if asset.endswith('.usda') else asset
            )
            layer.Save()
        packed = os.path.join(work, 'packed.usdz')
        if not UsdUtils.CreateNewARKitUsdzPackage(os.path.join(work, 'model.usdc'), packed):
            raise SystemExit(f'{path}: could not package')
        shutil.move(packed, path)
    finally:
        shutil.rmtree(work, ignore_errors=True)


for usdz in sys.argv[1:]:
    to_binary(usdz)
