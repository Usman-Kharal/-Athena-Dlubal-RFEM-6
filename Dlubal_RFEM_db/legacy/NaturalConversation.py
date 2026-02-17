"""
RFEM Structural Block Generator - Natural Language Conversation System
This version uses AI to understand natural language instead of rigid menus.
"""

import json
import os
import re
from typing import TypedDict, Annotated, Optional, Dict, Any, List, Union, Callable
from enum import Enum
from dataclasses import dataclass
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field
import esprima
from dotenv import load_dotenv
load_dotenv()

# Get the directory where this script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# ============================================================================
# DATABASE CLASS
# ============================================================================

class BlockDatabase:
    def __init__(self, db_2d_path: str, db_3d_path: str):
        db_2d_full = os.path.join(SCRIPT_DIR, db_2d_path)
        db_3d_full = os.path.join(SCRIPT_DIR, db_3d_path)
        
        # Ensure directories exist
        os.makedirs(os.path.dirname(db_2d_full), exist_ok=True)
        os.makedirs(os.path.dirname(db_3d_full), exist_ok=True)
        
        try:
            with open(db_2d_full) as f:
                self.db_2d = json.load(f).get("elements", [])
        except (FileNotFoundError, json.JSONDecodeError):
            self.db_2d = []
            
        try:
            with open(db_3d_full) as f:
                self.db_3d = json.load(f).get("elements", [])
        except (FileNotFoundError, json.JSONDecodeError):
            self.db_3d = []
        
        self.all_blocks = {b["id"]: b for b in self.db_2d + self.db_3d}
    
    def filter_by_dimensionality(self, dim: str) -> List[Dict]:
        dim_upper = dim.upper()
        if dim_upper == "2D":
            return self.db_2d
        elif dim_upper == "3D":
            return self.db_3d
        return list(self.all_blocks.values())
    
    def get_structure_types(self, dim: str) -> List[str]:
        blocks = self.filter_by_dimensionality(dim)
        types = set()
        for block in blocks:
            main_member = block.get("main_member", "")
            if main_member:
                types.add(main_member.lower())
        return sorted(list(types))
    
    def get_materials(self, dim: str, structure_type: str = None) -> List[str]:
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
        if dim:
            blocks = self.filter_by_dimensionality(dim)
        else:
            blocks = list(self.all_blocks.values())
        
        if structure_type:
            blocks = [b for b in blocks if b.get("main_member", "").lower() == structure_type.lower()]
        
        if material and material.lower() != "any":
            blocks = [b for b in blocks if b.get("material", "").lower() == material.lower()]
        
        return blocks
    
    def get_block(self, block_id: str) -> Dict:
        return self.all_blocks.get(block_id)
    
    def get_param_schema(self, block_id: str) -> Dict[str, Dict]:
        block = self.get_block(block_id)
        if not block:
            return {}
        
        inputs = block.get("inputs", {})
        flat_params = {}
        
        def extract_params(obj, parent_key=""):
            if isinstance(obj, dict):
                if "type" in obj or "default" in obj:
                    if parent_key:
                        flat_params[parent_key] = obj
                else:
                    for key, value in obj.items():
                        if key in ["dynamic_arrays", "selection_modes"]:
                            continue
                        if isinstance(value, dict):
                            if "type" in value or "default" in value:
                                flat_params[key] = value
                            else:
                                extract_params(value, key)
        
        extract_params(inputs)
        return flat_params

# Initialize database
db = BlockDatabase("2D/2D_DB.json", "3D/3D_DB.json")

# ============================================================================
# JS MANIPULATOR
# ============================================================================

class JSManipulator:
    def __init__(self, js_code: str):
        self.original_code = js_code
        self.ast = esprima.parseScript(js_code, {"range": True, "tokens": True})
    
    def find_parameter_calls(self):
        calls = []
        
        def traverse(node):
            if hasattr(node, 'type') and node.type == 'CallExpression':
                if hasattr(node, 'callee') and hasattr(node.callee, 'name'):
                    if node.callee.name in ['parameter_float', 'parameter_int', 'parameter_check']:
                        args = node.arguments
                        if len(args) >= 2:
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
        calls = self.find_parameter_calls()
        replacements = []
        
        for call in calls:
            param_name = call['name']
            if param_name not in params:
                continue
            
            user_val = params[param_name]
            args = call['args']
            
            if len(args) >= 4:
                default_arg = args[3]
                start, end = default_arg.range
                
                if isinstance(user_val, bool):
                    js_val = "true" if user_val else "false"
                elif isinstance(user_val, (int, float)):
                    js_val = str(user_val)
                elif isinstance(user_val, str):
                    js_val = f"'{user_val}'"
                else:
                    continue
                
                replacements.append((start, end, js_val))
        
        replacements.sort(reverse=True)
        result = self.original_code
        for start, end, new_val in replacements:
            result = result[:start] + new_val + result[end:]
        
        return result

# ============================================================================
# PARAMETER ORCHESTRATOR
# ============================================================================

class ParameterOrchestrator:
    def __init__(self, block_id: str):
        self.block_id = block_id
        self.block = db.get_block(block_id)
        self.schema = db.get_param_schema(block_id)
    
    def get_active_params(self, collected: Dict) -> List[tuple]:
        active = []
        for key, schema in self.schema.items():
            if key.startswith("__"):
                continue
            if key in collected:
                continue
            if "type" in schema or "default" in schema:
                active.append((key, schema))
        return active
    
    def validate_value(self, key: str, value: Any, collected: Dict) -> tuple:
        schema = self.schema.get(key, {})
        target_type = schema.get("type", "float")
        
        try:
            if target_type == "int":
                value = int(float(value))
            elif target_type == "float":
                value = float(value)
            elif target_type == "boolean":
                value = str(value).lower() in ["true", "yes", "1", "y"]
        except ValueError:
            return False, f"Invalid value for {key}"
        
        return True, value

# ============================================================================
# LLM SETUP
# ============================================================================

llm = ChatOpenAI(model="gpt-4o", temperature=0)

# Pydantic models for structured outputs
class IntentExtraction(BaseModel):
    dimensionality: Optional[str] = Field(None, description="2D or 3D, if mentioned")
    structure_type: Optional[str] = Field(None, description="Type like truss, frame, beam, hall")
    material: Optional[str] = Field(None, description="Material like steel, timber, concrete")
    is_complete: bool = Field(False, description="True if we have dimensionality AND structure_type")
    response: str = Field("", description="Natural conversational response to user")

class MaterialSelection(BaseModel):
    """Determine what user wants during material selection"""
    selected_material: Optional[str] = Field(None, description="The material user selected (steel, timber, concrete, etc.)")
    wants_any: bool = Field(False, description="True if user wants to see all materials")

class BlockSelectionIntent(BaseModel):
    """Determine what the user wants during block selection"""
    intent: str = Field(description="'select' if choosing a block, 'describe' if asking for more info/explanation, 'back' if wants to go back")
    selected_index: Optional[int] = Field(None, description="1-based index if intent is 'select'")
    question_about: Optional[str] = Field(None, description="What they want to know more about if intent is 'describe'")

class BlockExplanation(BaseModel):
    """LLM-generated explanation of blocks"""
    explanation: str = Field(description="Friendly, detailed explanation of the blocks")

class ParameterIntent(BaseModel):
    """Determine what user wants during parameter input"""
    intent: str = Field(description="'value' if providing a number, 'help' if asking what this parameter means, 'default' if wants default")
    numeric_value: Optional[float] = Field(None, description="The numeric value if intent is 'value'")
    question: Optional[str] = Field(None, description="What they want explained if intent is 'help'")

class ParameterExplanation(BaseModel):
    """LLM-generated explanation of a parameter"""
    explanation: str = Field(description="Clear explanation of what this parameter means in structural engineering context")

class CleanupIntent(BaseModel):
    """Determine if user wants to exit"""
    is_exit: bool = Field(description="True if the user wants to exit/quit/stop the application")


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_file_explorer_url(file_path: str) -> str:
    """Generate a clickable file:// URL for Windows Explorer"""
    # Convert to forward slashes for URL format
    url_path = file_path.replace('\\', '/')
    return f"file:///{url_path}"

def is_asking_for_help(user_input: str) -> bool:
    """Check if user is asking for explanation rather than providing input"""
    help_patterns = [
        r'\bwhat\b.*\bis\b', r'\bwhat\b.*\bare\b', r'\bwhat\b.*\bmean', r'\bwhat\b.*\bdoes\b',
        r'\bdescribe\b', r'\bexplain\b', r'\btell\b.*\babout\b', r'\bhelp\b',
        r'\bmore\b.*\binfo', r'\bdetails?\b', r'\?$'
    ]
    lower_input = user_input.lower()
    for pattern in help_patterns:
        if re.search(pattern, lower_input):
            return True
    return False

def format_unit(unit_str: str) -> str:
    """Convert RFEM unit codes to human-readable format"""
    unit_map = {
        "LENGTH": "m (meters)",
        "NONE": "",
        "AREA": "m² (square meters)",
        "VOLUME": "m³ (cubic meters)",
        "ANGLE": "° (degrees)",
        "FORCE": "N (Newtons)",
        "LOADS_FORCE": "N (Newtons)",
        "MOMENT": "N·m (Newton-meters)",
        "STRESS": "Pa (Pascals)",
        "DENSITY": "kg/m³",
        "TEMPERATURE": "°C (Celsius)",
        "COUNT": ""
    }
    unit_clean = unit_str.replace("UNIT.", "").upper()
    return unit_map.get(unit_clean, unit_str.replace("UNIT.", ""))

def check_exit_intent(user_input: str) -> bool:
    """Check if the user wants to exit using LLM"""
    if user_input.lower() in ["exit", "quit", "bye", "goodbye", "stop", "done"]:
        return True
        
    prompt = f"""User said: "{user_input}"
Does this mean they want to exit, quit, or stop the conversation?
Answer yes or no."""
    
    try:
        cleanup = llm.with_structured_output(CleanupIntent).invoke(prompt)
        return cleanup.is_exit
    except:
        return False

def check_restart_intent(user_input: str) -> bool:
    """Check if the user wants to restart/reset using LLM"""
    if user_input.lower() in ["restart", "reset", "start over", "new", "clear"]:
        return True
        
    prompt = f"""User said: "{user_input}"
Does this mean they want to RESTART the process, clear current progress, or choose a NEW structure from scratch?
Answer yes or no."""
    
    try:
        cleanup = llm.with_structured_output(CleanupIntent).invoke(prompt) # Reusing CleanupIntent structure for boolean
        return cleanup.is_exit
    except:
        return False

# ============================================================================
# NATURAL LANGUAGE CONVERSATION
# ============================================================================

def run_conversation():
    """Natural language conversation handler"""
    
    print("\n" + "="*60)
    print("�️  RFEM Block Selector & Generator")
    print("="*60)
    
    state = {
        "phase": "understanding",
        "requirements": {},
        "available_materials": [],
        "block_candidates": [],
        "selected_block": None,
        "selected_block_id": None,
        "js_template": "",
        "collected_params": {},
        "param_keys": [],
        "current_param_idx": 0
    }
    
    # Use LLM for initial greeting
    greeting_prompt = """You are Athena, an AI assistant for RFEM block selection and code generation.
Generate a short, friendly greeting (1-2 sentences) asking what type of structural block the user wants to create.
Keep it simple and professional."""
    try:
        greeting = llm.invoke(greeting_prompt).content
        print(f"\n🏛️ Athena: {greeting}")
    except:
        print("\n🏛️ Athena: Hello! What type of structural block would you like to create?")
    
    while True:
        user_input = input("\n👤 You: ").strip()
        
        if not user_input:
            # Empty input - use default if in collecting phase
            if state["phase"] == "collecting":
                user_input = ""  # Will trigger default
            else:
                continue
            
        if check_exit_intent(user_input):
            try:
                goodbye = llm.invoke("User wants to exit. Generate a short, friendly goodbye message (1 sentence).").content
                print(f"\n🏛️ Athena: {goodbye}")
            except:
                print("\n👋 Goodbye! Happy engineering!")
            break
        
        if check_restart_intent(user_input):
            state = {
                "phase": "understanding",
                "requirements": {},
                "available_materials": [],
                "block_candidates": [],
                "selected_block": None,
                "selected_block_id": None,
                "js_template": "",
                "collected_params": {},
                "param_keys": [],
                "current_param_idx": 0
            }
            try:
                restart_msg = llm.invoke("User wants to restart. Generate a short, friendly message confirming we are starting over (1 sentence).").content
                print(f"\n🏛️ Athena: {restart_msg}")
            except:
                print("\n🏛️ Athena: Let's start fresh! What kind of structure would you like to create?")
            continue
        
        # ========================================
        # PHASE: UNDERSTANDING USER INTENT
        # ========================================
        if state["phase"] == "understanding":
            all_types_2d = db.get_structure_types("2D")
            all_types_3d = db.get_structure_types("3D")
            
            extraction_prompt = f"""Extract structural requirements from the user's message.

Available:
- Dimensionality: 2D, 3D
- 2D Types: {', '.join(all_types_2d)}
- 3D Types: {', '.join(all_types_3d)}

Current requirements: {json.dumps(state['requirements'])}

User said: "{user_input}"

If dimensionality and structure_type are both known, set is_complete=True.
Provide a natural, friendly response."""

            try:
                result = llm.with_structured_output(IntentExtraction).invoke(extraction_prompt)
                
                # Update requirements
                if result.dimensionality:
                    state["requirements"]["dimensionality"] = result.dimensionality.upper()
                if result.structure_type:
                    state["requirements"]["structure_type"] = result.structure_type.lower()
                if result.material:
                    state["requirements"]["material"] = result.material.lower()
                
                req = state["requirements"]
                
                if req.get("dimensionality") and req.get("structure_type"):
                    # Check if material is needed but not specified
                    if not req.get("material"):
                        # Get available materials for this combination
                        available_materials = db.get_materials(
                            req.get("dimensionality"),
                            req.get("structure_type")
                        )
                        
                        if len(available_materials) > 1:
                            # Multiple materials available - ask user to choose
                            print(f"\n🏛️ Athena: {result.response}")
                            print(f"\n🔧 **Material Selection**")
                            print(f"   Available materials for {req.get('dimensionality')} {req.get('structure_type')}:")
                            print()
                            for i, mat in enumerate(available_materials, 1):
                                print(f"   {i}. {mat.capitalize()}")
                            print(f"   {len(available_materials) + 1}. Any (show all)")
                            print()
                            print("🏛️ Athena: Which material would you prefer? (enter number or name)")
                            state["available_materials"] = available_materials
                            state["phase"] = "material_select"
                            continue
                        elif len(available_materials) == 1:
                            # Only one material available - use it automatically
                            req["material"] = available_materials[0]
                            print(f"\n🏛️ Athena: {result.response}")
                        else:
                            print(f"\n🏛️ Athena: {result.response}")
                    else:
                        print(f"\n🏛️ Athena: {result.response}")
                    
                    # Now search for blocks with material filter
                    candidates = db.filter_blocks(
                        dim=req.get("dimensionality"),
                        structure_type=req.get("structure_type"),
                        material=req.get("material") if req.get("material") and req.get("material") != "any" else None
                    )
                    
                    if not candidates:
                        # Fallback without material filter
                        candidates = db.filter_blocks(
                            dim=req.get("dimensionality"),
                            structure_type=req.get("structure_type")
                        )
                    
                    if not candidates:
                        # Use LLM for natural response
                        no_match_prompt = f"""You are Athena. No blocks found for {req.get('dimensionality')} {req.get('structure_type')}.
Available types: {db.get_structure_types(req.get('dimensionality', '2D'))}
Generate a short, helpful response (1 sentence)."""
                        try:
                            response = llm.invoke(no_match_prompt).content
                            print(f"\n🏛️ Athena: {response}")
                        except:
                            print(f"\n🏛️ Athena: No matching blocks found. Try: {', '.join(db.get_structure_types(req.get('dimensionality', '2D')))}")
                        state["requirements"] = {}
                        continue
                    
                    state["block_candidates"] = candidates
                    
                    # Generate LLM response about found blocks with short geometrical descriptions
                    block_info = []
                    for c in candidates:
                        block_info.append(f"- {c['name']}: {c['metadata']['description'][:100]}")
                    
                    blocks_prompt = f"""You are Athena. Found {len(candidates)} block(s) for {req.get('dimensionality')} {req.get('structure_type')}:

{chr(10).join(block_info)}

Generate a brief response (1-2 sentences) introducing these options. For each block, provide a very short (10 words max) geometrical description."""
                    
                    try:
                        llm_response = llm.invoke(blocks_prompt).content
                        print(f"\n🏛️ Athena: {llm_response}\n")
                    except:
                        print(f"\n🏛️ Athena: Found {len(candidates)} matching block(s):\n")
                    
                    for i, c in enumerate(candidates, 1):
                        block_material = c.get('material', '')
                        material_str = f" [{block_material}]" if block_material and block_material != 'N/A' else ""
                        print(f"  {i}. {c['name']} (ID: {c['id']}){material_str}")
                    print()
                    
                    if len(candidates) == 1:
                        print("🏛️ Athena: Select this block? (yes/no)")
                    
                    state["phase"] = "selecting"
                else:
                    print(f"\n🏛️ Athena: {result.response}")
                    
            except Exception as e:
                print(f"\n🏛️ Athena: Could you describe what you need? (e.g., '2D steel truss')")
        
        # ========================================
        # PHASE: MATERIAL SELECTION
        # ========================================
        elif state["phase"] == "material_select":
            available_materials = state.get("available_materials", [])
            req = state["requirements"]
            
            # Check if user asking for help about materials
            if is_asking_for_help(user_input):
                explain_prompt = f"""Explain the different structural materials available for {req.get('structure_type', 'structures')}:
Materials: {', '.join(available_materials)}

User asked: "{user_input}"

Provide a brief, educational explanation of each material:
- Key properties (strength, weight, durability)
- Best use cases
- Common applications in structural engineering"""
                try:
                    explanation = llm.with_structured_output(ParameterExplanation).invoke(explain_prompt)
                    print(f"\n🏛️ Athena: {explanation.explanation}")
                except:
                    print("\n🏛️ Athena: Here's a quick overview:")
                    print("   • Steel: Strong, durable, good for long spans and high loads")
                    print("   • Timber/Wood: Sustainable, aesthetic, good for residential/light structures")
                    print("   • Concrete: Fire-resistant, durable, good for foundations and heavy loads")
                print(f"\n   Now, which material? (1-{len(available_materials)}, or 'any')")
                continue
            
            selected_material = None
            
            # Check for number input
            if user_input.isdigit():
                idx = int(user_input) - 1
                if idx == len(available_materials):  # "Any" option
                    selected_material = "any"
                elif 0 <= idx < len(available_materials):
                    selected_material = available_materials[idx]
            # Check for "any" or "all" keywords
            elif user_input.lower() in ["any", "all", "show all", "doesn't matter", "don't care"]:
                selected_material = "any"
            else:
                # Try to match material name using LLM
                try:
                    mat_prompt = f"""User is selecting material from: {available_materials}
User said: "{user_input}"

Which material did they choose? Return the exact material name from the list, or set wants_any=True if they want all."""
                    mat_result = llm.with_structured_output(MaterialSelection).invoke(mat_prompt)
                    if mat_result.wants_any:
                        selected_material = "any"
                    elif mat_result.selected_material:
                        # Verify it's in our list
                        for m in available_materials:
                            if m.lower() == mat_result.selected_material.lower():
                                selected_material = m
                                break
                except:
                    pass
            
            if not selected_material:
                print(f"\n🏛️ Athena: Please select a material (1-{len(available_materials)}) or type 'any'.")
                continue
            
            req["material"] = selected_material
            
            if selected_material == "any":
                print(f"\n✅ Showing all materials")
            else:
                print(f"\n✅ Material: {selected_material.capitalize()}")
            
            # Now search for blocks
            print("\n🔍 Searching for matching blocks...")
            
            candidates = db.filter_blocks(
                dim=req.get("dimensionality"),
                structure_type=req.get("structure_type"),
                material=selected_material if selected_material != "any" else None
            )
            
            if not candidates:
                try:
                    no_blocks = llm.invoke("User selected a material but no blocks were found for it. briefly apologize and ask for another choice.").content
                    print(f"\n🏛️ Athena: {no_blocks}")
                except:
                    print(f"\n🏛️ Athena: No blocks found with that material.")
                state["phase"] = "understanding"
                state["requirements"] = {}
                continue
            
            state["block_candidates"] = candidates
            
            print(f"\n🏛️ Athena: I found {len(candidates)} matching block(s):\n")
            for i, c in enumerate(candidates, 1):
                block_material = c.get('material', '')
                material_str = f" [{block_material}]" if block_material and block_material != 'N/A' else ""
                print(f"  {i}. **{c['name']}** (ID: {c['id']}){material_str}")
                print(f"     {c['metadata']['description'][:75]}...")
                print()
            
            print("🏛️ Athena: Which one would you like? (enter number or 'describe')")
            state["phase"] = "selecting"
        
        # ========================================
        # PHASE: BLOCK SELECTION (with description support)
        # ========================================
        elif state["phase"] == "selecting":
            candidates = state["block_candidates"]
            
            # Handle explicit rejection first
            if user_input.lower() in ["no", "nope", "n", "cancel", "none", "neither"]:
                state["phase"] = "understanding"
                state["requirements"] = {}
                state["block_candidates"] = []
                print("\n🏛️ Athena: No problem. What type of block would you like instead?")
                continue
            
            # Use LLM to understand user intent
            intent_prompt = f"""The user is looking at these structural blocks:
{json.dumps([{"index": i+1, "name": c["name"], "description": c["metadata"]["description"]} for i, c in enumerate(candidates)], indent=2)}

User said: "{user_input}"

Determine their intent:
- 'select': They want to choose a specific block (provide the index)
- 'describe': They want more information/explanation about the blocks
- 'back': They want to go back and change their requirements"""

            try:
                intent_result = llm.with_structured_output(BlockSelectionIntent).invoke(intent_prompt)
                
                # Handle DESCRIBE intent
                if intent_result.intent == "describe":
                    # Generate detailed explanation
                    explain_prompt = f"""You are a structural engineering expert. The user wants to understand these blocks better.

Blocks available:
{json.dumps([{"name": c["name"], "description": c["metadata"]["description"], "material": c.get("material", "N/A")} for c in candidates], indent=2)}

User asked: "{user_input}"

Provide a clear, educational explanation of:
1. What each block type is used for
2. Key differences between them
3. When you would use each one

Be friendly and helpful. Use bullet points for clarity."""

                    explanation = llm.with_structured_output(BlockExplanation).invoke(explain_prompt)
                    print(f"\n🏛️ Athena: {explanation.explanation}")
                    print("\n" + "-"*50)
                    print("Now, which block would you like to use? (enter number)")
                    continue
                
                # Handle BACK intent
                elif intent_result.intent == "back":
                    state["phase"] = "understanding"
                    state["requirements"] = {}
                    print("\n🏛️ Athena: No problem! What would you like instead?")
                    continue
                
                # Handle SELECT intent
                elif intent_result.intent == "select":
                    selected = None
                    
                    # Try direct number input first
                    if user_input.isdigit():
                        idx = int(user_input) - 1
                        if 0 <= idx < len(candidates):
                            selected = candidates[idx]
                    elif user_input.lower() in ["yes", "y", "ok", "sure"] and len(candidates) == 1:
                        selected = candidates[0]
                    elif intent_result.selected_index and 1 <= intent_result.selected_index <= len(candidates):
                        selected = candidates[intent_result.selected_index - 1]
                    
                    if not selected:
                        print(f"\n🏛️ Athena: I'm not sure which block you want. Please enter a number (1-{len(candidates)}).")
                        continue
                    
                    # Load block
                    block = db.get_block(selected["id"])
                    state["selected_block"] = block
                    state["selected_block_id"] = selected["id"]
                    
                    # Load JS template
                    try:
                        dim = block.get("dimensionality", "2D")
                        subdir = "2D" if "2D" in str(dim).upper() else "3D"
                        js_path = os.path.join(SCRIPT_DIR, subdir, f"{selected['id']}.JS")
                        with open(js_path, "r") as f:
                            state["js_template"] = f.read()
                        print(f"\n📂 Loaded: {subdir}/{selected['id']}.JS")
                    except:
                        state["js_template"] = ""
                    
                    print(f"\n🏛️ Athena: Great choice! Selected **{block['name']}**")
                    print(f"   {block['metadata']['description']}")
                    
                    # Get parameters
                    orchestrator = ParameterOrchestrator(selected["id"])
                    params = orchestrator.get_active_params({})
                    user_params = [(k, s) for k, s in params if not k.startswith("__")]
                    
                    if not user_params:
                        print("\n🏛️ Athena: No parameters needed. Generating code...")
                        state["phase"] = "generating"
                    else:
                        state["param_keys"] = user_params
                        state["current_param_idx"] = 0
                        state["collected_params"] = {}
                        state["phase"] = "collecting"
                        
                        print(f"\n🏛️ Athena: Let's configure {len(user_params)} parameters.")
                        print("-"*50)
                        
                        key, schema = user_params[0]
                        label = schema.get("label", key)
                        default = schema.get("default", "")
                        unit = format_unit(schema.get("unit", ""))
                        
                        # Generate natural question
                        q_prompt = f"""Ask the user for the parameter '{label}'.
Unit: {unit}
Default: {default}
Context: Configuring structural block '{block['name']}'
Generate a short, natural question (1 sentence). Mention default if exists."""
                        try:
                            question = llm.invoke(q_prompt).content
                            print(f"\n🏛️ Athena: {question}")
                        except:
                            # Fallback
                            prompt = f"📝 {label}"
                            if unit: prompt += f" [{unit}]"
                            if default != "": prompt += f" (default: {default})"
                            print(f"\n🏛️ Athena: {prompt}")
                else:
                    print(f"\n🏛️ Athena: Please enter a number (1-{len(candidates)}) or type 'describe' for more info.")
                    
            except Exception as e:
                # Fallback to simple number parsing
                if user_input.isdigit():
                    idx = int(user_input) - 1
                    if 0 <= idx < len(candidates):
                        selected = candidates[idx]
                        block = db.get_block(selected["id"])
                        state["selected_block"] = block
                        state["selected_block_id"] = selected["id"]
                        print(f"\n🏛️ Athena: Selected **{block['name']}**")
                        state["phase"] = "collecting"
                else:
                    print(f"\n🏛️ Athena: Please enter a number (1-{len(candidates)}).")
        
        # ========================================
        # PHASE: COLLECTING PARAMETERS (with help support)
        # ========================================
        elif state["phase"] == "collecting":
            params = state["param_keys"]
            idx = state["current_param_idx"]
            key, schema = params[idx]
            label = schema.get("label", key)
            default = schema.get("default", "")
            unit = schema.get("unit", "").replace("UNIT.", "")
            description = schema.get("description", "")
            
            # Check if user is asking for help/explanation
            if user_input and is_asking_for_help(user_input):
                # Use LLM to explain this parameter
                explain_prompt = f"""You are a structural engineering expert. Explain this parameter to someone configuring a structure.

Block: {state["selected_block"]["name"]}
Parameter: {label} (variable name: {key})
Unit: {unit if unit else "none"}
Default value: {default}
Description from database: {description if description else "Not provided"}

User asked: "{user_input}"

Provide a clear, educational explanation:
1. What this parameter controls in the structure
2. How it affects the design
3. Typical values and when you might want higher or lower values
4. Any important considerations

Be friendly and use simple language. Keep it concise but informative. Ensure perfect grammar and spelling."""

                try:
                    explanation = llm.with_structured_output(ParameterExplanation).invoke(explain_prompt)
                    print(f"\n🏛️ Athena: {explanation.explanation}")
                    print(f"\n   Now, what value would you like for **{label}**? (default: {default})")
                except:
                    print(f"\n🏛️ Athena: '{label}' is a geometric parameter that defines the structure's dimensions.")
                    print(f"   The default value is {default}. What value would you like to use?")
                continue
            
            target_type = schema.get("type", "float")
            
            # Handle empty input (use default)
            if not user_input and default != "":
                value = default
                print(f"   (Using default: {default})")
            elif not user_input:
                print("\n🏛️ Athena: Please enter a value for this parameter.")
                continue
            else:
                # Special handling for boolean parameters
                if target_type == "boolean":
                    lower_input = user_input.lower()
                    if any(word in lower_input for word in ["yes", "y", "true", "sure", "ok", "right", "correct", "1"]):
                        value = True
                    elif any(word in lower_input for word in ["no", "n", "false", "wrong", "not", "0"]):
                        value = False
                    else:
                        # Fallback for boolean LLM interpretation if needed, or ask again
                        bool_prompt = f"User said: '{user_input}'. Is this Yes (True) or No (False)? Return 'true' or 'false'."
                        try:
                            resp = llm.invoke(bool_prompt).content.lower()
                            if "true" in resp: value = True
                            elif "false" in resp: value = False
                            else: raise ValueError
                        except:
                            print("\n🏛️ Athena: Please answer Yes or No.")
                            continue
                else:
                    # Generic Semantic Parsing using LLM
                    # This replaces rigid regex and handles "five", "default", "standard", etc.
                    val_prompt = f"""Parameter: {label} (Type: {target_type})
Default: {default}
User Input: "{user_input}"

Extract the value the user intends.
- If they want default, set intent='default'
- If they provide a number (even as text like 'five'), set intent='value' and numeric_value
- If they ask for help, set intent='help'
"""
                    try:
                        val_result = llm.with_structured_output(ParameterIntent).invoke(val_prompt)
                        
                        if val_result.intent == "default":
                            if default != "":
                                value = default
                                print(f"   (Using default: {default})")
                            else:
                                print("\n🏛️ Athena: This parameter has no default. Please provide a value.")
                                continue
                                
                        elif val_result.intent == "help":
                            # We already handle help above with is_asking_for_help check, 
                            # but if LLM detects it here, we can trigger the same logic or just ask user to clarify.
                            # For simplicity, let's treat it as a "I don't know" -> show info and continue loop
                            print(f"\n🏛️ Athena: To help you decide: {label} controls {description or 'the geometry'}.")
                            continue
                            
                        elif val_result.intent == "value" and val_result.numeric_value is not None:
                            value = val_result.numeric_value
                            
                        else:
                            # Fallback to regex if LLM fails or is unsure
                            numbers = re.findall(r'[-+]?\d*\.?\d+', user_input)
                            if numbers:
                                value = float(numbers[0])
                            else:
                                print("\n🏛️ Athena: I couldn't understand that value. Please enter a number.")
                                continue
                                
                    except Exception as e:
                        # Fallback to regex
                        numbers = re.findall(r'[-+]?\d*\.?\d+', user_input)
                        if numbers:
                            value = float(numbers[0])
                        else:
                            print("\n🏛️ Athena: Please enter a number.")
                            continue
            
            # Validate the value
            orchestrator = ParameterOrchestrator(state["selected_block_id"])
            is_valid, result = orchestrator.validate_value(key, str(value), state["collected_params"])
            
            if not is_valid:
                print(f"\n🏛️ Athena: ⚠️ {result}")
                continue
            
            state["collected_params"][key] = result
            print(f"✅ {label} = {result}")
            
            state["current_param_idx"] += 1
            
            if state["current_param_idx"] < len(params):
                key, schema = params[state["current_param_idx"]]
                label = schema.get("label", key)
                default = schema.get("default", "")
                unit = format_unit(schema.get("unit", ""))
                
                # Generate natural question for next parameter
                q_prompt = f"""Ask the user for the parameter '{label}'.
Unit: {unit}
Default: {default}
Context: Configuring structural block '{state['selected_block']['name']}'
Generate a short, natural question (1 sentence). Mention default if exists."""
                try:
                    question = llm.invoke(q_prompt).content
                    print(f"\n🏛️ Athena: {question}")
                except:
                    prompt = f"📝 {label}"
                    if unit: prompt += f" [{unit}]"
                    if default != "": prompt += f" (default: {default})"
                    print(f"\n🏛️ Athena: {prompt}")
            else:
                print("\n🏛️ Athena: All parameters set! Generating code...")
                state["phase"] = "generating"
        
        # ========================================
        # PHASE: GENERATING CODE (with RFEM integration)
        # ========================================
        if state["phase"] == "generating":
            block = state["selected_block"]
            block_id = state["selected_block_id"]
            params = state["collected_params"]
            
            dim = block.get("dimensionality", "2D")
            subdir = "2D" if "2D" in str(dim).upper() else "3D"
            
            if state["js_template"]:
                try:
                    manipulator = JSManipulator(state["js_template"])
                    generated = manipulator.inject_parameters(params)
                    
                    output_path = os.path.join(SCRIPT_DIR, subdir, f"{block_id}_generated.JS")
                    with open(output_path, "w") as f:
                        f.write(generated)
                    
                    # Generate clickable URL
                    file_url = get_file_explorer_url(output_path)
                    
                    print("\n" + "="*60)
                    print("✅ CODE GENERATED SUCCESSFULLY!")
                    print("="*60)
                    print(f"\n📁 File: {subdir}/{block_id}_generated.JS")
                    print(f"🏗️ Block: {block['name']}")
                    print(f"\n📊 Parameters Used:")
                    for k, v in params.items():
                        print(f"   • {k} = {v}")
                    print("-"*60)
                    
                    # RFEM Integration - REMOVED as per user request
                    print(f"\n✅ Script ready at: {output_path}")
                    print("   You may now manually import this into RFEM.")
                    
                except Exception as e:
                    print(f"\n❌ Error: {e}")
            else:
                print("\n⚠️ No JS template found for this block.")
            
            # Use LLM for natural completion message
            completion_prompt = """You are Athena. Code generation complete. 
Generate a brief, friendly message (1 sentence) asking if user wants to create another block."""
            try:
                completion_msg = llm.invoke(completion_prompt).content
                print(f"\n🏛️ Athena: {completion_msg}")
            except:
                print("\n🏛️ Athena: Ready for another block?")
            
            state = {
                "phase": "understanding",
                "requirements": {},
                "available_materials": [],
                "block_candidates": [],
                "selected_block": None,
                "selected_block_id": None,
                "js_template": "",
                "collected_params": {},
                "param_keys": [],
                "current_param_idx": 0
            }

if __name__ == "__main__":
    run_conversation()
