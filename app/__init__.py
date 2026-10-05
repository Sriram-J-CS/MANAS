"""
Shim package to forward root-level 'app' imports to 'backend.app'.
Prevents ModuleNotFoundError if running uvicorn from the project root.
"""
import os
import sys

_backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

_backend_app_dir = os.path.join(_backend_dir, "app")
if os.path.exists(_backend_app_dir) and _backend_app_dir not in __path__:
    __path__.append(_backend_app_dir)

