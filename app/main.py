"""
Root shim for backend.app.main.
Allows running:
  python -m uvicorn app.main:app
directly from the project root directory.
"""
import os
import sys

_root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_backend_dir = os.path.join(_root_dir, "backend")

for p in [_root_dir, _backend_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)

from backend.app.main import app
