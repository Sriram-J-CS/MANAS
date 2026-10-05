"""
run_backend.py - Universal launcher for EmotiCare AI / MANAS Backend.
Works from any folder: root, backend, or backend/app.
"""
import os
import sys

# Compute project root from current script location
script_dir = os.path.dirname(os.path.abspath(__file__))
if os.path.exists(os.path.join(script_dir, "database.py")):
    app_dir = script_dir
    backend_dir = os.path.dirname(app_dir)
    root_dir = os.path.dirname(backend_dir)
elif os.path.exists(os.path.join(script_dir, "app", "database.py")):
    backend_dir = script_dir
    root_dir = os.path.dirname(backend_dir)
else:
    root_dir = script_dir
    backend_dir = os.path.join(root_dir, "backend")

for p in [root_dir, backend_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)

if __name__ == "__main__":
    import uvicorn
    print("\n========================================================")
    print("  Starting EmotiCare AI / MANAS Backend Server")
    print("  Backend API: http://127.0.0.1:8008")
    print("  Interactive Docs: http://127.0.0.1:8008/docs")
    print("========================================================\n")
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8008, reload=False)
