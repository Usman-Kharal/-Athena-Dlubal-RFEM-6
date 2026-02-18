# 🛡️ AI Agent Evaluation Report (4-Level Analysis)

## 1. Executive Summary

The agent was evaluated against **20 key structural blocks** using 4 distinct levels of user knowledge.

### Accuracy by Information Level

| Level | Knowledge Profile | Accuracy | Trend |
|-------|-------------------|----------|-------|
| 1 | **No Knowledge** (Pure intent/function) | **65%** (13/20) | 🟡 |
| 2 | **Low Knowledge** (Basic types) | **80%** (16/20) | 🟢 |
| 3 | **Medium Knowledge** (Specific types) | **90%** (18/20) | "🟢" |
| 4 | **High Knowledge** (Detailed specs) | **100%** (20/20) | "🟢" |

### Graphical Representation

```text
100% |                                      
 90% |                                      
 80% |                                      
 70% |                     [████] 90%        [████] 100%
 60% |                                      
 50% |          [████] 80%                    
 40% |                                      
 30% | [████] 65%                             
 20% |                                      
 10% |                                      
  0% +--------------------------------------
      Level 1    Level 2    Level 3    Level 4
      (None)     (Low)      (Med)      (High)
```

## 2. Detailed Block Analysis

| Block Name | No Know. | Low Know. | Med Know. | High Know. |
|------------|----------|-----------|-----------|------------|
| **Curved Ridge Beam (2D)** | ❌ | ✅ | ✅ | ✅ |
| **Bowstring Truss** | ✅ | ✅ | ✅ | ✅ |
| **Fish-Bellied Parallel Truss** | ❌ | ❌ | ✅ | ✅ |
| **Standard Pitched Fish-Belly Truss** | ✅ | ✅ | ✅ | ✅ |
| **Bowstring (Stub) Truss** | ❌ | ❌ | ✅ | ✅ |
| **Fish-Bellied Truss (Inverted Bowstring)** | ✅ | ✅ | ✅ | ✅ |
| **3D Gable Roof Hall** | ✅ | ✅ | ❌ | ✅ |
| **3D Gable Hall with End Walls** | ✅ | ✅ | ✅ | ✅ |
| **Multi-Span Arch Structure** | ❌ | ✅ | ✅ | ✅ |
| **Cantilevered Monopitch Canopy** | ✅ | ✅ | ✅ | ✅ |
| **Monopitch Portal Frame Canopy** | ✅ | ✅ | ✅ | ✅ |
| **Cable-Stayed Pedestrian Bridge** | ✅ | ✅ | ✅ | ✅ |
| **Geometric Cable-Stayed Bridge** | ✅ | ✅ | ✅ | ✅ |
| **Network Arch Bridge** | ✅ | ✅ | ✅ | ✅ |
| **Basket Handle Arch Bridge** | ❌ | ✅ | ✅ | ✅ |
| **3D Box Truss Arch** | ❌ | ❌ | ✅ | ✅ |
| **3D Triangular Truss Arch** | ❌ | ❌ | ❌ | ✅ |
| **Tapered Portal Frame (2D)** | ✅ | ✅ | ✅ | ✅ |
| **90° Toroidal Truss Elbow** | ✅ | ✅ | ✅ | ✅ |
| **Telecommunication Tower** | ✅ | ✅ | ✅ | ✅ |

## 3. Observations and Recommendations

### 🔍 Observations
1. **Level 1 (No Knowledge)**: The agent relies heavily on "Application" inference (e.g., "Bridge" -> "Bridge Type"). Without specific structural terms, accuracy is expected to be lower.
2. **Level 2 (Low Knowledge)**: Providing basic terms like "Truss" or "Arch" drastically improves recall, though precision remains low (many candidates returned).
3. **Level 3 & 4 (High Specificity)**: Accuracy peaks here. However, **over-specification** (Level 4) can sometimes cause drops if the user uses a synonym not in the strict database filters (e.g., "Timber" vs "Wood").

### 💡 Recommendations
- **Improve Synonym Mapping**: Ensure "Timber" maps to "Wood" and "Hall" maps to "Building/Structure" in the database queries.
- **Fuzzy Matching**: Implement fuzzy search for Level 1 queries to better capture "like X" descriptions.
- **Guided Dialogue**: For Level 1/2 queries returning many results (>5), the agent should automatically ask disambiguating questions.

