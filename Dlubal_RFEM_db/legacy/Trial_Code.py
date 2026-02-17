import json
import os
import re
from typing import TypedDict, Annotated, Optional, Dict, Any, List, Union, Callable
from enum import Enum
from dataclasses import dataclass
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from pydantic import BaseModel, Field, validator
import esprima  # JavaScript AST parser: pip install esprima-py
from dotenv import load_dotenv
load_dotenv()

# ============================================================================
# 1. ENHANCED DATABASE WITH CONSTRAINT ENGINE
# ============================================================================

class ConstraintEngine:
    """Handles complex constraints like expressions and dependencies"""
    
    @staticmethod
    def evaluate_expression(expression: str, context: Dict[str, float]) -> float:
        """Safely evaluate mathematical expressions like 'a / 2', 'PI / 12'"""
        safe_dict = {
            'PI': 3.14159265359,
            'sin': lambda x: __import__('math').sin(x),
            'cos': lambda x: __import__('math').cos(x),
            'tan': lambda x: __import__('math').tan(x),
            'sqrt': lambda x: __import__('math').sqrt(x),
            'abs': abs,
            'min': min,
            'max': max
        }
        safe_dict.update(context)
        
        try:
            return eval(expression, {"__builtins__": {}}, safe_dict)
        except:
            return None
    
    @staticmethod
    def validate_constraint(param_value: Any, schema: Dict, all_params: Dict) -> tuple[bool, str]:
        """Validate value against all constraint types"""
        constraints = schema.get("constraints", {})
        
        # Numeric constraints
        if "min" in constraints:
            if param_value < constraints["min"]:
                return False, f"Must be ≥ {constraints['min']}"
        
        if "max" in constraints:
            if param_value > constraints["max"]:
                return False, f"Must be ≤ {constraints['max']}"
        
        if "max_expression" in constraints:
            max_val = ConstraintEngine.evaluate_expression(
                constraints["max_expression"], all_params
            )
            if max_val is not None and param_value > max_val:
                return False, f"Must be ≤ {max_val:.2f} (based on other parameters)"
        
        if "must_be_even" in constraints and constraints["must_be_even"]:
            if int(param_value) % 2 != 0:
                return False, "Must be an even number"
        
        if "step" in constraints:
            step = constraints["step"]
            base = constraints.get("min", 0)
            if (param_value - base) % step != 0:
                return False, f"Must increment in steps of {step}"
        
        return True, ""

# Get the directory where this script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

class BlockDatabase:
    def __init__(self, db_2d_path: str, db_3d_path: str):
        # Resolve paths relative to script directory
        db_2d_full = os.path.join(SCRIPT_DIR, db_2d_path)
        db_3d_full = os.path.join(SCRIPT_DIR, db_3d_path)
        
        with open(db_2d_full) as f:
            self.db_2d = json.load(f)["elements"]
        with open(db_3d_full) as f:
            self.db_3d = json.load(f)["elements"]
        
        self.all_blocks = {b["id"]: b for b in self.db_2d + self.db_3d}
    
    # ========== RIGID FILTERING METHODS ==========
    
    def filter_by_dimensionality(self, dim: str) -> List[Dict]:
        """Get all blocks matching the exact dimensionality (2D or 3D)"""
        dim_upper = dim.upper()
        if dim_upper == "2D":
            return self.db_2d
        elif dim_upper == "3D":
            return self.db_3d
        return list(self.all_blocks.values())
    
    def get_structure_types(self, dim: str) -> List[str]:
        """Get unique structure types (main_member) for a dimensionality"""
        blocks = self.filter_by_dimensionality(dim)
        types = set()
        for block in blocks:
            main_member = block.get("main_member", "")
            if main_member:
                types.add(main_member.lower())
        return sorted(list(types))
    
    def get_materials(self, dim: str, structure_type: str = None) -> List[str]:
        """Get unique materials available for given dimensionality and structure type"""
        blocks = self.filter_by_dimensionality(dim)
        if structure_type:
            blocks = [b for b in blocks if b.get("main_member", "").lower() == structure_type.lower()]
        materials = set()
        for block in blocks:
            material = block.get("material", "")
            if material:
                materials.add(material.lower())
        return sorted(list(materials))
    
    def filter_blocks(self, dim: str = None, structure_type: str = None, material: str = None) -> List[Dict]:
        """Filter blocks by exact criteria - rigid filtering"""
        # Start with dimensionality filter
        if dim:
            blocks = self.filter_by_dimensionality(dim)
        else:
            blocks = list(self.all_blocks.values())
        
        # Filter by structure type (main_member)
        if structure_type:
            blocks = [b for b in blocks if b.get("main_member", "").lower() == structure_type.lower()]
        
        # Filter by material
        if material and material.lower() != "any":
            blocks = [b for b in blocks if b.get("material", "").lower() == material.lower()]
        
        return blocks
    
    def get_block(self, block_id: str) -> Dict:
        return self.all_blocks.get(block_id)
    
    def get_param_schema(self, block_id: str) -> Dict[str, Dict]:
        """Extract flat parameter schema with full metadata"""
        block = self.get_block(block_id)
        if not block:
            return {}
        
        inputs = block.get("inputs", {})
        flat_params = {}
        
        # Recursively find all parameter definitions
        def extract_params(obj, parent_key=""):
            if isinstance(obj, dict):
                # Check if this is a leaf parameter node (has 'type' or 'default')
                if "type" in obj or "default" in obj:
                    # This is a parameter definition
                    if parent_key:
                        flat_params[parent_key] = obj
                else:
                    # This is a container - recurse into it
                    for key, value in obj.items():
                        # Skip meta sections
                        if key in ["dynamic_arrays", "selection_modes"]:
                            continue
                        # For nested containers, use the inner key as the param name
                        if isinstance(value, dict):
                            # Check if value is a parameter definition
                            if "type" in value or "default" in value:
                                flat_params[key] = value
                            else:
                                # Recurse into container
                                extract_params(value, key)
        
        extract_params(inputs)
        
        # Handle dynamic arrays
        if "dynamic_arrays" in inputs:
            for arr_def in inputs["dynamic_arrays"]:
                driver = arr_def["driver_variable"]
                flat_params[f"__dynamic_config_{driver}"] = {
                    "type": "__dynamic_array_meta",
                    "config": arr_def
                }
        
        # Handle selection modes
        if "selection_modes" in inputs:
            flat_params["__selection_mode"] = {
                "type": "__selection_mode_meta",
                "config": inputs["selection_modes"]
            }
        
        return flat_params

# Global instance - load from subdirectories
db = BlockDatabase("2D/2D_DB.json", "3D/3D_DB.json")

# ============================================================================
# 2. AST-BASED JS MANIPULATOR (Robust Code Injection)
# ============================================================================

class JSManipulator:
    """Uses Esprima AST parsing for safe code modification"""
    
    def __init__(self, js_code: str):
        self.original_code = js_code
        self.ast = esprima.parseScript(js_code, {"range": True, "tokens": True})
        self.modifications = []
    
    def find_parameter_calls(self):
        """Find all parameter_float, parameter_int, parameter_check calls"""
        calls = []
        
        def traverse(node):
            # Check if this is a call expression we care about
            if hasattr(node, 'type') and node.type == 'CallExpression':
                if hasattr(node, 'callee') and hasattr(node.callee, 'name'):
                    if node.callee.name in ['parameter_float', 'parameter_int', 'parameter_check']:
                        args = node.arguments
                        if len(args) >= 2:
                            # Extract parameter name (2nd argument, usually)
                            param_name = None
                            if hasattr(args[1], 'type') and args[1].type == 'Literal':
                                param_name = args[1].value
                            
                            if param_name:
                                calls.append({
                                    'name': param_name,
                                    'node': node,
                                    'range': node.range,
                                    'args': args,
                                    'func_name': node.callee.name
                                })
            
            # Recursively traverse children
            for attr in dir(node):
                if attr.startswith('_'):
                    continue
                try:
                    value = getattr(node, attr)
                except:
                    continue
                    
                if isinstance(value, list):
                    for item in value:
                        if hasattr(item, 'type'):
                            traverse(item)
                elif hasattr(value, 'type'):
                    traverse(value)
        
        traverse(self.ast)
        return calls
    
    def inject_parameters(self, params: Dict[str, Any]) -> str:
        """Inject parameters safely by replacing AST nodes"""
        calls = self.find_parameter_calls()
        code_lines = self.original_code.split('\n')
        
        print(f"\n🔧 DEBUG: Found {len(calls)} parameter calls in JS template")
        for call in calls:
            print(f"   📍 {call['name']} at position {call['range']}")
        
        print(f"🔧 DEBUG: Parameters to inject: {params}")
        
        # Track replacements by line/position
        replacements = []
        
        for call in calls:
            param_name = call['name']
            if param_name not in params:
                print(f"   ⏩ Skipping {param_name} - not in user params")
                continue
            
            user_val = params[param_name]
            args = call['args']
            
            # Determine position of default value (4th argument for parameter_float/int)
            if len(args) >= 4:
                default_arg = args[3]
                start, end = default_arg.range
                
                # Convert Python value to JS literal
                if isinstance(user_val, bool):
                    js_val = "true" if user_val else "false"
                elif isinstance(user_val, (int, float)):
                    js_val = str(user_val)
                elif isinstance(user_val, str):
                    js_val = f"'{user_val}'"
                else:
                    print(f"   ⚠️ Skipping {param_name} - unsupported type {type(user_val)}")
                    continue
                
                print(f"   ✅ Replacing {param_name}: position [{start}:{end}] with {js_val}")
                replacements.append((start, end, js_val))
            else:
                print(f"   ⚠️ {param_name} has less than 4 args, skipping")
        
        print(f"\n🔧 DEBUG: Total replacements to apply: {len(replacements)}")
        
        # Apply replacements in reverse order (so positions don't shift)
        replacements.sort(reverse=True)
        result = self.original_code
        for start, end, new_val in replacements:
            result = result[:start] + new_val + result[end:]
        
        return result
    
    def verify_syntax(self, code: str) -> bool:
        """Verify the generated code is valid JavaScript"""
        try:
            esprima.parseScript(code)
            return True
        except:
            return False

# ============================================================================
# 3. STATE MANAGEMENT
# ============================================================================

class BlockState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    intent_2d_3d: Optional[str]
    structure_type: Optional[str]
    selected_block_id: Optional[str]
    selected_block: Optional[Dict]
    block_candidates: Optional[List[Dict]]  # Store alternatives for "no" response
    phase: Optional[str]  # "classify", "confirmation", "collecting", "generating"
    selection_mode: Optional[str]  # Active selection mode (define_L1, etc.)
    collected_params: Dict[str, Any]
    dynamic_array_states: Dict[str, int]  # Track n -> count mappings
    js_template: Optional[str]
    generated_js: Optional[str]
    pending_questions: List[Dict]  # Queue of questions to ask
    current_question: Optional[Dict]
    block_confirmed: Optional[bool]  # Whether user confirmed the block selection

# ============================================================================
# 4. ADVANCED PARAMETER ORCHESTRATOR
# ============================================================================

class ParameterOrchestrator:
    """Handles complex logic: selection modes, dependencies, dynamic arrays"""
    
    def __init__(self, block_id: str):
        self.block_id = block_id
        self.block = db.get_block(block_id)
        self.schema = db.get_param_schema(block_id)
    
    def get_active_params(self, collected: Dict) -> List[tuple]:
        """Get list of parameters that should be collected based on current state"""
        active = []
        
        # Get all parameters from schema
        for key, schema in self.schema.items():
            # Skip internal parameters
            if key.startswith("__"):
                continue
            # Skip already collected
            if key in collected:
                continue
            # Check if this parameter has valid type info
            if "type" in schema or "default" in schema:
                active.append((key, schema))
        
        return active
    
    def _check_dependency(self, schema: Dict, collected: Dict) -> bool:
        """Evaluate dependency expression"""
        if "dependency" not in schema:
            return True
        
        dep_expr = schema["dependency"]
        
        # Simple expression evaluation
        try:
            # Replace variable names with values
            for var_name, var_val in collected.items():
                if isinstance(var_val, (int, float)):
                    dep_expr = dep_expr.replace(var_name, str(var_val))
                elif isinstance(var_val, bool):
                    dep_expr = dep_expr.replace(var_name, str(var_val).lower())
                elif isinstance(var_val, str):
                    dep_expr = dep_expr.replace(var_name, f"'{var_val}'")
            
            # Handle ==, !=, <, > operators
            return eval(dep_expr)
        except:
            return True
    
    def validate_value(self, key: str, value: Any, collected: Dict) -> tuple[bool, str]:
        """Validate value against schema and constraints"""
        schema = self.schema.get(key, {})
        
        # Type conversion
        target_type = schema.get("type", "float")
        try:
            if target_type == "int":
                value = int(float(value))
            elif target_type == "float":
                value = float(value)
            elif target_type == "boolean":
                value = str(value).lower() in ["true", "yes", "1", "y"]
        except ValueError:
            return False, f"Invalid type. Expected {target_type}"
        
        # Constraint validation
        is_valid, msg = ConstraintEngine.validate_constraint(value, schema, collected)
        if not is_valid:
            return False, msg
        
        # Special validation: check if this is the driver for dynamic arrays
        # If 'n' changes, we might need to reset dependent params
        for skey, sval in self.schema.items():
            if sval.get("type") == "__dynamic_array_meta":
                if sval["config"]["driver_variable"] == key:
                    # Changing this will invalidate dynamic array params
                    pass
        
        return True, value

# ============================================================================
# 5. GUIDED CONVERSATION NODES
# ============================================================================

llm = ChatOpenAI(model="gpt-4o", temperature=0)

# Questions to gather requirements
GATHERING_STEPS = [
    {
        "key": "dimensionality",
        "question": "Let's start! What **dimensionality** do you need?\n\n  1️⃣  **2D** - Plane frame, single plane analysis\n  2️⃣  **3D** - Full spatial structure\n\nJust type **2D** or **3D**:",
        "options": ["2d", "3d", "1", "2"],
        "normalize": lambda x: "2D" if x in ["2d", "1"] else "3D"
    },
    {
        "key": "structure_type", 
        "question": "Great! What **type of structure** do you want to create?\n\n  🏭 **hall** - Industrial/warehouse buildings\n  🌉 **bridge** - Bridge structures\n  🔺 **truss** - Truss systems\n  🏗️ **frame** - Frame structures\n  🗼 **tower** - Tower/mast structures\n  ⛺ **canopy** - Canopy/roof structures\n  🌈 **arch** - Arch structures\n\nType your choice:",
        "options": ["hall", "bridge", "truss", "frame", "tower", "canopy", "arch", "beam", "surface"],
        "normalize": lambda x: x.lower().strip()
    },
    {
        "key": "material",
        "question": "What **material** should the structure use?\n\n  🔩 **steel** - Steel members\n  🪵 **timber** - Timber/wood\n  🧱 **concrete** - Concrete\n  ❓ **any** - No preference\n\nType your choice:",
        "options": ["steel", "timber", "wood", "concrete", "any"],
        "normalize": lambda x: "timber" if x.lower() == "wood" else ("any" if x.lower() in ["any", "no preference", ""] else x.lower())
    }
]

def gathering_node(state: BlockState):
    """Ask questions one by one to gather requirements"""
    collected = state.get("collected_params", {})
    
    # Find next unanswered question
    for step in GATHERING_STEPS:
        if step["key"] not in collected:
            return {
                "current_question": {
                    "type": "GATHERING",
                    "key": step["key"],
                    "text": step["question"],
                    "options": step["options"],
                    "normalize": step["normalize"]
                },
                "phase": "gathering",
                "messages": [AIMessage(content=step["question"])]
            }
    
    # All questions answered - move to block search
    return {
        "phase": "searching",
        "current_question": {"type": "SEARCH_COMPLETE"}
    }

def process_gathering_input(state: BlockState):
    """Process user answer to gathering question"""
    question = state.get("current_question", {})
    if question.get("type") != "GATHERING":
        return {}
    
    user_input = state["messages"][-1].content.strip().lower()
    collected = state.get("collected_params", {})
    
    key = question["key"]
    options = question.get("options", [])
    normalize = question.get("normalize", lambda x: x)
    
    # Validate input
    if options and user_input not in [o.lower() for o in options]:
        # Try partial matching
        matched = [o for o in options if user_input in o.lower() or o.lower() in user_input]
        if not matched:
            return {
                "messages": [AIMessage(content=f"I didn't understand that. Please choose one of the options above.")]
            }
        user_input = matched[0].lower()
    
    # Normalize and save
    normalized_value = normalize(user_input)
    new_collected = {**collected, key: normalized_value}
    
    # Friendly confirmation
    confirmations = {
        "dimensionality": f"✅ Got it! We'll work with **{normalized_value}** structures.",
        "structure_type": f"✅ Perfect! Looking for **{normalized_value}** structures.",
        "material": f"✅ Material preference: **{normalized_value}**."
    }
    
    return {
        "collected_params": new_collected,
        "messages": [AIMessage(content=confirmations.get(key, f"✅ {key}: {normalized_value}"))]
    }

def search_blocks_node(state: BlockState):
    """Search for matching blocks and display in table format"""
    collected = state.get("collected_params", {})
    
    dimensionality = collected.get("dimensionality", "")
    structure_type = collected.get("structure_type", "")
    material = collected.get("material", "any")
    
    # Build search query
    query = f"{dimensionality} {structure_type} {material if material != 'any' else ''}"
    
    # Search database
    candidates = db.search(query.strip(), k=5)
    
    if not candidates:
        return {
            "messages": [AIMessage(content="Sorry, I couldn't find any matching blocks. Let's try different criteria.")],
            "phase": "gathering",
            "collected_params": {}  # Reset to start over
        }
    
    # Format as table
    table_header = """
Based on your requirements, here are the matching blocks:

| # | Block Name | ID | Description |
|---|------------|-----|-------------|"""
    
    table_rows = []
    for i, c in enumerate(candidates, 1):
        name = c['name'][:35] + "..." if len(c['name']) > 35 else c['name']
        desc = c['metadata']['description'][:50] + "..." if len(c['metadata']['description']) > 50 else c['metadata']['description']
        table_rows.append(f"| {i} | {name} | {c['id']} | {desc} |")
    
    table = table_header + "\n" + "\n".join(table_rows)
    
    message = f"""{table}

📌 **To select a block, just type the number (1-{len(candidates)})** or type the block ID.

Or type **'back'** to change your criteria."""
    
    return {
        "block_candidates": candidates,
        "phase": "block_selection",
        "messages": [AIMessage(content=message)]
    }

def handle_block_selection(state: BlockState):
    """Handle user selection from the table"""
    user_input = state["messages"][-1].content.strip().lower()
    candidates = state.get("block_candidates", [])
    
    # Handle 'back' command
    if user_input == "back":
        return {
            "phase": "gathering",
            "collected_params": {},
            "block_candidates": None,
            "messages": [AIMessage(content="No problem! Let's start over.\n")]
        }
    
    selected_block = None
    
    # Try to parse as number
    if user_input.isdigit():
        idx = int(user_input) - 1
        if 0 <= idx < len(candidates):
            selected_block = candidates[idx]
    
    # Try to match by ID
    if not selected_block:
        for c in candidates:
            if user_input == c["id"].lower():
                selected_block = c
                break
    
    if not selected_block:
        return {
            "messages": [AIMessage(content=f"Please enter a number between 1 and {len(candidates)}, or type 'back' to change criteria.")]
        }
    
    # Load JS template
    js_template = ""
    try:
        js_path = os.path.join(SCRIPT_DIR, f"{selected_block['id']}.JS")
        with open(js_path, "r") as f:
            js_template = f.read()
    except:
        pass
    
    block = db.get_block(selected_block["id"])
    
    return {
        "selected_block_id": selected_block["id"],
        "selected_block": block,
        "js_template": js_template,
        "block_confirmed": True,
        "phase": "collecting",
        "collected_params": {},  # Reset for parameter collection
        "messages": [AIMessage(content=f"""
Excellent choice! 🎉

You selected: **{block['name']}**
{block['metadata']['description']}

Now let's configure the parameters. I'll ask you one at a time.
Just press **Enter** to use the default value, or type your custom value.
""")]
    }

def intent_node(state: BlockState):
    """Initial greeting - start the gathering process"""
    return {
        "phase": "gathering",
        "collected_params": {},
        "messages": [AIMessage(content="Welcome! Let me help you find the right structural block. I'll ask a few questions to understand your needs.\n")]
    }

def block_selection_node(state: BlockState):
    """Retrieve and select best block - conversational style"""
    query = f"{state['structure_type']} {state['intent_2d_3d']} {state['messages'][-1].content}"
    candidates = db.search(query, k=3)
    
    if not candidates:
        return {
            "messages": [AIMessage(content="I couldn't find any matching blocks for that description. Could you try describing the structure differently? For example, '3D steel hall' or '2D bridge truss'.")],
            "phase": "classify"
        }
    
    # Format candidates for display
    blocks_text = "\n\n".join([
        f"{i+1}. **{c['name']}** (ID: {c['id']})\n   {c['metadata']['description'][:150]}..."
        for i, c in enumerate(candidates)
    ])
    
    # Use LLM to select best match and explain conversationally
    selection_prompt = f"""
    Based on the user request: "{state['messages'][-1].content}"
    
    Available blocks:
    {blocks_text}
    
    Select the best matching block ID and explain why in a friendly, conversational way.
    Return JSON: {{"selected_id": "ID", "confidence": 0.9, "reason": "friendly explanation"}}
    """
    print("DEBUG: Selection Prompt:")
    print(selection_prompt)
    
    result = llm.with_structured_output(BlockSelectionResult).invoke(selection_prompt)
    print(result)
    selected_id = result.selected_id if result.selected_id else candidates[0]["id"]
    block = db.get_block(selected_id)
    
    # Load JS template if exists
    js_template = ""
    try:
        js_path = os.path.join(SCRIPT_DIR, f"{selected_id}.JS")
        with open(js_path, "r") as f:
            js_template = f.read()
    except:
        pass
    
    # Generate conversational recommendation
    block_description = block['metadata']['description']
    reason = result.reason if result.reason else "This seems like a good match for your needs."
    
    confirmation_msg = f"""Great! Based on your request, I found a perfect match:

🏗️ **{block['name']}**

{block_description}

{reason}

Would you like to proceed with this block? Just say **yes** to continue, or **no** if you'd like to see other options."""
    
    return {
        "selected_block_id": selected_id,
        "selected_block": block,
        "block_candidates": candidates,  # Store all candidates
        "js_template": js_template,
        "messages": [AIMessage(content=confirmation_msg)],
        "collected_params": {},
        "dynamic_array_states": {},
        "phase": "confirmation",  # Set phase for confirmation
        "block_confirmed": False
    }

def confirmation_node(state: BlockState):
    """Handle user confirmation of block selection"""
    user_input = state["messages"][-1].content.strip().lower()
    
    # Check for yes/confirmation
    if user_input in ["yes", "y", "yeah", "yep", "sure", "ok", "okay", "proceed", "continue"]:
        block = state.get("selected_block", {})
        block_name = block.get("name", "the block")
        
        return {
            "block_confirmed": True,
            "phase": "collecting",
            "messages": [AIMessage(content=f"Perfect! Let's configure **{block_name}** together. I'll ask you about each parameter, and you can just press Enter to use the default value.\n")]
        }
    
    # Check for no/rejection
    elif user_input in ["no", "n", "nope", "other", "different", "alternatives"]:
        candidates = state.get("block_candidates", [])
        current_id = state.get("selected_block_id")
        
        # Find alternatives (exclude current)
        alternatives = [c for c in candidates if c["id"] != current_id]
        
        if alternatives:
            alt_text = "\n\n".join([
                f"**{i+1}. {c['name']}** (ID: {c['id']})\n   {c['metadata']['description'][:150]}..."
                for i, c in enumerate(alternatives)
            ])
            
            return {
                "messages": [AIMessage(content=f"No problem! Here are some other options:\n\n{alt_text}\n\nWould you like me to use one of these? Just tell me which number, or describe a different structure.")],
                "phase": "confirmation"
            }
        else:
            return {
                "messages": [AIMessage(content="I don't have other similar options. Could you describe a different type of structure you need?")],
                "phase": "classify",
                "selected_block_id": None,
                "selected_block": None,
                "block_confirmed": False
            }
    
    # Check if user selected a number (for alternative selection)
    elif user_input.isdigit():
        idx = int(user_input) - 1
        candidates = state.get("block_candidates", [])
        current_id = state.get("selected_block_id")
        alternatives = [c for c in candidates if c["id"] != current_id]
        
        if 0 <= idx < len(alternatives):
            selected = alternatives[idx]
            block = db.get_block(selected["id"])
            
            # Load JS template
            js_template = ""
            try:
                js_path = os.path.join(SCRIPT_DIR, f"{selected['id']}.JS")
                with open(js_path, "r") as f:
                    js_template = f.read()
            except:
                pass
            
            return {
                "selected_block_id": selected["id"],
                "selected_block": block,
                "js_template": js_template,
                "block_confirmed": True,
                "phase": "collecting",
                "messages": [AIMessage(content=f"Great choice! Let's configure **{block['name']}** together. I'll ask you about each parameter.\n")]
            }
    
    # Otherwise, treat as a new request
    return {
        "messages": [AIMessage(content="I didn't quite understand that. Please say **yes** to proceed with the current block, **no** to see alternatives, or describe a different structure you need.")],
        "phase": "confirmation"
    }

def parameter_collection_node(state: BlockState):
    """Determine next parameter to ask or if complete"""
    block_id = state["selected_block_id"]
    if not block_id:
        return {"current_question": None}
    
    orchestrator = ParameterOrchestrator(block_id)
    collected = state.get("collected_params", {})
    
    # Get list of active parameters we still need
    active_params = orchestrator.get_active_params(collected)
    
    if not active_params:
        # All parameters collected
        return {"current_question": {"type": "COMPLETE"}}
    
    # Get next parameter
    next_key, next_schema = active_params[0]
    
    # Handle special types
    if next_schema.get("type") == "selection_mode_choice":
        options = next_schema["config"]["options"]
        options_text = "\n".join([f"- {k}: {v['label']}" for k, v in options.items()])
        question = {
            "type": "SELECTION_MODE",
            "key": next_schema["config"]["parameter_name"],
            "text": f"How would you like to define the geometry?\n{options_text}",
            "options": list(options.keys())
        }
    else:
        # Regular parameter
        label = next_schema.get("label", next_key)
        unit = next_schema.get("unit", "")
        default = next_schema.get("default", "")
        desc = next_schema.get("description", "")
        
        unit_display = f" [{unit.replace('UNIT.', '')}]" if unit else ""
        default_display = f" (default: {default})" if default != "" else ""
        
        text = f"Please enter **{label}**{unit_display}{default_display}:"
        if desc:
            text += f"\n*{desc}*"
        
        question = {
            "type": "PARAM",
            "key": next_key,
            "text": text,
            "schema": next_schema
        }
    
    return {"current_question": question}

def validation_node(state: BlockState):
    """Validate user input and update state"""
    question = state.get("current_question")
    if not question or question.get("type") == "COMPLETE":
        return {}
    
    user_input = state["messages"][-1].content.strip()
    orchestrator = ParameterOrchestrator(state["selected_block_id"])
    collected = state.get("collected_params", {})
    
    # Handle Yes/No confirmation for selection mode
    if question["type"] == "SELECTION_MODE":
        if user_input.lower() in question["options"]:
            new_collected = {**collected, question["key"]: user_input.lower()}
            return {
                "collected_params": new_collected,
                "messages": [AIMessage(content=f"✓ Mode set to: {user_input}")]
            }
        else:
            return {
                "messages": [AIMessage(content=f"Please select one of: {', '.join(question['options'])}")]
            }
    
    # Handle regular parameter validation
    key = question["key"]
    schema = question["schema"]
    
    # Handle default value (empty input)
    if user_input == "" and "default" in schema:
        user_input = str(schema["default"])
    
    # Validate
    is_valid, result = orchestrator.validate_value(key, user_input, collected)
    
    if not is_valid:
        # Validation failed
        return {
            "messages": [AIMessage(content=f"❌ Invalid input: {result}\n\n{question['text']}")]
        }
    
    # Success
    new_collected = {**collected, key: result}
    
    # Check if this is a dynamic array driver (like 'n') that requires reset
    for skey, sval in orchestrator.schema.items():
        if sval.get("type") == "__dynamic_array_meta":
            if sval["config"]["driver_variable"] == key:
                # Remove old dynamic array values if driver changed
                template = sval["config"]["template_name"]
                pattern = template.replace("{i}", r"\d+")
                new_collected = {k: v for k, v in new_collected.items() 
                               if not re.match(pattern, k)}
                # Update the count
                dyn_states = state.get("dynamic_array_states", {})
                dyn_states[key] = int(result)
                return {
                    "collected_params": new_collected,
                    "dynamic_array_states": dyn_states,
                    "messages": [AIMessage(content=f"✓ {key} = {result} (will generate {result} array items)")]
                }
    
    return {
        "collected_params": new_collected,
        "messages": [AIMessage(content=f"✓ {schema.get('label', key)} set to {result}")]
    }

def generation_node(state: BlockState):
    """Generate final JS code with AST-based injection"""
    template = state.get("js_template", "")
    params = state.get("collected_params", {})
    block_id = state["selected_block_id"]
    
    if not template:
        return {
            "generated_js": f"// Error: No template found for {block_id}",
            "messages": [AIMessage(content="Error: JavaScript template not found.")]
        }
    
    try:
        # Use AST manipulator for safe injection
        manipulator = JSManipulator(template)
        generated = manipulator.inject_parameters(params)
        
        # Verify syntax
        if not manipulator.verify_syntax(generated):
            raise Exception("Generated code has syntax errors")
        
        # Save to file
        output_path = f"{block_id}_generated.JS"
        with open(output_path, "w") as f:
            f.write(generated)
        
        # Summary
        param_summary = "\n".join([f"  {k} = {v}" for k, v in sorted(params.items()) 
                                  if not k.startswith("__")])
        
        return {
            "generated_js": generated,
            "messages": [AIMessage(
                content=f"✅ **Code Generated Successfully!**\n\n"
                        f"**Block:** {state['selected_block']['name']}\n"
                        f"**File:** `{output_path}`\n\n"
                        f"**Parameters Injected:**\n{param_summary}\n\n"
                        f"The JavaScript file is ready with your custom parameters."
            )]
        }
    except Exception as e:
        return {
            "messages": [AIMessage(content=f"❌ Error generating code: {str(e)}")]
        }

def router(state: BlockState):
    """Determine next step in graph"""
    # If no block selected yet, need classification
    if not state.get("selected_block_id"):
        return "classify"
    
    # If we have a current question that's not COMPLETE, validate input
    current_q = state.get("current_question")
    if current_q and current_q.get("type") != "COMPLETE":
        return "validate"
    
    # If current question is COMPLETE, generate code
    if current_q and current_q.get("type") == "COMPLETE":
        return "generate"
    
    # Otherwise collect parameters
    return "collect"

# ============================================================================
# 6. SIMPLE CONVERSATION LOOP (No complex graphs needed)
# ============================================================================

def run_conversation():
    """Interactive conversation handler - guided questionnaire approach"""
    
    print("\n" + "="*60)
    print("🏗️  RFEM Structural Block Generator")
    print("="*60)
    print("\nHello! I'm your structural engineering assistant.")
    print("I'll help you find the right block and generate JavaScript code.")
    print("\nType 'exit' anytime to quit, 'restart' to start over.\n")
    print("-"*60)
    
    # State
    state = {
        "phase": "welcome",  # welcome, dim_select, type_select, material_select, block_selection, collecting, generating
        "requirements": {},  # dimensionality, structure_type, material
        "block_candidates": [],
        "selected_block": None,
        "selected_block_id": None,
        "js_template": "",
        "collected_params": {},
        "param_keys": [],    # List of parameters to collect
        "current_param_idx": 0
    }
    
    # Show first question - dimensionality
    print("\n🤖 Assistant: Let's start! What **dimensionality** do you need?")
    print("\n  1️⃣  **2D** - Plane frame, single plane analysis")
    print("  2️⃣  **3D** - Full spatial structure")
    print("\nJust type **2D** or **3D**:")
    state["phase"] = "dim_select"
    
    while True:
        user_input = input("\n👤 You: ").strip()
        
        # Handle exit
        if user_input.lower() in ["exit", "quit"]:
            print("\n👋 Goodbye! Happy engineering!")
            break
        
        # Handle restart
        if user_input.lower() == "restart":
            state = {
                "phase": "dim_select",
                "requirements": {},
                "block_candidates": [],
                "selected_block": None,
                "selected_block_id": None,
                "js_template": "",
                "collected_params": {},
                "param_keys": [],
                "current_param_idx": 0
            }
            print("\n🤖 Assistant: Let's start fresh!")
            print("\n🤖 Assistant: What **dimensionality** do you need?")
            print("\n  1️⃣  **2D** - Plane frame, single plane analysis")
            print("  2️⃣  **3D** - Full spatial structure")
            print("\nJust type **2D** or **3D**:")
            continue
        
        if not user_input:
            continue
        
        # ========================================
        # PHASE: DIMENSIONALITY SELECTION
        # ========================================
        if state["phase"] == "dim_select":
            user_lower = user_input.lower().strip()
            
            if user_lower in ["2d", "1", "2"]:
                dim = "2D" if user_lower in ["2d", "1"] else "3D"
            elif user_lower in ["3d"]:
                dim = "3D"
            else:
                print("\n🤖 Assistant: Please type **2D** or **3D**.")
                continue
            
            state["requirements"]["dimensionality"] = dim
            print(f"\n🤖 Assistant: ✅ Dimensionality: **{dim}**")
            
            # Get available structure types from database
            available_types = db.get_structure_types(dim)
            
            if not available_types:
                print(f"\n🤖 Assistant: No structures found for {dim}. Please try the other dimension.")
                continue
            
            # Store for validation
            state["available_types"] = available_types
            
            print("\n🤖 Assistant: Great! What **type of structure** do you want to create?")
            print("\nAvailable types in the database:")
            for t in available_types:
                emoji = {"truss": "🔺", "frame": "🏗️", "hall": "🏭", "beam": "📏", "suspension": "🌉"}.get(t, "📦")
                print(f"  {emoji} **{t}**")
            print("\nType your choice:")
            state["phase"] = "type_select"
        
        # ========================================
        # PHASE: STRUCTURE TYPE SELECTION
        # ========================================
        elif state["phase"] == "type_select":
            user_lower = user_input.lower().strip()
            available_types = state.get("available_types", [])
            
            # Check if input matches an available type
            matched_type = None
            for t in available_types:
                if user_lower == t or user_lower in t or t in user_lower:
                    matched_type = t
                    break
            
            if not matched_type:
                print(f"\n🤖 Assistant: Please choose from: {', '.join(available_types)}")
                continue
            
            state["requirements"]["structure_type"] = matched_type
            print(f"\n🤖 Assistant: ✅ Structure Type: **{matched_type}**")
            
            # Get available materials from database for this type
            dim = state["requirements"]["dimensionality"]
            available_materials = db.get_materials(dim, matched_type)
            
            if not available_materials:
                print(f"\n🤖 Assistant: No materials found for {matched_type}. Using any material.")
                available_materials = ["steel", "any"]
            
            state["available_materials"] = available_materials
            
            print("\n🤖 Assistant: What **material** should the structure use?")
            print("\nAvailable materials in the database:")
            for m in available_materials:
                emoji = {"steel": "🔩", "wood": "🪵", "timber": "🪵", "concrete": "🧱"}.get(m, "❓")
                print(f"  {emoji} **{m}**")
            print("  ❓ **any** - No preference")
            print("\nType your choice:")
            state["phase"] = "material_select"
        
        # ========================================
        # PHASE: MATERIAL SELECTION
        # ========================================
        elif state["phase"] == "material_select":
            user_lower = user_input.lower().strip()
            available_materials = state.get("available_materials", [])
            
            # Allow "any" or match from available
            if user_lower in ["any", "no preference", ""]:
                matched_material = "any"
            else:
                matched_material = None
                for m in available_materials:
                    if user_lower == m or user_lower in m or m in user_lower:
                        matched_material = m
                        break
                
                if not matched_material:
                    print(f"\n🤖 Assistant: Please choose from: {', '.join(available_materials)} or 'any'")
                    continue
            
            state["requirements"]["material"] = matched_material
            print(f"\n🤖 Assistant: ✅ Material: **{matched_material}**")
            
            # RIGID SEARCH - Filter blocks by exact criteria
            print("\n🤖 Assistant: 🔍 Searching for matching blocks...")
            
            req = state["requirements"]
            candidates = db.filter_blocks(
                dim=req.get("dimensionality"),
                structure_type=req.get("structure_type"),
                material=req.get("material") if req.get("material") != "any" else None
            )
            
            if not candidates:
                print("\n🤖 Assistant: No blocks found matching all criteria.")
                print("   Expanding search to include all materials...")
                candidates = db.filter_blocks(
                    dim=req.get("dimensionality"),
                    structure_type=req.get("structure_type"),
                    material=None
                )
            
            if not candidates:
                print("\n🤖 Assistant: Still no blocks found. Let's try different criteria.")
                state["phase"] = "dim_select"
                state["requirements"] = {}
                print("\n🤖 Assistant: What **dimensionality** do you need? (2D or 3D)")
                continue
            
            state["block_candidates"] = candidates
            
            # Display table
            print("\n" + "="*70)
            print("📋 MATCHING BLOCKS")
            print("="*70)
            print(f"{'#':<3} {'Block Name':<40} {'ID':<10}")
            print("-"*70)
            for i, c in enumerate(candidates, 1):
                name = c['name'][:38] if len(c['name']) <= 38 else c['name'][:35] + "..."
                print(f"{i:<3} {name:<40} {c['id']:<10}")
            print("-"*70)
            
            # Show descriptions
            print("\n📝 Descriptions:")
            for i, c in enumerate(candidates, 1):
                desc = c['metadata']['description'][:80]
                print(f"  {i}. {desc}...")
            
            print("\n🤖 Assistant: Which block would you like to use?")
            print("   Enter a number (1-{}) or type 'back' to change criteria.".format(len(candidates)))
            state["phase"] = "block_selection"
        
        # ========================================
        # PHASE: BLOCK SELECTION
        # ========================================
        elif state["phase"] == "block_selection":
            if user_input.lower() == "back":
                state["phase"] = "dim_select"
                state["requirements"] = {}
                print("\n🤖 Assistant: Let's start fresh!")
                print("\n🤖 Assistant: What **dimensionality** do you need? (2D or 3D)")
                continue
            
            # Try to parse selection
            selected = None
            if user_input.isdigit():
                idx = int(user_input) - 1
                if 0 <= idx < len(state["block_candidates"]):
                    selected = state["block_candidates"][idx]
            
            if not selected:
                # Try matching by ID
                for c in state["block_candidates"]:
                    if user_input.lower() == c["id"].lower():
                        selected = c
                        break
            
            if not selected:
                print(f"\n🤖 Assistant: Please enter a number between 1 and {len(state['block_candidates'])}.")
                continue
            
            # Load the block
            block = db.get_block(selected["id"])
            state["selected_block"] = block
            state["selected_block_id"] = selected["id"]
            
            # Load JS template from correct subdirectory (2D or 3D)
            try:
                # Determine subdirectory based on block's dimensionality
                dimensionality = block.get("dimensionality", "2D")  # Default to 2D if not specified
                subdir = "2D" if "2D" in str(dimensionality).upper() else "3D"
                
                js_path = os.path.join(SCRIPT_DIR, subdir, f"{selected['id']}.JS")
                print(f"\n📂 Loading template from: {subdir}/{selected['id']}.JS")
                
                with open(js_path, "r") as f:
                    state["js_template"] = f.read()
                print(f"✅ Template loaded successfully!")
            except FileNotFoundError:
                print(f"\n⚠️ JS template not found: {js_path}")
                state["js_template"] = ""
            except Exception as e:
                print(f"\n⚠️ Error loading template: {str(e)}")
                state["js_template"] = ""
            
            print(f"\n🤖 Assistant: Excellent choice! 🎉")
            print(f"   Selected: **{block['name']}**")
            print(f"   {block['metadata']['description']}")
            
            # Get parameters to collect
            orchestrator = ParameterOrchestrator(selected["id"])
            params = orchestrator.get_active_params({})
            
            if not params:
                print("\n🤖 Assistant: This block has no configurable parameters.")
                state["phase"] = "generating"
            else:
                # Filter out internal parameters (starting with __)
                user_params = [(k, s) for k, s in params if not k.startswith("__")]
                
                if not user_params:
                    print("\n🤖 Assistant: This block uses default parameters.")
                    state["phase"] = "generating"
                else:
                    state["param_keys"] = user_params
                    state["current_param_idx"] = 0
                    state["collected_params"] = {}
                    state["phase"] = "collecting"
                    
                    print("\n🤖 Assistant: Let's configure the parameters.")
                    print(f"   This block has {len(user_params)} configurable parameters.")
                    print("   Press Enter to use default values, or type your own.\n")
                    print("-"*60)
                    
                    # Ask first parameter
                    key, schema = user_params[0]
                    label = schema.get("label", key)
                    default = schema.get("default", "")
                    unit = schema.get("unit", "").replace("UNIT.", "")
                    
                    prompt = f"📝 {label}"
                    if unit:
                        prompt += f" [{unit}]"
                    if default != "":
                        prompt += f" (default: {default})"
                    prompt += ":"
                    
                    print(f"\n🤖 Assistant: {prompt}")
        
        # ========================================
        # PHASE: COLLECTING PARAMETERS
        # ========================================
        elif state["phase"] == "collecting":
            params = state["param_keys"]
            idx = state["current_param_idx"]
            
            if idx >= len(params):
                state["phase"] = "generating"
                continue
            
            key, schema = params[idx]
            orchestrator = ParameterOrchestrator(state["selected_block_id"])
            
            # Use default if empty
            if user_input == "" and "default" in schema:
                user_input = str(schema["default"])
            
            # Validate
            is_valid, result = orchestrator.validate_value(key, user_input, state["collected_params"])
            
            if not is_valid:
                print(f"\n🤖 Assistant: ❌ {result}")
                print(f"   Please try again:")
                continue
            
            # Save value
            state["collected_params"][key] = result
            label = schema.get("label", key)
            print(f"\n🤖 Assistant: ✅ {label} = {result}")
            
            # Move to next parameter
            state["current_param_idx"] += 1
            
            if state["current_param_idx"] >= len(params):
                state["phase"] = "generating"
                print("\n🤖 Assistant: All parameters collected! Generating code...")
            else:
                # Ask next parameter
                next_key, next_schema = params[state["current_param_idx"]]
                label = next_schema.get("label", next_key)
                default = next_schema.get("default", "")
                unit = next_schema.get("unit", "").replace("UNIT.", "")
                
                prompt = f"📝 {label}"
                if unit:
                    prompt += f" [{unit}]"
                if default != "":
                    prompt += f" (default: {default})"
                prompt += ":"
                
                print(f"\n🤖 Assistant: {prompt}")
        
        # ========================================
        # PHASE: GENERATING CODE
        # ========================================
        if state["phase"] == "generating":
            template = state.get("js_template", "")
            params = state.get("collected_params", {})
            block_id = state["selected_block_id"]
            block = state["selected_block"]
            
            if not template:
                print(f"\n🤖 Assistant: ⚠️ No JavaScript template found for {block_id}")
                print("   Cannot generate code without a template.")
            else:
                try:
                    manipulator = JSManipulator(template)
                    generated = manipulator.inject_parameters(params)
                    
                    # Determine output subdirectory based on dimensionality
                    dimensionality = block.get("dimensionality", "2D")
                    subdir = "2D" if "2D" in str(dimensionality).upper() else "3D"
                    
                    # Save to file in the correct subdirectory
                    output_path = os.path.join(SCRIPT_DIR, subdir, f"{block_id}_generated.JS")
                    with open(output_path, "w") as f:
                        f.write(generated)
                    
                    print("\n" + "="*60)
                    print("✅ CODE GENERATED SUCCESSFULLY!")
                    print("="*60)
                    print(f"\n📁 Output File: {subdir}/{block_id}_generated.JS")
                    print(f"📍 Full Path: {output_path}")
                    print(f"🏗️ Block: {block['name']}")
                    print(f"📐 Dimensionality: {dimensionality}")
                    print("\n📊 Parameters injected:")
                    for k, v in params.items():
                        if not k.startswith("__"):
                            print(f"   • {k} = {v}")
                    print("-"*60)
                except Exception as e:
                    print(f"\n🤖 Assistant: ❌ Error generating code: {str(e)}")
            
            # Reset for next request
            print("\n🤖 Assistant: Would you like to create another structure? Type 'yes' or 'restart'.")
            state = {
                "phase": "done",
                "requirements": {},
                "current_step": 0,
                "block_candidates": [],
                "selected_block": None,
                "selected_block_id": None,
                "js_template": "",
                "collected_params": {},
                "param_keys": [],
                "current_param_idx": 0
            }
        
        # ========================================
        # PHASE: DONE - waiting for restart
        # ========================================
        elif state["phase"] == "done":
            if user_input.lower() in ["yes", "y", "restart", "again"]:
                state["phase"] = "gathering"
                print(f"\n🤖 Assistant: Great! Let's start a new project.\n\n{GATHERING_STEPS[0]['question']}")
            else:
                print("\n🤖 Assistant: Type 'restart' to create another structure, or 'exit' to quit.")

if __name__ == "__main__":
    run_conversation()
