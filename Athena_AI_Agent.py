"""
RFEM Structural Block Generator - Web API Server
Flask backend with WebSocket support for real-time chat
"""

from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import os
import re
import webbrowser
import threading
import time
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv


# Import shared logic to reduce code duplication
from shared_logic import (
    db, llm, JSManipulator, 
    IntentExtraction, SmartParameterExtraction, BlockSelectionIntent, 
    BlockExplanation, ParameterExplanation, ParameterValueResponse
)

load_dotenv()

# Get the directory where this script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)




# ============================================================================
# SESSION STATE MANAGEMENT
# ============================================================================

sessions = {}

def get_session(session_id):
    if session_id not in sessions:
        sessions[session_id] = {
            "phase": "understanding",
            "requirements": {},
            "block_candidates": [],
            "selected_block": None,
            "selected_block_id": None,
            "js_template": "",
            "collected_params": {},
            "param_keys": [],
            "current_param_idx": 0,
            "history": []
        }
    return sessions[session_id]

def is_asking_for_help(user_input: str) -> bool:
    help_patterns = [
        r'\bwhat\b.*\bis\b', r'\bwhat\b.*\bare\b', r'\bwhat\b.*\bmean',
        r'\bdescribe\b', r'\bexplain\b', r'\btell\b.*\babout\b', r'\bhelp\b',
        r'\bmore\b.*\binfo', r'\bdetails?\b'
    ]
    lower_input = user_input.lower()
    for pattern in help_patterns:
        if re.search(pattern, lower_input):
            return True
    return False

# ============================================================================
# API ROUTES
# ============================================================================

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    session_id = data.get('session_id', 'default')
    user_message = data.get('message', '').strip()
    
    state = get_session(session_id)
    response_data = {"messages": [], "ui_elements": None}
    
    # Prune history to last 6 turns to keep context relavant but not huge
    if "history" not in state:
        state["history"] = []
    
    msg_history = state["history"][-6:]
    history_text = "\n".join([f"{m['role']}: {m['content']}" for m in msg_history])
    
    # Handle restart
    if user_message.lower() == 'restart':
        sessions[session_id] = get_session('new_session_' + session_id)
        sessions.pop('new_session_' + session_id, None)
        sessions.pop('new_session_' + session_id, None)
        return jsonify(response_data)
    
    # ========================================
    # PHASE: UNDERSTANDING USER INTENT
    # ========================================
    if state["phase"] == "understanding":
        all_types_2d = db.get_structure_types("2D")
        all_types_3d = db.get_structure_types("3D")
        
        extraction_prompt = f"""You are Athena, an intelligent block generator.
        Identify the user's intent and extract requirements.
        
        CONTEXT:
        {history_text}
        User: "{user_message}"
        
        AVAILABLE STRUCTURES:
        - 2D: {', '.join(all_types_2d)}
        - 3D: {', '.join(all_types_3d)}
        
        CURRENT STATE: {json.dumps(state['requirements'])}
        
        INSTRUCTIONS:
        1. If the user greets you (hi, hello), respond naturally without repeating yourself if you already greeted them. Ask them what they need.
        2. If they mention an application (e.g. "warehouse"), infer the structure type (e.g. "frame").
        3. Extract dimensionality (2D/3D), type, and material.
        
        Provide a natural, helpful response."""

        try:
            result = llm.with_structured_output(IntentExtraction).invoke(extraction_prompt)
            
            if result.dimensionality:
                state["requirements"]["dimensionality"] = result.dimensionality.upper()
            if result.structure_type:
                state["requirements"]["structure_type"] = result.structure_type.lower()
            if result.material:
                state["requirements"]["material"] = result.material.lower()
            
            req = state["requirements"]
            
            if req.get("dimensionality") and req.get("structure_type"):
                response_data["messages"].append({
                    "type": "assistant",
                    "content": result.response
                })
                
                # Update history
                state["history"].append({"role": "User", "content": user_message})
                state["history"].append({"role": "Athena", "content": result.response})

                candidates = db.filter_blocks(
                    dim=req.get("dimensionality"),
                    structure_type=req.get("structure_type"),
                    material=req.get("material") if req.get("material") else None
                )
                
                if not candidates:
                    candidates = db.filter_blocks(
                        dim=req.get("dimensionality"),
                        structure_type=req.get("structure_type")
                    )
                
                if not candidates:
                    response_data["messages"].append({
                        "type": "assistant",
                        "content": f"I couldn't find any matching blocks. Available types: {', '.join(db.get_structure_types(req.get('dimensionality', '2D')))}"
                    })
                    state["requirements"] = {}
                else:
                    state["block_candidates"] = candidates
                    state["phase"] = "selecting"
                    
                    blocks_html = "<div class='block-list'>"
                    for i, c in enumerate(candidates, 1):
                        blocks_html += f"""
                        <div class='block-card' data-index='{i}'>
                            <div class='block-number'>{i}</div>
                            <div class='block-info'>
                                <div class='block-name'>{c['name']}</div>
                                <div class='block-desc'>{c['metadata']['description'][:100]}...</div>
                            </div>
                        </div>
                        """
                    blocks_html += "</div>"
                    
                    response_data["messages"].append({
                        "type": "assistant",
                        "content": f"🔍 Found {len(candidates)} matching block(s):",
                        "html": blocks_html
                    })
                    response_data["messages"].append({
                        "type": "assistant",
                        "content": "Which one would you like? Enter the number, or type 'describe' to learn more."
                    })
            else:
                response_data["messages"].append({
                    "type": "assistant",
                    "content": result.response
                })
                # Update history
                state["history"].append({"role": "User", "content": user_message})
                state["history"].append({"role": "Athena", "content": result.response})
                
        except Exception as e:
            fallback = "Could you describe what you need? (e.g., '2D steel truss')"
            response_data["messages"].append({
                "type": "assistant",
                "content": fallback
            })
            state["history"].append({"role": "User", "content": user_message})
            state["history"].append({"role": "Athena", "content": fallback})
    
    # ========================================
    # PHASE: BLOCK SELECTION
    # ========================================
    elif state["phase"] == "selecting":
        candidates = state["block_candidates"]
        
        intent_prompt = f"""User is looking at these blocks:
{json.dumps([{"index": i+1, "name": c["name"]} for i, c in enumerate(candidates)])}

User said: "{user_message}"

Intent: 'select' (choosing), 'describe' (wants info), or 'back' (change requirements)"""

        try:
            intent_result = llm.with_structured_output(BlockSelectionIntent).invoke(intent_prompt)
            
            if intent_result.intent == "describe":
                explain_prompt = f"""Explain these structural blocks:
{json.dumps([{"name": c["name"], "description": c["metadata"]["description"]} for c in candidates])}

User asked: "{user_message}"

Provide educational explanation with bullet points."""

                explanation = llm.with_structured_output(BlockExplanation).invoke(explain_prompt)
                response_data["messages"].append({
                    "type": "assistant",
                    "content": explanation.explanation
                })
                response_data["messages"].append({
                    "type": "assistant",
                    "content": "Now, which block would you like to use? (enter number)"
                })
                
            elif intent_result.intent == "back":
                state["phase"] = "understanding"
                state["requirements"] = {}
                response_data["messages"].append({
                    "type": "assistant",
                    "content": "No problem! What would you like instead?"
                })
                
            else:  # select
                selected = None
                if user_message.isdigit():
                    idx = int(user_message) - 1
                    if 0 <= idx < len(candidates):
                        selected = candidates[idx]
                elif intent_result.selected_index and 1 <= intent_result.selected_index <= len(candidates):
                    selected = candidates[intent_result.selected_index - 1]
                elif user_message.lower() in ["yes", "y", "ok"] and len(candidates) == 1:
                    selected = candidates[0]
                
                if not selected:
                    response_data["messages"].append({
                        "type": "assistant",
                        "content": f"Please enter a number (1-{len(candidates)})"
                    })
                else:
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
                    except:
                        state["js_template"] = ""
                    
                    response_data["messages"].append({
                        "type": "assistant",
                        "content": f"✅ Selected: **{block['name']}**\n\n{block['metadata']['description']}"
                    })
                    
                    # Get parameters
                    schema = db.get_param_schema(selected["id"])
                    user_params = [(k, s) for k, s in schema.items() if not k.startswith("__")]
                    
                    # SMART PARAMETER EXTRACTION
                    # Check if user already provided some numbers in their message history
                    try:
                        # Combine last few user messages for context
                        context_text = user_message 
                        
                        param_prompt = f"""Extract parameter values from this text for a block with these parameters:
                        {json.dumps({k: s.get('label', k) for k, s in user_params})}
                        
                        Text: "{context_text}"
                        
                        Return a JSON dict of parameter keys and values found."""
                        
                        extracted = llm.with_structured_output(SmartParameterExtraction).invoke(param_prompt)
                        if extracted.parameters:
                            state["collected_params"].update(extracted.parameters)
                            # Remove collected from user_params list
                            user_params = [p for p in user_params if p[0] not in state["collected_params"]]
                            
                            formatted_params = ", ".join([f"{k}={v}" for k, v in extracted.parameters.items()])
                            response_data["messages"].append({
                                "type": "assistant",
                                "content": f"I noticed you mentioned some dimensions: {formatted_params}. I'll use those."
                            })
                    except Exception as e:
                        print(f"Extraction error: {e}")
                    
                    if not user_params:
                        state["phase"] = "generating"
                        response_data["messages"].append({
                            "type": "assistant",
                            "content": "No parameters needed. Generating code..."
                        })
                    else:
                        state["param_keys"] = user_params
                        state["current_param_idx"] = 0
                        state["collected_params"] = {}
                        state["phase"] = "collecting"
                        
                        key, sch = user_params[0]
                        label = sch.get("label", key)
                        default = sch.get("default", "")
                        unit = sch.get("unit", "").replace("UNIT.", "")
                        
                        response_data["messages"].append({
                            "type": "assistant",
                            "content": f"Let's configure {len(user_params)} parameters."
                        })
                        
                        # Generate natural question for first parameter
                        try:
                            q_prompt = f"""Ask the user for the value of this structural parameter:
                            Block: {block['name']}
                            Parameter: {label} (key: {key})
                            Default: {default} {unit}
                            
                            Write a short, natural question (e.g. "What should be the total length?").
                            IMPORTANT: Do NOT mention the default value in the question text. The user can already see it in the input field."""
                            question = llm.invoke(q_prompt).content
                        except:
                            question = f"Please enter {label}:"

                        response_data["messages"].append({
                            "type": "assistant",
                            "content": question
                        })
                        
                        response_data["ui_elements"] = {
                            "type": "parameter_input",
                            "param_key": key,
                            "label": label,
                            "default": default,
                            "unit": unit,
                            "index": 1,
                            "total": len(user_params),
                            "param_type": sch.get("type", "string")
                        }
                        
        except Exception as e:
            response_data["messages"].append({
                "type": "assistant",
                "content": f"Please enter a number (1-{len(candidates)})"
            })
    
    # ========================================
    # PHASE: COLLECTING PARAMETERS
    # ========================================
    elif state["phase"] == "collecting":
        params = state["param_keys"]
        idx = state["current_param_idx"]
        key, schema = params[idx]
        label = schema.get("label", key)
        default = schema.get("default", "")
        
        # Check for help request
        if user_message and is_asking_for_help(user_message):
            explain_prompt = f"""Explain this structural parameter:
Block: {state["selected_block"]["name"]}
Parameter: {label} (key: {key})
Default: {default}

User asked: "{user_message}"

Explain what this parameter controls and typical values."""

            try:
                explanation = llm.with_structured_output(ParameterExplanation).invoke(explain_prompt)
                response_data["messages"].append({
                    "type": "assistant",
                    "content": explanation.explanation
                })
            except:
                response_data["messages"].append({
                    "type": "assistant",
                    "content": f"'{label}' defines a geometric property of the structure."
                })
            
            response_data["ui_elements"] = {
                "type": "parameter_input",
                "param_key": key,
                "label": label,
                "default": default,
                "unit": schema.get("unit", "").replace("UNIT.", ""),
                "index": idx + 1,
                "total": len(params),
                "param_type": schema.get("type", "string")
            }
            return jsonify(response_data)
        
        # Process value
        # SMART AI INTERPRETER
        try:
            # Use LLM to interpret user intent instead of rigid regex
            interp_prompt = f"""User Input: "{user_message}"
            
            Context:
            - Block: {state["selected_block"]["name"]}
            - Parameter: {label} (Type: {schema.get('type', 'number')})
            - Default: {default}
            
            Interpret the user's input.
            - If they give a value (e.g. "5", "5m", "True", "Yes"), extract it.
            - If they say "default", "standard", "skip", or hit enter, use 'use_default'.
            - If they ask a question or seem confused, use 'ask_help'.
            """
            
            interpretation = llm.with_structured_output(ParameterValueResponse).invoke(interp_prompt)
            
            if interpretation.intent == "ask_help":
                raise ValueError("User asking for help")
            
            elif interpretation.intent == "use_default":
                if default == "":
                    # No default exists, but user asked for it.
                    response_data["messages"].append({
                        "type": "assistant",
                        "content": f"There is no default value for {label}. Please provide a value."
                    })
                    # Re-ask
                    return jsonify(response_data)
                value = float(default) if isinstance(default, (int, float)) or (isinstance(default, str) and default.replace('.','').isdigit()) else default
                
            elif interpretation.intent == "provide_value":
                if schema.get("type") == "boolean" or schema.get("is_bool") or isinstance(default, bool):
                    # Expect boolean
                    if interpretation.bool_value is not None:
                        value = interpretation.bool_value
                    else:
                        # Fallback if LLM put bool in comment or missed it
                         value = True if "true" in user_message.lower() else False
                else:
                    # Expect number
                    if interpretation.number_value is not None:
                        value = interpretation.number_value
                    else:
                        response_data["messages"].append({
                            "type": "assistant",
                            "content": "I understood you want to set a value, but I couldn't understand the number. Could you just type the number?"
                        })
                        return jsonify(response_data)
            
            elif interpretation.intent == "stop":
                 state["phase"] = "understanding"
                 response_data["messages"].append({
                    "type": "assistant",
                    "content": "Okay, let's stop this structure. What else can I help you with?"
                 })
                 return jsonify(response_data)
            
            else:
                 # Fallback
                 value = default
                 
        except Exception as e:
            # If LLM fails or explicitly raises 'help'
            print(f"Interpreter exception: {e}")
            # Treat as help request
            explain_prompt = f"""The user is confused about this parameter:
            Block: {state["selected_block"]["name"]}
            Parameter: {label}
            
            User said: "{user_message}"
            
            Briefly explain what this parameter is and suggest the default value ({default}) if valid."""
            
            try:
                explanation = llm.with_structured_output(ParameterExplanation).invoke(explain_prompt)
                response_data["messages"].append({
                    "type": "assistant",
                    "content": f"{explanation.explanation}"
                })
            except:
                response_data["messages"].append({
                    "type": "assistant",
                    "content": f"I'm not sure. This parameter controls {label}. standard value is {default}."
                })

            response_data["ui_elements"] = {
                "type": "parameter_input",
                "param_key": key,
                "label": label,
                "default": default,
                "unit": schema.get("unit", "").replace("UNIT.", ""),
                "index": idx + 1,
                "total": len(params),
                "param_type": schema.get("type", "string")
            }
            return jsonify(response_data)
        
        state["collected_params"][key] = value
        response_data["messages"].append({
            "type": "success",
            "content": f"✅ {label} = {value}"
        })
        
        state["current_param_idx"] += 1
        
        if state["current_param_idx"] < len(params):
            key, schema = params[state["current_param_idx"]]
            label = schema.get("label", key)
            default = schema.get("default", "")
            unit = schema.get("unit", "").replace("UNIT.", "")
            
            # Generate natural question for next parameter
            try:
                q_prompt = f"""Ask the user for the value of this structural parameter:
                Block: {state['selected_block']['name']}
                Parameter: {label} (key: {key})
                Default: {default} {unit}
                
                Write a short, natural question.
                IMPORTANT: Do NOT mention the default value in the question text."""
                question = llm.invoke(q_prompt).content
            except:
                question = f"Please enter {label}:"

            response_data["messages"].append({
                "type": "assistant",
                "content": question
            })
            
            response_data["ui_elements"] = {
                "type": "parameter_input",
                "param_key": key,
                "label": label,
                "default": default,
                "unit": unit,
                "index": state["current_param_idx"] + 1,
                "total": len(params),
                "param_type": schema.get("type", "string")
            }
        else:
            state["phase"] = "generating"
            response_data["messages"].append({
                "type": "assistant",
                "content": "All parameters set! Generating code..."
            })
    
    # ========================================
    # PHASE: GENERATING CODE
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
                
                file_url = f"file:///{output_path.replace(os.sep, '/')}"
                
                output_path_js = output_path.replace("\\", "\\\\")
                
                result_html = f"""
                <div class='generation-result'>
                    <div class='result-header'>✅ Code Generated Successfully!</div>
                    <div class='result-file'>
                        <span class='file-icon'>📁</span>
                        <span class='file-path'>{subdir}/{block_id}_generated.JS</span>
                    </div>
                    <div class='result-block'>🏗️ {block['name']}</div>
                    <div class='result-params'>
                        <div class='params-header'>📊 Parameters:</div>
                        {"".join([f"<div class='param-item'>• {k} = {'Yes' if v is True else 'No' if v is False else v}</div>" for k, v in params.items()])}
                    </div>
                    <div class='action-buttons'>
                        <a href='{file_url}' class='btn btn-secondary' target='_blank'>📂 Open File</a>
                        <button class='btn btn-secondary' onclick='copyToClipboard("{output_path_js}")'>📋 Copy Path</button>
                    </div>
                    <div class='file-path-full'>{output_path}</div>
                </div>
                """
                
                response_data["messages"].append({
                    "type": "result",
                    "content": "Code generated!",
                    "html": result_html
                })
            except Exception as e:
                response_data["messages"].append({
                    "type": "error",
                    "content": f"Error: {str(e)}"
                })
        
        # Reset state
        state["phase"] = "understanding"
        state["requirements"] = {}
        state["block_candidates"] = []
        state["selected_block"] = None
        state["selected_block_id"] = None
        state["js_template"] = ""
        state["collected_params"] = {}
        state["param_keys"] = []
        state["current_param_idx"] = 0
        state["history"] = []  # Clear history to restart context
        
        response_data["messages"].append({
            "type": "assistant",
            "content": "Ready for the next task. Do you need a 2D or 3D structure?"
        })
    
    return jsonify(response_data)

@app.route('/api/blocks')
def get_blocks():
    """Get all available blocks"""
    return jsonify({
        "2D": [{"id": b["id"], "name": b["name"], "type": b.get("main_member", "")} for b in db.db_2d],
        "3D": [{"id": b["id"], "name": b["name"], "type": b.get("main_member", "")} for b in db.db_3d]
    })

@app.route('/api/health')
def health_check():
    """Health check endpoint - responds immediately to confirm server is running"""
    return jsonify({"status": "ok", "ready": True})

def open_browser_when_ready(port, max_retries=15):
    """Wait for the server to be ready, then open the browser."""
    import urllib.request
    url = f"http://localhost:{port}"
    for i in range(max_retries):
        try:
            urllib.request.urlopen(f"{url}/api/health", timeout=1)
            print(f"\n✅ Server is ready! Opening browser...")
            webbrowser.open(url)
            return
        except Exception:
            time.sleep(0.5)
    print(f"\n⚠️ Could not auto-open browser. Please navigate to: {url}")

if __name__ == '__main__':
    # Create templates directory if not exists
    os.makedirs(os.path.join(SCRIPT_DIR, 'templates'), exist_ok=True)
    os.makedirs(os.path.join(SCRIPT_DIR, 'static'), exist_ok=True)
    
    PORT = 5000
    
    print("\n" + "="*60)
    print("🚀 RFEM Structural Block Generator - Web Server")
    print("="*60)
    print(f"\n📍 Server starting on: http://localhost:{PORT}")
    print("Press Ctrl+C to stop the server")
    print("⏳ Waiting for server to be ready before opening browser...\n")
    
    # Only auto-open browser in the main process (not the reloader child)
    if os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
        threading.Thread(
            target=open_browser_when_ready, 
            args=(PORT,), 
            daemon=True
        ).start()
    
    debug_mode = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    app.run(debug=debug_mode, port=PORT)
