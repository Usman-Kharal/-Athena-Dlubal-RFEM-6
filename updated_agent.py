import os
import json
from typing import Dict, Any, List, Optional
from langchain_openai import ChatOpenAI
import subprocess
import sys
from dotenv import load_dotenv

load_dotenv()

# --- 1. LOAD DATABASE FROM JSON FILE ---
def load_blocks_database(json_file: str = "blocks_database.json") -> List[Dict]:
    """Load blocks database from JSON file"""
    try:
        with open(json_file, 'r') as f:
            data = json.load(f)
            return data.get('BLOCKS_DB', [])
    except FileNotFoundError:
        print(f"⚠️  Database file '{json_file}' not found. Using fallback data.")
        return get_fallback_database()
    except json.JSONDecodeError as e:
        print(f"⚠️  Error parsing database file: {e}. Using fallback data.")
        return get_fallback_database()

def get_fallback_database() -> List[Dict]:
    """Fallback database if file not found"""
    return [
        {
            "metadata": {
                "id": "parabolic_truss",
                "name": "Parabolic Truss Bridge",
                "description": "Generates a parabolic arch truss bridge structure with configurable bays, supports, and curved top chord.",
                "tags": ["truss", "bridge", "parabolic"],
                "classification": {
                    "dimensionality": "3D",
                    "element_type": "Member",
                    "topology_type": "Lattice"
                }
            },
            "inputs": {
                "selection_modes": {
                    "name": "input_via",
                    "label": "Input Definition Mode",
                    "options": {
                        "define_L1": {
                            "label": "Define Total Length & Outer Bays",
                            "active_params": ["L", "L_1", "H", "H_1", "n"],
                            "calculated_params": ["L_2"]
                        },
                        "define_L2": {
                            "label": "Define Total Length & Inner Bays",
                            "active_params": ["L", "L_2", "H", "H_1", "n"],
                            "calculated_params": ["L_1"]
                        },
                        "define_L1_L2": {
                            "label": "Define All Bay Lengths",
                            "active_params": ["L_1", "L_2", "H", "H_1", "n"],
                            "calculated_params": ["L"]
                        }
                    }
                },
                "parameters": {
                    "n": {
                        "label": "Number of bays",
                        "type": "int",
                        "default": 6,
                        "constraints": {"min": 2, "max": 50, "step": 2, "must_be_even": True}
                    },
                    "L": {
                        "label": "Total length",
                        "type": "float",
                        "unit": "UNIT.LENGTH",
                        "default": 12,
                        "constraints": {"min": 0.1, "step": 0.1}
                    },
                    "L_1": {
                        "label": "Length of outer bays",
                        "type": "float",
                        "unit": "UNIT.LENGTH",
                        "default": 2
                    },
                    "L_2": {
                        "label": "Length of inner bays",
                        "type": "float",
                        "unit": "UNIT.LENGTH",
                        "default": 2
                    },
                    "H": {
                        "label": "Arch height/sag",
                        "type": "float",
                        "unit": "UNIT.LENGTH",
                        "default": 1.5
                    },
                    "H_1": {
                        "label": "Overall structure height",
                        "type": "float",
                        "unit": "UNIT.LENGTH",
                        "default": 1.5
                    }
                }
            }
        }
    ]

# Load database
BLOCKS_DB = load_blocks_database()

# --- 2. HELPER FUNCTIONS TO EXTRACT DATA FROM NEW STRUCTURE ---
class BlockHelper:
    """Helper class to work with the new database structure"""
    
    @staticmethod
    def get_id(block: Dict) -> str:
        return block.get('metadata', {}).get('id', '')
    
    @staticmethod
    def get_name(block: Dict) -> str:
        return block.get('metadata', {}).get('name', '')
    
    @staticmethod
    def get_description(block: Dict) -> str:
        return block.get('metadata', {}).get('description', '')
    
    @staticmethod
    def get_dimensionality(block: Dict) -> str:
        return block.get('metadata', {}).get('classification', {}).get('dimensionality', '2D')
    
    @staticmethod
    def get_tags(block: Dict) -> List[str]:
        return block.get('metadata', {}).get('tags', [])
    
    @staticmethod
    def get_all_parameters(block: Dict) -> Dict:
        """Get all parameters from various input sections"""
        all_params = {}
        inputs = block.get('inputs', {})
        
        # Get parameters from 'parameters' section
        if 'parameters' in inputs:
            all_params.update(inputs['parameters'])
        
        # Get parameters from 'geometry' section
        if 'geometry' in inputs:
            all_params.update(inputs['geometry'])
        
        # Get parameters from 'options' section
        if 'options' in inputs:
            all_params.update(inputs['options'])
        
        return all_params
    
    @staticmethod
    def get_required_params(block: Dict) -> List[str]:
        """Determine required parameters based on selection mode or all parameters"""
        inputs = block.get('inputs', {})
        
        # Check if there's a selection mode
        if 'selection_modes' in inputs:
            mode_name = inputs['selection_modes'].get('name', 'input_via')
            # Default to first mode's active params
            options = inputs['selection_modes'].get('options', {})
            if options:
                first_mode = list(options.values())[0]
                return first_mode.get('active_params', [])
        
        # Otherwise, return all parameter names
        all_params = BlockHelper.get_all_parameters(block)
        return list(all_params.keys())
    
    @staticmethod
    def get_selection_modes(block: Dict) -> Optional[Dict]:
        """Get selection modes if they exist"""
        return block.get('inputs', {}).get('selection_modes')
    
    @staticmethod
    def get_param_info(block: Dict, param_name: str) -> Dict:
        """Get information about a specific parameter"""
        all_params = BlockHelper.get_all_parameters(block)
        return all_params.get(param_name, {})

# --- 3. MATERIALS AND SUPPORTS (Keep existing) ---
MATERIALS_SECTIONS = [
    {"name": "Top chord", "id": 1, "description": "Cross-section for the top chord members"},
    {"name": "Bottom chord", "id": 2, "description": "Cross-section for the bottom chord members"},
    {"name": "Diagonals", "id": 3, "description": "Cross-section for diagonal bracing members"},
    {"name": "Verticals", "id": 4, "description": "Cross-section for vertical members"}
]

SUPPORTS = [
    {"id": 1, "name": "Nodal support - left", "description": "Support at the left end"},
    {"id": 2, "name": "Nodal support - right", "description": "Support at the right end"}
]

# --- 4. INITIALIZE OPENAI LLM ---
llm = ChatOpenAI(model="gpt-3.5-turbo", temperature=0.7)

# --- 5. AGENT STATE CLASS ---
class AgentState:
    def __init__(self):
        self.messages: List[str] = []
        self.conversation_phase: str = "greeting"  # greeting -> dimension -> params -> confirm -> export
        self.truss_dimension: Optional[str] = None  # 2D or 3D
        self.selected_block: Optional[Dict] = None  # Store the entire block dict
        self.selected_block_name: Optional[str] = None
        self.collected_params: Dict[str, Any] = {}
        self.missing_params: List[str] = []
        self.final_output: Optional[Dict] = None
        self.current_selection_mode: Optional[str] = None

# --- 6. GREETING PHASE ---
def greeting_phase(state: AgentState) -> str:
    """Start with inspirational message and ask about project"""
    
    greeting = '🏗️"Design is not just what it looks like and feels like. Design is how it works." - Steve Jobs\n\nLet\'s create an amazing structure together!'
    state.messages.append(f"AI: {greeting}")
    state.conversation_phase = "dimension"
    return greeting

# --- 7. DIMENSION PHASE ---
def dimension_phase(state: AgentState, user_input: str) -> str:
    """Ask if user wants 2D or 3D truss"""
    
    # Simple logic without LLM call for common keywords
    if any(word in user_input.lower() for word in ["2d", "flat", "planar", "single", "warren", "pratt"]):
        dimension = "2D"
    elif any(word in user_input.lower() for word in ["3d", "bridge", "arch", "parabolic", "three", "depth", "spatial"]):
        dimension = "3D"
    else:
        # Only call LLM if unclear
        prompt = f"""The user said: "{user_input}"

Based on their description, determine if they want a 2D or 3D truss structure. 
Respond with ONLY: '2D' or '3D'"""
        response = llm.invoke(prompt)
        dimension = response.content.strip().upper()
    
    if "2D".casefold() in dimension.casefold():
        state.truss_dimension = "2D"
        state.messages.append(f"AI: Great! You want a 2D truss structure. Now, which type would suit your needs?")
    elif "3D".casefold() in dimension.casefold():
        state.truss_dimension = "3D"
        state.messages.append(f"AI: Perfect! A 3D structure for more complex designs. Let me show you the options.")
    else:
        state.messages.append(f"AI: Is your truss 2D (flat/planar) or 3D (with depth)? Let me know so I can suggest the best design.")
        return state.messages[-1]
    
    state.conversation_phase = "block_selection"
    return state.messages[-1]

# --- 8. BLOCK SELECTION PHASE ---
def block_selection_phase(state: AgentState, user_input: str) -> str:
    """Show available blocks and let user choose"""
    
    # Filter blocks by dimension if specified
    available_blocks = BLOCKS_DB
    if state.truss_dimension:
        available_blocks = [
            b for b in BLOCKS_DB 
            if BlockHelper.get_dimensionality(b).upper() == state.truss_dimension.upper()
        ]
    
    if not available_blocks:
        state.messages.append(f"AI: Sorry, no blocks found for {state.truss_dimension}. Let's try again.")
        state.conversation_phase = "dimension"
        return state.messages[-1]
    
    blocks_list = "\n".join([
        f"{i+1}. {BlockHelper.get_name(b)}: {BlockHelper.get_description(b)}"
        for i, b in enumerate(available_blocks)
    ])
    
    prompt = f"""User said: "{user_input}"

Available structure types for {state.truss_dimension} design:
{blocks_list}

Which block best matches their needs? Respond with ONLY the block name, nothing else."""
    
    response = llm.invoke(prompt)
    selected_name = response.content.strip()
    
    # Match block
    for block in available_blocks:
        block_name = BlockHelper.get_name(block)
        if block_name.lower() in selected_name.lower() or selected_name.lower() in block_name.lower():
            state.selected_block = block
            state.selected_block_name = block_name
            break
    
    if not state.selected_block and available_blocks:
        state.selected_block = available_blocks[0]
        state.selected_block_name = BlockHelper.get_name(available_blocks[0])
    
    if state.selected_block:
        state.messages.append(
            f"AI: I recommend: **{state.selected_block_name}**\n"
            f"{BlockHelper.get_description(state.selected_block)}\n\n"
            f"Does this suit your design?"
        )
        state.conversation_phase = "confirm_block"
    
    return state.messages[-1]

# --- 9. CONFIRM BLOCK PHASE ---
def confirm_block_phase(state: AgentState, user_input: str) -> str:
    """Confirm if selected block is suitable"""
    
    prompt = f"""User said: "{user_input}"

Determine if they are accepting or rejecting the proposed block.
Respond with ONLY: 'accept' or 'reject'"""
    
    response = llm.invoke(prompt)
    answer = response.content.strip().lower()
    
    if "accept" in answer or "yes" in user_input.lower() or "good" in user_input.lower() or "ok" in user_input.lower():
        # Check if block has selection modes
        selection_modes = BlockHelper.get_selection_modes(state.selected_block)
        
        if selection_modes:
            state.messages.append(f"AI: Excellent! Now, how would you like to define the parameters?")
            state.conversation_phase = "selection_mode"
        else:
            state.messages.append(f"AI: Excellent! Now let's define the parameters for {state.selected_block_name}.")
            state.conversation_phase = "parameters"
            state.missing_params = BlockHelper.get_required_params(state.selected_block)
    else:
        state.messages.append(f"AI: No problem! Let me suggest another option...")
        state.conversation_phase = "block_selection"
    
    return state.messages[-1]

# --- 10. SELECTION MODE PHASE (NEW) ---
def selection_mode_phase(state: AgentState, user_input: str) -> str:
    """Handle selection mode choice if block has multiple input modes"""
    
    selection_modes = BlockHelper.get_selection_modes(state.selected_block)
    if not selection_modes:
        # Skip to parameters if no selection modes
        state.conversation_phase = "parameters"
        state.missing_params = BlockHelper.get_required_params(state.selected_block)
        return parameters_phase(state, user_input)
    
    mode_name = selection_modes.get('name', 'input_via')
    options = selection_modes.get('options', {})
    
    # Present options
    options_text = "\n".join([
        f"{i+1}. {key}: {value.get('label', key)}"
        for i, (key, value) in enumerate(options.items())
    ])
    
    # Try to match user input to an option
    for mode_key, mode_value in options.items():
        if mode_key.lower() in user_input.lower() or mode_value.get('label', '').lower() in user_input.lower():
            state.current_selection_mode = mode_key
            state.collected_params[mode_name] = mode_key
            state.missing_params = mode_value.get('active_params', [])
            state.messages.append(f"AI: Got it! Using {mode_value.get('label')}. Let's fill in the parameters.")
            state.conversation_phase = "parameters"
            return state.messages[-1]
    
    # If no match, ask user
    state.messages.append(f"AI: Please choose one of these input methods:\n{options_text}")
    return state.messages[-1]

# --- 11. PARAMETERS PHASE ---
def parameters_phase(state: AgentState, user_input: str) -> str:
    """Collect parameters"""
    
    if not state.selected_block:
        return "Error: No block selected"
    
    # Get currently missing parameters
    if not state.missing_params:
        state.missing_params = BlockHelper.get_required_params(state.selected_block)
    
    missing = [p for p in state.missing_params if p not in state.collected_params]
    
    if not missing:
        # All parameters collected
        state.messages.append(f"AI: Perfect! All parameters collected. Preparing your model...")
        state.conversation_phase = "export"
        return state.messages[-1]
    
    # Get all parameter details
    all_param_details = BlockHelper.get_all_parameters(state.selected_block)
    
    # Extract parameters from input using LLM
    param_descriptions = json.dumps(all_param_details, indent=2)
    
    prompt = f"""Extract structural parameters from user input.

All Parameters Available:
{param_descriptions}

Still Need to Collect: {', '.join(missing)}

User said: "{user_input}"

IMPORTANT: Extract the FIRST missing parameter from the "Still Need to Collect" list.
The first missing parameter is: "{missing[0]}"

Mapping rules:
- Numbers with "m" or without unit = length values (L, L_1, L_2, H, H_1)
- Whole numbers like "6", "8" = n (number of bays)
- "define_L1" or "L and L1" = input_via: "define_L1"
- "define_L2" or "L and L2" = input_via: "define_L2"
- "L1 and L2" = input_via: "define_L1_L2"
- Boolean values: "yes", "true", "include" = true; "no", "false", "exclude" = false

For the FIRST missing parameter "{missing[0]}", extract its value.

Respond ONLY with valid JSON:
{{"{missing[0]}": value}}

If user didn't provide the missing parameter, respond with: {{}}"""
    
    response = llm.invoke(prompt)
    
    try:
        json_str = response.content.strip()
        # Clean up markdown code blocks
        if "```" in json_str:
            json_str = json_str.split("```")[1]
            if json_str.startswith("json"):
                json_str = json_str[4:]
        
        extracted = json.loads(json_str)
        if extracted:
            state.collected_params.update(extracted)
            state.messages.append(f"AI: Got it! {extracted}")
        else:
            state.messages.append(f"AI: I didn't catch that. Can you provide a value?")
    except Exception as e:
        state.messages.append(f"AI: I didn't catch that. Can you provide a value?")
    
    # Recheck what's still missing
    missing = [p for p in state.missing_params if p not in state.collected_params]
    
    if missing:
        # Ask for the next parameter smartly
        param_name = missing[0]
        param_info = all_param_details.get(param_name, {})
        
        # Check if it's in selection_modes
        selection_modes = BlockHelper.get_selection_modes(state.selected_block)
        if selection_modes and param_name == selection_modes.get('name'):
            options = selection_modes.get('options', {})
            options_text = ", ".join(options.keys())
            state.messages.append(f"AI: For the input method, choose: {options_text}")
        else:
            unit = param_info.get('unit', '').replace('UNIT.', '').replace('LENGTH', 'm').replace('ANGLE', 'degrees')
            label = param_info.get('label', param_name)
            description = param_info.get('description', '')
            
            if unit:
                state.messages.append(f"AI: What is the {label}? ({description if description else param_name} - in {unit})")
            else:
                state.messages.append(f"AI: What is the {label}? ({description if description else param_name})")
    else:
        # All parameters collected
        state.messages.append(f"AI: Perfect! All parameters collected. Preparing your model...")
        state.conversation_phase = "export"
    
    return state.messages[-1]

# --- 12. RFEM EXPORT ---
def export_to_rfem(state: AgentState) -> str:
    """Generate RFEM-compatible JSON and export"""
    
    state.final_output = {
        "model_info": {
            "block_id": BlockHelper.get_id(state.selected_block),
            "block_name": state.selected_block_name,
            "dimension": state.truss_dimension,
            "tags": BlockHelper.get_tags(state.selected_block),
            "created_by": "OpenAI Structural Agent"
        },
        "parameters": state.collected_params,
        "materials": MATERIALS_SECTIONS,
        "supports": SUPPORTS
    }
    
    # Generate RFEM JSON format
    rfem_json = json.dumps(state.final_output, indent=2)
    
    # Save to file
    filename = f"rfem_model_{state.selected_block_name.replace(' ', '_')}.json"
    with open(filename, 'w') as f:
        f.write(rfem_json)
    
    # Create HTML visualization
    html_visualization = generate_truss_visualization(
        state.selected_block_name, 
        state.truss_dimension, 
        state.collected_params
    )
    html_filename = f"truss_preview_{state.selected_block_name.replace(' ', '_')}.html"
    with open(html_filename, 'w') as f:
        f.write(html_visualization)
    
    state.messages.append(f"✅ AI: Model saved as '{filename}'")
    state.messages.append(f"📊 AI: Preview saved as '{html_filename}' - Open in browser to see your structure!")
    state.messages.append(f"📋 JSON Output:\n{rfem_json}")
    
    # Try to open in RFEM
    state.messages.append(f"🔗 Attempting to connect to RFEM...")
    open_in_rfem(filename, state)
    
    # RFEM Import instruction
    rfem_instructions = f"""
RFEM IMPORT INSTRUCTIONS:
1. Open RFEM 9
2. Go to File → Import → JSON Model
3. Select: {filename}
4. The model will be generated with your parameters
5. Model Details:
   - Type: {state.selected_block_name}
   - Dimension: {state.truss_dimension}
   - Parameters: {state.collected_params}
"""
    state.messages.append(rfem_instructions)
    
    return "export_complete"

def open_in_rfem(json_file: str, state: AgentState):
    """Try to open the model in RFEM"""
    try:
        # Windows path for RFEM
        rfem_path = r"C:\Program Files\Dlubal\RFEM 9\RFEM9.exe"
        
        # Check if RFEM is installed
        if os.path.exists(rfem_path):
            state.messages.append(f"🚀 Opening in RFEM 9...")
            # Try to open RFEM with the file
            subprocess.Popen([rfem_path, json_file])
        else:
            state.messages.append(f"⚠️  RFEM 9 not found at default location.")
            state.messages.append(f"📂 Please manually open: {os.path.abspath(json_file)}")
            state.messages.append(f"💡 Or copy the JSON file to your RFEM import folder.")
    except Exception as e:
        state.messages.append(f"⚠️  Could not auto-open RFEM: {str(e)}")
        state.messages.append(f"📂 Please manually open RFEM and import: {json_file}")

def generate_truss_visualization(block_name: str, dimension: str, params: Dict[str, Any]) -> str:
    """Generate a simple HTML visualization of the truss"""
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Structure Preview - {block_name}</title>
        <style>
            body {{
                font-family: Arial, sans-serif;
                margin: 20px;
                background-color: #f5f5f5;
            }}
            .container {{
                background: white;
                padding: 30px;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                max-width: 1000px;
                margin: 0 auto;
            }}
            h1 {{
                color: #333;
                border-bottom: 3px solid #007bff;
                padding-bottom: 10px;
            }}
            h2 {{
                color: #555;
                margin-top: 30px;
            }}
            .params {{
                background: #f9f9f9;
                padding: 15px;
                border-left: 4px solid #007bff;
                margin: 15px 0;
            }}
            .params table {{
                width: 100%;
                border-collapse: collapse;
            }}
            .params th, .params td {{
                text-align: left;
                padding: 8px;
                border-bottom: 1px solid #ddd;
            }}
            .params th {{
                background-color: #007bff;
                color: white;
            }}
            canvas {{
                border: 1px solid #ccc;
                margin: 20px 0;
                background: white;
            }}
            .info {{
                background: #e7f3ff;
                padding: 15px;
                border-radius: 5px;
                margin: 15px 0;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🏗️ {block_name} - Preview</h1>
            <p><strong>Dimension:</strong> {dimension}</p>
            
            <h2>Parameters:</h2>
            <div class="params">
                <table>
                    <tr>
                        <th>Parameter</th>
                        <th>Value</th>
                    </tr>
    """
    
    for key, value in params.items():
        html += f"<tr><td>{key}</td><td>{value}</td></tr>\n"
    
    html += """
                </table>
            </div>
            
            <h2>Visualization:</h2>
            <canvas id="canvas" width="800" height="400"></canvas>
            
            <div class="info">
                <strong>Note:</strong> This is a simplified preview. For detailed structural analysis, import this model into RFEM.
            </div>
        </div>
        
        <script>
            const canvas = document.getElementById('canvas');
            const ctx = canvas.getContext('2d');
            
            // Draw simple structure representation
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            
            // Draw title
            ctx.fillStyle = '#666';
            ctx.font = '14px Arial';
            ctx.fillText('Structure Preview', 10, 20);
            
            // Draw a simple representation
            ctx.beginPath();
            ctx.moveTo(50, 350);
            
            // Draw curved top chord
            for(let x = 50; x <= 750; x += 10) {
                const t = (x - 50) / 700;
                const y = 150 + (150 * Math.sin(Math.PI * t));
                ctx.lineTo(x, y);
            }
            ctx.stroke();
            
            // Draw bottom chord
            ctx.beginPath();
            ctx.moveTo(50, 350);
            ctx.lineTo(750, 350);
            ctx.stroke();
            
            // Draw supports
            ctx.fillStyle = '#007bff';
            ctx.fillRect(45, 350, 10, 30);
            ctx.fillRect(745, 350, 10, 30);
            
            ctx.fillStyle = '#666';
            ctx.font = 'bold 12px Arial';
            ctx.fillText('Left Support', 30, 390);
            ctx.fillText('Right Support', 720, 390);
            
            // Draw vertical members
            ctx.strokeStyle = '#888';
            ctx.lineWidth = 1;
            for(let x = 100; x < 750; x += 100) {
                const t = (x - 50) / 700;
                const y = 150 + (150 * Math.sin(Math.PI * t));
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x, 350);
                ctx.stroke();
            }
        </script>
    </body>
    </html>
    """
    
    return html

# --- 13. MAIN AGENT LOOP ---
def run_agent():
    state = AgentState()
    
    print("\n" + "="*70)
    print("🏗️  STRUCTURAL ENGINEERING ASSISTANT - POWERED BY OPENAI")
    print("="*70 + "\n")
    
    # Show loaded blocks
    print(f"📚 Loaded {len(BLOCKS_DB)} structure type(s) from database")
    for block in BLOCKS_DB:
        print(f"   - {BlockHelper.get_name(block)} ({BlockHelper.get_dimensionality(block)})")
    print()
    
    # Greeting
    print(greeting_phase(state))
    
    while True:
        print("\n" + "-"*70)
        user_input = input("\n👤 You: ").strip()
        
        if not user_input:
            continue
        
        if user_input.lower() in ["quit", "exit"]:
            print("\n🙏 Thank you for using Structural Engineering Assistant!")
            break
        
        if user_input.lower() == "reset":
            state = AgentState()
            print(greeting_phase(state))
            continue
        
        state.messages.append(f"User: {user_input}")
        
        # Route to appropriate phase
        if state.conversation_phase == "dimension":
            response = dimension_phase(state, user_input)
        
        elif state.conversation_phase == "block_selection":
            response = block_selection_phase(state, user_input)
        
        elif state.conversation_phase == "confirm_block":
            response = confirm_block_phase(state, user_input)
        
        elif state.conversation_phase == "selection_mode":
            response = selection_mode_phase(state, user_input)
        
        elif state.conversation_phase == "parameters":
            response = parameters_phase(state, user_input)
        
        elif state.conversation_phase == "export":
            export_to_rfem(state)
            print("\n" + "="*70)
            print("🎉 DESIGN COMPLETE - READY FOR RFEM")
            print("="*70)
            for msg in state.messages[-6:]:
                if msg.startswith("AI:") or msg.startswith("✅") or msg.startswith("📊") or msg.startswith("📋") or msg.startswith("🔗"):
                    print(f"\n🤖 {msg}")
            
            again = input("\n\n🔄 Create another design? (yes/no): ").strip().lower()
            if again == "yes":
                state = AgentState()
                print(greeting_phase(state))
            else:
                print("\n🙏 Thank you for using Structural Engineering Assistant!")
                break
            continue
        
        # Print latest message
        print(f"\n🤖 {response}")

if __name__ == "__main__":
    run_agent()
