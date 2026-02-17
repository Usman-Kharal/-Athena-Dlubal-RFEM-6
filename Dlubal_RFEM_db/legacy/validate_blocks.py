"""
Comprehensive Block Validation Script
Tests all 2D and 3D blocks for compatibility with NaturalConversation.py
"""

import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Import the NaturalConversation components
sys.path.insert(0, SCRIPT_DIR)
from NaturalConversation import db, JSManipulator, ParameterOrchestrator

def validate_all_blocks():
    """Test all blocks in the database"""
    
    output = []
    output.append("=" * 70)
    output.append("COMPREHENSIVE BLOCK VALIDATION")
    output.append("=" * 70)
    
    results = {
        "2D": {"total": 0, "working": 0, "issues": []},
        "3D": {"total": 0, "working": 0, "issues": []}
    }
    
    # Test 2D blocks
    output.append("\n2D BLOCKS:")
    output.append("-" * 70)
    
    for block in db.db_2d:
        results["2D"]["total"] += 1
        block_id = block["id"]
        block_name = block["name"]
        issues = []
        
        # Check 1: JS template exists
        js_path = os.path.join(SCRIPT_DIR, "2D", f"{block_id}.JS")
        if not os.path.exists(js_path):
            issues.append("JS template MISSING")
        else:
            # Check 2: JS can be parsed
            try:
                with open(js_path, "r") as f:
                    js_code = f.read()
                manipulator = JSManipulator(js_code)
                param_calls = manipulator.find_parameter_calls()
                
                if len(param_calls) == 0:
                    issues.append("No param calls in JS")
            except Exception as e:
                issues.append(f"JS parse error: {str(e)[:40]}")
        
        # Check 3: Parameter schema extraction
        try:
            orchestrator = ParameterOrchestrator(block_id)
            params = orchestrator.get_active_params({})
            user_params = [(k, s) for k, s in params if not k.startswith("__")]
            param_count = len(user_params)
        except Exception as e:
            issues.append(f"Schema error: {str(e)[:40]}")
            param_count = 0
        
        # Report
        if issues:
            results["2D"]["issues"].append({
                "id": block_id,
                "name": block_name,
                "issues": issues
            })
            output.append(f"  [ISSUE] {block_id} - {block_name[:35]}")
            for issue in issues:
                output.append(f"          -> {issue}")
        else:
            results["2D"]["working"] += 1
            output.append(f"  [OK] {block_id} - {block_name[:35]} ({param_count} params)")
    
    # Test 3D blocks
    output.append("\n3D BLOCKS:")
    output.append("-" * 70)
    
    for block in db.db_3d:
        results["3D"]["total"] += 1
        block_id = block["id"]
        block_name = block["name"]
        issues = []
        
        # Check 1: JS template exists
        js_path = os.path.join(SCRIPT_DIR, "3D", f"{block_id}.JS")
        if not os.path.exists(js_path):
            issues.append("JS template MISSING")
        else:
            # Check 2: JS can be parsed
            try:
                with open(js_path, "r") as f:
                    js_code = f.read()
                manipulator = JSManipulator(js_code)
                param_calls = manipulator.find_parameter_calls()
                
                if len(param_calls) == 0:
                    issues.append("No param calls in JS")
            except Exception as e:
                issues.append(f"JS parse error: {str(e)[:40]}")
        
        # Check 3: Parameter schema extraction
        try:
            orchestrator = ParameterOrchestrator(block_id)
            params = orchestrator.get_active_params({})
            user_params = [(k, s) for k, s in params if not k.startswith("__")]
            param_count = len(user_params)
        except Exception as e:
            issues.append(f"Schema error: {str(e)[:40]}")
            param_count = 0
        
        # Report
        if issues:
            results["3D"]["issues"].append({
                "id": block_id,
                "name": block_name,
                "issues": issues
            })
            output.append(f"  [ISSUE] {block_id} - {block_name[:35]}")
            for issue in issues:
                output.append(f"          -> {issue}")
        else:
            results["3D"]["working"] += 1
            output.append(f"  [OK] {block_id} - {block_name[:35]} ({param_count} params)")
    
    # Summary
    output.append("\n" + "=" * 70)
    output.append("SUMMARY")
    output.append("=" * 70)
    
    output.append(f"\n2D Blocks: {results['2D']['working']}/{results['2D']['total']} working")
    output.append(f"3D Blocks: {results['3D']['working']}/{results['3D']['total']} working")
    
    total = results['2D']['total'] + results['3D']['total']
    working = results['2D']['working'] + results['3D']['working']
    output.append(f"\nOverall: {working}/{total} blocks fully working ({100*working/total:.1f}%)")
    
    # List structure types
    output.append("\n" + "=" * 70)
    output.append("AVAILABLE STRUCTURE TYPES")
    output.append("=" * 70)
    
    output.append("\n2D Types:")
    for t in db.get_structure_types("2D"):
        count = len([b for b in db.db_2d if b.get("main_member", "").lower() == t])
        output.append(f"  - {t} ({count} blocks)")
    
    output.append("\n3D Types:")
    for t in db.get_structure_types("3D"):
        count = len([b for b in db.db_3d if b.get("main_member", "").lower() == t])
        output.append(f"  - {t} ({count} blocks)")
    
    # Save to file
    result_text = "\n".join(output)
    with open(os.path.join(SCRIPT_DIR, "validation_results.txt"), "w", encoding="utf-8") as f:
        f.write(result_text)
    
    print(result_text)
    print(f"\nResults saved to: validation_results.txt")
    
    return results

if __name__ == "__main__":
    validate_all_blocks()
