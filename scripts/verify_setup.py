
import sys
import os
import json
import traceback

# Add parent directory to path to find shared_logic
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def verify():
    print("Verifying setup...")
    
    # 1. Check imports
    try:
        print("Importing shared_logic...")
        import shared_logic
        print("shared_logic imported successfully.")
    except Exception as e:
        print(f"FAILED to import shared_logic: {e}")
        traceback.print_exc()
        return

    # 2. Check Database Loading
    try:
        print("Initializing BlockDatabase...")
        db = shared_logic.BlockDatabase("2D/2D_DB.json", "3D/3D_DB.json")
        print(f"2D Blocks Loaded: {len(db.db_2d)}")
        print(f"3D Blocks Loaded: {len(db.db_3d)}")
        
        if len(db.db_2d) == 0:
            print("WARNING: 0 blocks loaded for 2D!")
            # Check if file exists relative to shared_logic
            base_dir = os.path.dirname(shared_logic.__file__)
            path = os.path.join(base_dir, "2D/2D_DB.json")
            if os.path.exists(path):
                print(f"File exists at {path}. Possible JSON error?")
                with open(path, 'r') as f:
                    content = f.read()
                    print(f"File content preview: {content[:100]}...")
            else:
                print(f"File NOT found at {path}")

        if len(db.db_3d) == 0:
            print("WARNING: 0 blocks loaded for 3D!")
             # Check if file exists
            base_dir = os.path.dirname(shared_logic.__file__)
            path = os.path.join(base_dir, "3D/3D_DB.json")
            if os.path.exists(path):
                print(f"File exists at {path}. Possible JSON error?")
            else:
                print(f"File NOT found at {path}")
                
    except Exception as e:
        print(f"FAILED to initialize database: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    verify()
