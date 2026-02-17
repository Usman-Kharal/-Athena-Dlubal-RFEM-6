
import json
import os
import re
import time
from typing import Optional, Dict, Any, List
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field
import esprima
from dotenv import load_dotenv

load_dotenv()

# Get the directory where this script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# ============================================================================
# LAZY LLM SETUP - Deferred to avoid blocking server startup
# ============================================================================

class _LazyLLM:
    """Lazy wrapper that initializes ChatOpenAI on first use, not at import time."""
    def __init__(self):
        self._instance = None

    def _get(self):
        if self._instance is None:
            print("⏳ Initializing LLM connection...")
            start = time.time()
            self._instance = ChatOpenAI(model="gpt-4o", temperature=0)
            print(f"✅ LLM ready in {time.time() - start:.1f}s")
        return self._instance

    def __getattr__(self, name):
        if name.startswith('_'):
            return super().__getattribute__(name)
        return getattr(self._get(), name)

    def invoke(self, *args, **kwargs):
        return self._get().invoke(*args, **kwargs)

    def with_structured_output(self, *args, **kwargs):
        return self._get().with_structured_output(*args, **kwargs)

llm = _LazyLLM()

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class IntentExtraction(BaseModel):
    dimensionality: Optional[str] = Field(None, description="2D or 3D")
    structure_type: Optional[str] = Field(None, description="Type like truss, frame, beam, arch, bridge, roof")
    material: Optional[str] = Field(None, description="Material like steel, timber")
    application: Optional[str] = Field(None, description="The specific application if mentioned (e.g. warehouse, stadium, bridge)")
    is_complete: bool = Field(False)
    response: str = Field("", description="Natural conversational response to user")

class SmartParameterExtraction(BaseModel):
    """Extract numeric parameters from natural language"""
    parameters: Dict[str, float] = Field(description="Key-value pairs of extracted parameters (e.g., {'L': 12.5})")

class BlockSelectionIntent(BaseModel):
    intent: str = Field(description="'select', 'describe', or 'back'")
    selected_index: Optional[int] = Field(None)
    question_about: Optional[str] = Field(None)

class BlockExplanation(BaseModel):
    explanation: str = Field("")

class ParameterExplanation(BaseModel):
    explanation: str = Field("")

class ParameterValueResponse(BaseModel):
    intent: str = Field(description="one of: 'provide_value', 'use_default', 'ask_help', 'stop'")
    number_value: Optional[float] = Field(None, description="The extracted numeric value")
    bool_value: Optional[bool] = Field(None, description="The extracted boolean value")
    comment: Optional[str] = Field(None, description="A brief conversational comment if needed")

class MaterialSelection(BaseModel):
    """Determine what user wants during material selection"""
    selected_material: Optional[str] = Field(None, description="The material user selected (steel, timber, concrete, etc.)")
    wants_any: bool = Field(False, description="True if user wants to see all materials")

class CleanupIntent(BaseModel):
    """Determine if user wants to exit"""
    is_exit: bool = Field(description="True if the user wants to exit/quit/stop the application")

# ============================================================================
# JS MANIPULATOR CLASS
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
                    if node.callee.name in ['parameter_float', 'parameter_int', 'parameter_check', 'combobox', 'combobox_value']:
                        args = node.arguments
                        if len(args) >= 2:
                            # For combobox(label, name)
                            # For parameter_*(label, name, ...)
                            param_name = None
                            if hasattr(args[1], 'type') and args[1].type == 'Literal':
                                param_name = args[1].value
                            
                            if param_name:
                                call_info = {
                                    'name': param_name,
                                    'node': node,
                                    'range': node.range,
                                    'args': args,
                                    'func_name': node.callee.name,
                                    'label': args[0].value if hasattr(args[0], 'value') else param_name
                                }
                                calls.append(call_info)
            
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
        # Sort calls by range start in reverse order to apply replacements from end to start without affecting indices
        calls.sort(key=lambda x: x['range'][0], reverse=True)
        
        edits = []
        for call in calls:
            param_name = call['name']
            if param_name not in params: 
                continue
                
            func_name = call['func_name']
            args = call['args']
            default_val_idx = -1
            if func_name in ['parameter_float', 'parameter_int'] and len(args) >= 4:
                default_val_idx = 3
            elif func_name == 'parameter_check' and len(args) >= 3:
                default_val_idx = 2
                
            if default_val_idx != -1:
                default_node = args[default_val_idx]
                user_val = params[param_name]
                
                if isinstance(user_val, bool):
                     new_text = "true" if user_val else "false"
                else:
                     new_text = str(user_val)
                     
                edits.append((default_node.range, new_text))
        
        # Apply edits
        result = list(self.original_code)
        for (start, end), new_text in edits:
            result[start:end] = list(new_text)
        
        return "".join(result)

# ============================================================================
# DATABASE CLASS
# ============================================================================

class BlockDatabase:
    def __init__(self, db_2d_path: str, db_3d_path: str):
        db_2d_full = os.path.join(SCRIPT_DIR, db_2d_path)
        db_3d_full = os.path.join(SCRIPT_DIR, db_3d_path)
        
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
        
        # Determine JS file path
        dim = block.get("dimensionality", "2D")
        subdir = "2D" if "2D" in str(dim).upper() else "3D"
        js_path = os.path.join(SCRIPT_DIR, subdir, f"{block_id}.js")
        if not os.path.exists(js_path):
             js_path = os.path.join(SCRIPT_DIR, subdir, f"{block_id}.JS")
        
        params = {}
        if os.path.exists(js_path):
            with open(js_path, 'r') as f:
                js_code = f.read()
            
            manipulator = JSManipulator(js_code)
            calls = manipulator.find_parameter_calls()
            
            # Process calls to build schema
            # We preserve order using dict (Python 3.7+)
            for call in calls:
                name = call['name']
                func = call['func_name']
                args = call['args']
                label = call['label']
                
                param_def = {"label": label}
                
                if func == 'parameter_float':
                    param_def["type"] = "float"
                    if len(args) >= 4:
                        if hasattr(args[3], 'value'):
                            param_def["default"] = args[3].value
                        elif hasattr(args[3], 'raw'): # fallback
                             param_def["default"] = args[3].raw
                    if len(args) >= 5:
                        pass 
                        
                elif func == 'parameter_int':
                    param_def["type"] = "int"
                    if len(args) >= 4 and hasattr(args[3], 'value'):
                         param_def["default"] = int(args[3].value)
                         
                elif func == 'parameter_check':
                    param_def["type"] = "boolean"
                    param_def["is_bool"] = True
                    if len(args) >= 3 and hasattr(args[2], 'value'):
                         param_def["default"] = bool(args[2].value)
                
                elif func == 'combobox':
                     # Handled differently, usually followed by values
                     pass
                     
                if "type" in param_def:
                    params[name] = param_def
        
        # If JS parsing failed or returned empty (fallback to JSON?)
        if not params:
            # Fallback to old JSON method
            inputs = block.get("inputs", {})
            def extract_params(obj, parent_key=""):
                if isinstance(obj, dict):
                    if "type" in obj or "default" in obj:
                        if parent_key:
                            params[parent_key] = obj
                    else:
                        for key, value in obj.items():
                            if key in ["dynamic_arrays", "selection_modes"]:
                                continue
                            if isinstance(value, dict):
                                if "type" in value or "default" in value:
                                    params[key] = value
                                else:
                                    extract_params(value, key)
            extract_params(inputs)
            
        return params

# ============================================================================
# LAZY DATABASE INIT - Deferred to avoid blocking server startup
# ============================================================================

class _LazyDB:
    """Lazy wrapper that loads the database on first access."""
    def __init__(self):
        self._instance = None

    def _get(self):
        if self._instance is None:
            print("⏳ Loading block database...")
            start = time.time()
            self._instance = BlockDatabase("2D/2D_DB.json", "3D/3D_DB.json")
            print(f"✅ Database loaded in {time.time() - start:.1f}s ({len(self._instance.all_blocks)} blocks)")
        return self._instance

    def __getattr__(self, name):
        if name.startswith('_'):
            return super().__getattribute__(name)
        return getattr(self._get(), name)

db = _LazyDB()
