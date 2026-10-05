"""
run_backend.py - Root entry point to launch the EmotiCare AI / MANAS Backend Server.
Works from any directory without ModuleNotFoundError: No module named 'app'.
"""

import os
import sys

# Ensure root directory and backend directory are in Python path
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")

if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

if __name__ == "__main__":
    import uvicorn
    print("\n========================================================")
    print("  Starting EmotiCare AI / MANAS Backend Server")
    print("  Backend API: http://127.0.0.1:8008")
    print("  Interactive Docs: http://127.0.0.1:8008/docs")
    print("========================================================\n")
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8008, reload=False)
