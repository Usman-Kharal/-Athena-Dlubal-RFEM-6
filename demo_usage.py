import json
from block_model import RFEMBlockModel, InputVia

def main():
    print("--- RFEM Block Model Demo ---\n")

    # 1. Instantiate the model with some parameters
    try:
        # Example 1: Defining L and L1
        truss_params = RFEMBlockModel(
            n=8,
            input_via=InputVia.DEFINE_L1,
            L=20.0,
            L_1=3.0,
            H=2.5,
            H_1=3.0
        )
        print("✅ Model created successfully:")
        print(f"   Input: n=8, L=20, L1=3")
        print(f"   Calculated L2: {truss_params.L_2:.2f}") # L2 is calculated automatically
        
    except ValueError as e:
        print(f"❌ Validation Error: {e}")
        return

    # 2. Load the Block Definition
    try:
        with open("block_definition.json", "r") as f:
            block_def = json.load(f)
        print(f"\n✅ Loaded Block Definition: '{block_def['name']}'")
    except FileNotFoundError:
        print("❌ block_definition.json not found.")
        return

    # 3. Representing the Truss for Export
    # We combine the script and the specific parameters for this instance
    export_data = {
        "block_name": block_def["name"],
        "parameters": truss_params.model_dump(),
        "script": block_def["script"]
    }

    output_file = "truss_export.json"
    with open(output_file, "w") as f:
        json.dump(export_data, f, indent=2)

    print(f"\n✅ Exported truss data to '{output_file}'")
    print("\n--- How to Import to Dlubal RFEM ---")
    print("1. To use the BLOCK logic directly in RFEM:")
    print("   - Copy the content of the 'script' field from 'block_definition.json' into a new JavaScript file (e.g., 'Block.js') in RFEM.")
    print("   - Run that script within RFEM's scripting environment.")
    print("\n2. To use the JSON parameters:")
    print("   - You can use an RFEM Python script to read 'truss_export.json'.")
    print("   - Then inject the 'parameters' into the block script execution.")

if __name__ == "__main__":
    main()
