# 🛡️ AI Agent Evaluation Report

## 1. Executive Summary & Accuracy Graph

The agent was evaluated against 20 key structural blocks using increasing levels of information (Low -> High).

**Accuracy by Information Level:**

```text
       0%  20%  40%  60%  80%  100%
Low    [███████████████░░░░░] 80% (16/20)
Medium [████████████████░░░░] 85% (17/20)
High   [█████████████████░░░] 90% (18/20)
```

## 2. Detailed Block Analysis

| Block Name | Low Info | Medium Info | High Info |
|------------|----------|-------------|-----------|
| **Curved Ridge Beam (2D)** | ✅ Pass <br> <sub>Rank: 1/1</sub> | ❌ Fail <br> <sub>Material Mismatch (Req: timber, Act: wood)</sub> | ❌ Fail <br> <sub>Material Mismatch (Req: glulam, Act: wood)</sub> |
| **Bowstring Truss** | ✅ Pass <br> <sub>Rank: 1/8</sub> | ✅ Pass <br> <sub>Rank: 1/5</sub> | ✅ Pass <br> <sub>Rank: 1/5</sub> |
| **Fish-Bellied Parallel Truss** | ❌ Fail <br> <sub>Dimensionality Mismatch (Req: 3D, Act: 2D)</sub> | ✅ Pass <br> <sub>Rank: 2/5</sub> | ✅ Pass <br> <sub>Rank: 2/5</sub> |
| **Standard Pitched Fish-Belly Truss** | ✅ Pass <br> <sub>Rank: 3/5</sub> | ✅ Pass <br> <sub>Rank: 3/5</sub> | ✅ Pass <br> <sub>Rank: 3/5</sub> |
| **Bowstring (Stub) Truss** | ❌ Fail <br> <sub>Dimensionality Mismatch (Req: 3D, Act: 2D)</sub> | ✅ Pass <br> <sub>Rank: 4/5</sub> | ✅ Pass <br> <sub>Rank: 4/5</sub> |
| **Fish-Bellied Truss (Inverted Bowstring)** | ✅ Pass <br> <sub>Rank: 5/8</sub> | ✅ Pass <br> <sub>Rank: 5/5</sub> | ✅ Pass <br> <sub>Rank: 5/5</sub> |
| **Multi-Span Arch Structure** | ✅ Pass <br> <sub>Rank: 1/3</sub> | ✅ Pass <br> <sub>Rank: 1/1</sub> | ✅ Pass <br> <sub>Rank: 1/1</sub> |
| **Tapered Portal Frame (2D)** | ✅ Pass <br> <sub>Rank: 1/5</sub> | ✅ Pass <br> <sub>Rank: 1/1</sub> | ✅ Pass <br> <sub>Rank: 1/1</sub> |
| **3D Gable Roof Hall** | ✅ Pass <br> <sub>Rank: 9/20</sub> | ❌ Fail <br> <sub>Type Mismatch (Req: roof, Act: frame)</sub> | ✅ Pass <br> <sub>Rank: 1/4</sub> |
| **3D Gable Hall with End Walls** | ✅ Pass <br> <sub>Rank: 2/4</sub> | ✅ Pass <br> <sub>Rank: 2/4</sub> | ✅ Pass <br> <sub>Rank: 2/4</sub> |
| **Cantilevered Monopitch Canopy** | ✅ Pass <br> <sub>Rank: 11/20</sub> | ✅ Pass <br> <sub>Rank: 11/20</sub> | ✅ Pass <br> <sub>Rank: 3/4</sub> |
| **Monopitch Portal Frame Canopy** | ✅ Pass <br> <sub>Rank: 12/20</sub> | ✅ Pass <br> <sub>Rank: 4/4</sub> | ✅ Pass <br> <sub>Rank: 4/4</sub> |
| **Cable-Stayed Pedestrian Bridge** | ✅ Pass <br> <sub>Rank: 13/20</sub> | ✅ Pass <br> <sub>Rank: 1/2</sub> | ✅ Pass <br> <sub>Rank: 1/1</sub> |
| **Geometric Cable-Stayed Bridge** | ✅ Pass <br> <sub>Rank: 2/2</sub> | ✅ Pass <br> <sub>Rank: 2/2</sub> | ✅ Pass <br> <sub>Rank: 2/2</sub> |
| **Network Arch Bridge** | ✅ Pass <br> <sub>Rank: 1/2</sub> | ✅ Pass <br> <sub>Rank: 1/2</sub> | ✅ Pass <br> <sub>Rank: 1/2</sub> |
| **Basket Handle Arch Bridge** | ✅ Pass <br> <sub>Rank: 2/2</sub> | ✅ Pass <br> <sub>Rank: 2/2</sub> | ✅ Pass <br> <sub>Rank: 2/2</sub> |
| **3D Box Truss Arch** | ❌ Fail <br> <sub>Dimensionality Mismatch (Req: 2D, Act: 3D); Type Mismatch (Req: truss arch, Act: truss)</sub> | ✅ Pass <br> <sub>Rank: 1/3</sub> | ✅ Pass <br> <sub>Rank: 1/3</sub> |
| **3D Triangular Truss Arch** | ❌ Fail <br> <sub>Dimensionality Mismatch (Req: 2D, Act: 3D); Type Mismatch (Req: arch, Act: truss)</sub> | ❌ Fail <br> <sub>Dimensionality Mismatch (Req: 2D, Act: 3D); Type Mismatch (Req: truss arch, Act: truss)</sub> | ❌ Fail <br> <sub>Type Mismatch (Req: truss arch, Act: truss)</sub> |
| **90° Toroidal Truss Elbow** | ✅ Pass <br> <sub>Rank: 8/8</sub> | ✅ Pass <br> <sub>Rank: 3/3</sub> | ✅ Pass <br> <sub>Rank: 3/3</sub> |
| **Telecommunication Tower** | ✅ Pass <br> <sub>Rank: 1/1</sub> | ✅ Pass <br> <sub>Rank: 1/1</sub> | ✅ Pass <br> <sub>Rank: 1/1</sub> |

## 3. Failure Analysis & Remarks

### Common Failure Modes
1.  **Strict Material Mismatch**: When prompts specify a material (e.g., "Timber") but the database uses a synonym (e.g., "Wood"), the strict filter excludes the correct block. This is the most common cause of failure in High Information prompts.
2.  **Taxonomy Ambiguity**: In Low Information prompts, generic terms like "Truss" may not map to specific sub-types (like "Truss Arch") if the taxonomy doesn't support parent-child relationships implicitly, causing the target to be filtered out or buried.
3.  **Dimensionality Confusion**: Use of terms like "Bridge" might infer 3D contexts, but if the block is 2D (or vice versa) and the user didn't specify, it might get filtered out depending on default assumptions.

### Final Remarks
The agent demonstrates **strong progressive elaboration**, improving accuracy significantly as more information is provided. It effectively parses complex queries in High Information scenarios, but requires a more flexible or "fuzzy" matching logic for Materials and Structure Types to handle synonyms and loose classifications better.
