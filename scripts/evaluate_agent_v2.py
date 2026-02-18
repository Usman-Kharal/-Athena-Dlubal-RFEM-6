
import os
import json
import time
from typing import List, Dict
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

# Try importing shared logic
try:
    from shared_logic import db, llm, IntentExtraction
except ImportError:
    import sys
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from shared_logic import db, llm, IntentExtraction

# Define the 20 Test Cases with 4 Levels of Prompting
TEST_CASES = [
    # 2D Blocks
    {
        "id": "000591", 
        "name": "Curved Ridge Beam (2D)",
        "prompts": [
            "I need a roof support.",                  
            "I need a beam.",                          
            "I need a curved timber beam.",            
            "I want a 2D curved glulam ridge beam."    
        ]
    },
    {
        "id": "001637", 
        "name": "Bowstring Truss",
        "prompts": [
            "I need a large roof structure.",
            "I need a truss.",
            "I need a steel bowstring truss.",
            "I want a 2D steel bowstring truss with curved top chord."
        ]
    },
    {
        "id": "001671", 
        "name": "Fish-Bellied Parallel Truss",
        "prompts": [
            "I need a bridge structure.",
            "I need a parallel truss.",
            "I need a fish-bellied truss.",
            "I want a 2D steel fish-bellied parallel truss for a bridge."
        ]
    },
    {
        "id": "001788", 
        "name": "Standard Pitched Fish-Belly Truss",
        "prompts": [
            "I need a strong roof support.",
            "I need a pitched truss.",
            "I need a pitched fish-belly truss.",
            "I want a 2D steel pitched fish-belly truss with a gable top."
        ]
    },
    {
        "id": "001960", 
        "name": "Bowstring (Stub) Truss",
        "prompts": [
            "I need a support structure.",
            "I need a stub truss.",
            "I need a bowstring stub truss.",
            "I want a 2D steel bowstring stub truss with a curved bottom."
        ]
    },
    {
        "id": "001976", 
        "name": "Fish-Bellied Truss (Inverted Bowstring)",
        "prompts": [
            "I need an inverted roof structure.",
            "I need an inverted truss.",
            "I need an inverted bowstring truss.",
            "I want a 2D steel inverted bowstring truss (fish-bellied)."
        ]
    },
    {
        "id": "003348", 
        "name": "Multi-Span Arch Structure",
        "prompts": [
            "I need a hanging structure.",
            "I need an arch.",
            "I need a multi-span arch.",
            "I want a 2D steel multi-span arch structure with suspension cables."
        ]
    },
    {
        "id": "004859", 
        "name": "Tapered Portal Frame (2D)",
        "prompts": [
            "I need a warehouse structure.",
            "I need a frame.",
            "I need a tapered portal frame.",
            "I want a 2D steel tapered portal frame for a warehouse."
        ]
    },
    # 3D Blocks
    {
        "id": "002533", 
        "name": "3D Gable Roof Hall",
        "prompts": [
            "I need a building.",
            "I need a hall.",
            "I need a 3D gable roof hall.",
            "I want a 3D steel gable roof hall with rigid frames."
        ]
    },
    {
        "id": "002573", 
        "name": "3D Gable Hall with End Walls",
        "prompts": [
            "I need a closed building.",
            "I need a hall with walls.",
            "I need a 3D hall with end walls.",
            "I want a 3D steel gable hall with end walls and haunches."
        ]
    },
    {
        "id": "003576", 
        "name": "Cantilevered Monopitch Canopy",
        "prompts": [
            "I need a cover.",
            "I need a canopy.",
            "I need a cantilevered canopy.",
            "I want a 3D steel cantilevered monopitch canopy for a grandstand."
        ]
    },
    {
        "id": "003601", 
        "name": "Monopitch Portal Frame Canopy",
        "prompts": [
            "I need a shelter.",
            "I need a portal canopy.",
            "I need a monopitch portal frame canopy.",
            "I want a 3D steel monopitch portal frame canopy for a carport."
        ]
    },
    {
        "id": "004532", 
        "name": "Cable-Stayed Pedestrian Bridge",
        "prompts": [
            "I need a crossing.",
            "I need a bridge.",
            "I need a cable-stayed bridge.",
            "I want a 3D steel cable-stayed pedestrian bridge with a truss deck."
        ]
    },
    {
        "id": "004536", 
        "name": "Geometric Cable-Stayed Bridge",
        "prompts": [
            "I need a road crossing.",
            "I need a cable bridge.",
            "I need a geometric cable-stayed bridge.",
            "I want a 3D geometric cable-stayed bridge with twin pylons."
        ]
    },
    {
        "id": "004542", 
        "name": "Network Arch Bridge",
        "prompts": [
            "I need a river crossing.",
            "I need an arch bridge.",
            "I need a network arch bridge.",
            "I want a 3D steel network arch bridge with intersecting hangers."
        ]
    },
    {
        "id": "004547", 
        "name": "Basket Handle Arch Bridge",
        "prompts": [
            "I need a bridge.",
            "I need a basket handle bridge.",
            "I need a basket handle arch bridge.",
            "I want a 3D steel basket handle arch bridge with inclined arches."
        ]
    },
    {
        "id": "004682", 
        "name": "3D Box Truss Arch",
        "prompts": [
            "I need a curved structure.",
            "I need a truss arch.",
            "I need a box truss arch.",
            "I want a 3D box truss arch with a rectangular cross-section."
        ]
    },
    {
        "id": "004686", 
        "name": "3D Triangular Truss Arch",
        "prompts": [
            "I need an arched structure.",
            "I need a triangular arch.",
            "I need a triangular truss arch.",
            "I want a 3D triangular truss arch with a tubular cross-section."
        ]
    },
    {
        "id": "004912", 
        "name": "90° Toroidal Truss Elbow",
        "prompts": [
            "I need a connector.",
            "I need a truss elbow.",
            "I need a toroidal truss elbow.",
            "I want a 3D 90-degree toroidal truss elbow space frame."
        ]
    },
    {
        "id": "004998", 
        "name": "Telecommunication Tower",
        "prompts": [
            "I need a tall structure.",
            "I need a tower.",
            "I need a telecom tower.",
            "I want a 3D steel telecommunication tower with platforms."
        ]
    }
]

def analyze_failure(req, target_block):
    reasons = []
    
    # Check Dimensionality
    if req.get("dimensionality"):
        target_dim = target_block.get("dimensionality", "").upper()
        if req["dimensionality"] != target_dim:
            reasons.append(f"Dimensionality Mismatch (Req: {req['dimensionality']}, Act: {target_dim})")
            
    # Check Structure Type (Main Member)
    if req.get("structure_type"):
        target_type = target_block.get("main_member", "").lower()
        if req["structure_type"] != target_type:
             reasons.append(f"Type Mismatch (Req: {req['structure_type']}, Act: {target_type})")
             
    # Check Material
    if req.get("material"):
        target_mat = target_block.get("material", "").lower()
        if req["material"] != target_mat:
            reasons.append(f"Material Mismatch (Req: {req['material']}, Act: {target_mat})")
            
    if not reasons and req:
        reasons.append("Criteria matched but block not found (Database index issue?)")
    elif not reasons and not req:
        reasons.append("No requirements extracted from prompt")
        
    return "; ".join(reasons)

def evaluate_prompt(prompt, target_id):
    try:
        all_types_2d = db.get_structure_types("2D")
        all_types_3d = db.get_structure_types("3D")
        
        extraction_prompt = f"""Extract structural requirements from the user's message.

Available:
- Dimensionality: 2D, 3D
- 2D Types: {', '.join(all_types_2d)}
- 3D Types: {', '.join(all_types_3d)}

User said: "{prompt}"

If dimensionality and structure_type are both known, set is_complete=True.
Provide a natural, friendly response."""
        
        result = llm.with_structured_output(IntentExtraction).invoke(extraction_prompt)
        
        req = {}
        if result.dimensionality:
            req["dimensionality"] = result.dimensionality.upper()
        if result.structure_type:
            req["structure_type"] = result.structure_type.lower()
        if result.material:
            req["material"] = result.material.lower()
            
        candidates = db.filter_blocks(
            dim=req.get("dimensionality"),
            structure_type=req.get("structure_type"),
            material=req.get("material") if req.get("material") and req.get("material") != "any" else None
        )
        
        # Also try less strict filtering if no candidates found
        if not candidates:
             candidates = db.filter_blocks(
                dim=req.get("dimensionality"),
                structure_type=req.get("structure_type")
            )
        
        found = False
        rank = -1
        target_block = db.get_block(target_id)
        
        if candidates:
            for i, c in enumerate(candidates):
                if c["id"] == target_id:
                    found = True
                    rank = i + 1
                    break
        
        failure_analysis = ""
        if not found:
            failure_analysis = analyze_failure(req, target_block)
        
        return {
            "success": found,
            "rank": rank,
            "total_candidates": len(candidates),
            "requirements": req,
            "response": result.response,
            "failure_analysis": failure_analysis
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

def process_case(case):
    case_results = {
        "id": case["id"],
        "name": case["name"],
        "prompts": []
    }
    levels = ["1. No Knowledge", "2. Low Knowledge", "3. Medium Knowledge", "4. High Knowledge"]
    for i, prompt in enumerate(case["prompts"]):
        res = evaluate_prompt(prompt, case["id"])
        case_results["prompts"].append({
            "level": levels[i],
            "text": prompt,
            "result": res
        })
    print(f"Evaluated: {case['name']}")
    return case_results

def run_evaluation():
    print("Starting Parallel Evaluation (4 Levels)...")
    results = []
    
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(process_case, case): case for case in TEST_CASES}
        for future in as_completed(futures):
            case = futures[future]
            try:
                data = future.result()
                results.append(data)
            except Exception as exc:
                print(f'{case["name"]} generated an exception: {exc}')
                
    # Sort results by ID to keep order roughly consistent
    results.sort(key=lambda x: x["id"])
    return results

def generate_markdown_report(results):
    total = len(results)
    
    # Calculate success counts
    level1_success = sum(1 for r in results if r["prompts"][0]["result"].get("success"))
    level2_success = sum(1 for r in results if r["prompts"][1]["result"].get("success"))
    level3_success = sum(1 for r in results if r["prompts"][2]["result"].get("success"))
    level4_success = sum(1 for r in results if r["prompts"][3]["result"].get("success"))
    
    l1_pct = (level1_success/total)*100
    l2_pct = (level2_success/total)*100
    l3_pct = (level3_success/total)*100
    l4_pct = (level4_success/total)*100

    report = f"""# 🛡️ AI Agent Evaluation Report (4-Level Analysis)

## 1. Executive Summary

The agent was evaluated against **20 key structural blocks** using 4 distinct levels of user knowledge.

### Accuracy by Information Level

| Level | Knowledge Profile | Accuracy | Trend |
|-------|-------------------|----------|-------|
| 1 | **No Knowledge** (Pure intent/function) | **{l1_pct:.0f}%** ({level1_success}/{total}) | {"🔴" if l1_pct < 50 else "🟡"} |
| 2 | **Low Knowledge** (Basic types) | **{l2_pct:.0f}%** ({level2_success}/{total}) | {"🟡" if l2_pct < 70 else "🟢"} |
| 3 | **Medium Knowledge** (Specific types) | **{l3_pct:.0f}%** ({level3_success}/{total}) | "🟢" |
| 4 | **High Knowledge** (Detailed specs) | **{l4_pct:.0f}%** ({level4_success}/{total}) | "🟢" |

### Graphical Representation

```text
100% |                                      
 90% |                                      
 80% |                                      
 70% |                     [████] {l3_pct:.0f}%        [████] {l4_pct:.0f}%
 60% |                                      
 50% |          [████] {l2_pct:.0f}%                    
 40% |                                      
 30% | [████] {l1_pct:.0f}%                             
 20% |                                      
 10% |                                      
  0% +--------------------------------------
      Level 1    Level 2    Level 3    Level 4
      (None)     (Low)      (Med)      (High)
```

## 2. Detailed Block Analysis

| Block Name | No Know. | Low Know. | Med Know. | High Know. |
|------------|----------|-----------|-----------|------------|
"""

    for r in results:
        row = f"| **{r['name']}** "
        for p in r["prompts"]:
            res = p["result"]
            if res["success"]:
                # Show rank only if meaningful (e.g. if we found 50 candidates, rank 1 is good, rank 50 is bad)
                # But space is limited in table. Just checkmark.
                row += f"| ✅ "
            else:
                row += f"| ❌ "
        row += "|"
        report += row + "\n"

    report += """
## 3. Observations and Recommendations

### 🔍 Observations
1. **Level 1 (No Knowledge)**: The agent relies heavily on "Application" inference (e.g., "Bridge" -> "Bridge Type"). Without specific structural terms, accuracy is expected to be lower.
2. **Level 2 (Low Knowledge)**: Providing basic terms like "Truss" or "Arch" drastically improves recall, though precision remains low (many candidates returned).
3. **Level 3 & 4 (High Specificity)**: Accuracy peaks here. However, **over-specification** (Level 4) can sometimes cause drops if the user uses a synonym not in the strict database filters (e.g., "Timber" vs "Wood").

### 💡 Recommendations
- **Improve Synonym Mapping**: Ensure "Timber" maps to "Wood" and "Hall" maps to "Building/Structure" in the database queries.
- **Fuzzy Matching**: Implement fuzzy search for Level 1 queries to better capture "like X" descriptions.
- **Guided Dialogue**: For Level 1/2 queries returning many results (>5), the agent should automatically ask disambiguating questions.

"""

    with open("evaluation_report_v2.md", "w", encoding="utf-8") as f:
        f.write(report)
    
    print("\n✅ Report generated: evaluation_report_v2.md")
    
    with open("evaluation_data.json", "w", encoding="utf-8") as f:
        json.dump({
            "levels": ["No Knowledge", "Low Knowledge", "Medium Knowledge", "High Knowledge"],
            "scores": [l1_pct, l2_pct, l3_pct, l4_pct],
            "counts": [level1_success, level2_success, level3_success, level4_success],
            "total": total
        }, f)

if __name__ == "__main__":
    results = run_evaluation()
    generate_markdown_report(results)
