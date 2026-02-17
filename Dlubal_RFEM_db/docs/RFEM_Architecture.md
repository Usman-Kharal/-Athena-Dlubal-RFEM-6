# RFEM AI Agent - Architecture Documentation

## 1. High-Level System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        Browser[Web Browser]
        UI[React-like Frontend<br/>index.html + JavaScript]
    end
    
    subgraph "Application Layer"
        Flask[Flask Web Server<br/>app.py]
        SessionMgr[Session Manager<br/>In-Memory Dict]
        
        subgraph "Core Logic - shared_logic.py"
            LLM[LangChain LLM<br/>GPT-4o]
            DB[Block Database<br/>JSON Reader]
            JSMan[JS Manipulator<br/>AST Parser]
        end
    end
    
    subgraph "AI Services"
        OpenAI[OpenAI API<br/>gpt-4o]
    end
    
    subgraph "Data Layer"
        DB2D[(2D Blocks DB<br/>2D_DB.json)]
        DB3D[(3D Blocks DB<br/>3D_DB.json)]
        JSTemplates[JS Templates<br/>*.JS files]
    end
    
    subgraph "Output Layer"
        OutputFiles[Generated Files<br/>*_generated.JS]
        RFEM[RFEM Software<br/>External CAD Tool]
    end
    
    Browser --> UI
    UI -->|HTTP POST /api/chat| Flask
    UI -->|HTTP GET /api/blocks| Flask
    
    Flask --> SessionMgr
    Flask --> LLM
    Flask --> DB
    Flask --> JSMan
    
    LLM -->|API Calls| OpenAI
    DB --> DB2D
    DB --> DB3D
    JSMan --> JSTemplates
    
    Flask -->|Write Generated Code| OutputFiles
    OutputFiles -.->|Manual Import| RFEM
    
    style OpenAI fill:#f9f,stroke:#333,stroke-width:2px
    style Flask fill:#ff9,stroke:#333,stroke-width:2px
    style LLM fill:#9ff,stroke:#333,stroke-width:2px
```

## 2. Conversation Flow State Machine

```mermaid
stateDiagram-v2
    [*] --> Understanding
    
    Understanding --> Understanding: Extract requirements<br/>(dimensionality, type, material)
    Understanding --> Selecting: Requirements complete
    
    Selecting --> Selecting: User asks for descriptions
    Selecting --> Understanding: User says "back"
    Selecting --> Collecting: Block selected
    
    Collecting --> Collecting: Collect each parameter<br/>(with help support)
    Collecting --> Understanding: User says "stop"
    Collecting --> Generating: All parameters collected
    
    Generating --> Understanding: Code generated,<br/>reset session
    
    Understanding --> [*]: User says "restart"
    
    note right of Understanding
        Phase: "understanding"
        State: requirements{}
        LLM: IntentExtraction
    end note
    
    note right of Selecting
        Phase: "selecting"
        State: block_candidates[]
        LLM: BlockSelectionIntent
    end note
    
    note right of Collecting
        Phase: "collecting"
        State: collected_params{}
        LLM: ParameterValueResponse
    end note
    
    note right of Generating
        Phase: "generating"
        Action: JS code injection
        Output: *.JS file
    end note
```

## 3. Data Flow Architecture

```mermaid
flowchart TD
    A[User Input:<br/>'I need a 2D steel truss'] --> B{Phase?}
    
    B -->|understanding| C[Intent Extraction]
    C --> D[LLM Call:<br/>IntentExtraction model]
    D --> E{Complete<br/>Requirements?}
    E -->|No| F[Ask for missing info]
    F --> A
    E -->|Yes| G[Query Database:<br/>filter_blocks]
    G --> H[Return Block Candidates]
    H --> I[Display Block Cards]
    
    I --> J[User Selects Block #2]
    
    B -->|selecting| K{User Intent?}
    K -->|describe| L[LLM: BlockExplanation]
    L --> M[Return Educational Text]
    K -->|select| N[Load Block Schema]
    N --> O[Extract Parameters from JS]
    O --> P[Smart Parameter Extraction]
    P --> Q{Found in<br/>history?}
    Q -->|Yes| R[Pre-fill parameters]
    Q -->|No| S[Ask for first parameter]
    
    B -->|collecting| T[Parameter Value Input]
    T --> U[LLM: ParameterValueResponse]
    U --> V{Intent?}
    V -->|provide_value| W[Store parameter]
    V -->|use_default| X[Use default value]
    V -->|ask_help| Y[LLM: ParameterExplanation]
    Y --> T
    W --> Z{More<br/>params?}
    X --> Z
    Z -->|Yes| S
    Z -->|No| AA[Move to Generating]
    
    B -->|generating| AB[Load JS Template]
    AB --> AC[JSManipulator:<br/>Parse AST]
    AC --> AD[Find parameter_* calls]
    AD --> AE[Inject user values]
    AE --> AF[Write to disk:<br/>*_generated.JS]
    AF --> AG[Return file path]
    AG --> AH[Reset to Understanding]
    
    style D fill:#e1f5ff
    style L fill:#e1f5ff
    style U fill:#e1f5ff
    style Y fill:#e1f5ff
    style AC fill:#ffe1e1
```

## 4. Component Architecture (Detailed)

```mermaid
graph TB
    subgraph "Frontend - index.html"
        ChatUI[Chat Interface]
        MessageList[Message List]
        InputBox[Input Box + Send Button]
        ParamWidget[Parameter Input Widget]
        BlockCards[Block Selection Cards]
        QuickStart[Quick Start Buttons]
        
        ChatUI --> MessageList
        ChatUI --> InputBox
        ChatUI --> ParamWidget
        ChatUI --> BlockCards
        ChatUI --> QuickStart
    end
    
    subgraph "Backend - app.py"
        RestAPI[REST API Routes]
        SessionMgr[Session Manager]
        
        subgraph "Route Handlers"
            ChatEndpoint[POST /api/chat]
            BlocksEndpoint[GET /api/blocks]
            RFEMEndpoint[POST /api/run_rfem]
        end
        
        RestAPI --> ChatEndpoint
        RestAPI --> BlocksEndpoint
        RestAPI --> RFEMEndpoint
        
        ChatEndpoint --> SessionMgr
    end
    
    subgraph "Shared Logic - shared_logic.py"
        subgraph "AI Models (Pydantic)"
            IntentExt[IntentExtraction]
            BlockSel[BlockSelectionIntent]
            ParamExt[SmartParameterExtraction]
            ParamVal[ParameterValueResponse]
            BlockExp[BlockExplanation]
            ParamExp[ParameterExplanation]
        end
        
        subgraph "Data Access"
            BlockDB[BlockDatabase Class]
            DBFilter[filter_blocks]
            DBSchema[get_param_schema]
        end
        
        subgraph "Code Generation"
            JSManip[JSManipulator Class]
            ASTParser[esprima Parser]
            ParamFinder[find_parameter_calls]
            ParamInject[inject_parameters]
        end
        
        LLMClient[ChatOpenAI Client<br/>gpt-4o]
    end
    
    subgraph "External Services"
        OpenAIAPI[OpenAI API]
    end
    
    subgraph "Data Storage"
        JSON2D[(2D_DB.json)]
        JSON3D[(3D_DB.json)]
        JSFiles[(*.JS Templates)]
        Generated[(Generated Files)]
    end
    
    InputBox -->|sendMessage| ChatEndpoint
    ChatEndpoint -->|get_session| SessionMgr
    ChatEndpoint -->|LLM calls| LLMClient
    LLMClient -->|API request| OpenAIAPI
    
    ChatEndpoint -->|Query blocks| BlockDB
    BlockDB --> JSON2D
    BlockDB --> JSON3D
    
    ChatEndpoint -->|Load template| JSFiles
    ChatEndpoint -->|Generate code| JSManip
    JSManip --> ASTParser
    JSManip --> ParamInject
    JSManip -->|Write file| Generated
    
    style LLMClient fill:#e1f5ff
    style OpenAIAPI fill:#f9f,stroke:#333,stroke-width:2px
    style SessionMgr fill:#ffe1e1
```

## 5. Session State Structure

```mermaid
classDiagram
    class Session {
        +string session_id
        +string phase
        +dict requirements
        +list block_candidates
        +dict selected_block
        +string selected_block_id
        +string js_template
        +dict collected_params
        +list param_keys
        +int current_param_idx
        +list history
    }
    
    class Requirements {
        +string dimensionality
        +string structure_type
        +string material
        +string application
    }
    
    class BlockCandidate {
        +string id
        +string name
        +string dimensionality
        +string main_member
        +string material
        +dict metadata
    }
    
    class SelectedBlock {
        +string id
        +string name
        +dict metadata
        +dict inputs
    }
    
    class Parameter {
        +string key
        +string label
        +string type
        +any default
        +string unit
    }
    
    class HistoryMessage {
        +string role
        +string content
    }
    
    Session "1" --> "1" Requirements : has
    Session "1" --> "*" BlockCandidate : considers
    Session "1" --> "0..1" SelectedBlock : selected
    Session "1" --> "*" Parameter : collecting
    Session "1" --> "*" HistoryMessage : maintains
```

## 6. LLM Integration Architecture

```mermaid
sequenceDiagram
    participant User
    participant Flask
    participant SessionMgr
    participant LLM as LangChain LLM
    participant OpenAI as OpenAI API
    participant DB as BlockDatabase
    
    User->>Flask: "I need a 2D steel truss"
    Flask->>SessionMgr: get_session(session_id)
    SessionMgr-->>Flask: session state
    
    Note over Flask: Phase = "understanding"
    
    Flask->>DB: get_structure_types("2D")
    DB-->>Flask: [truss, frame, beam, arch]
    
    Flask->>LLM: invoke(IntentExtraction prompt)
    Note over Flask,LLM: Prompt includes:<br/>- History (last 6 turns)<br/>- User message<br/>- Available types<br/>- Current state
    
    LLM->>OpenAI: API call with structured output
    OpenAI-->>LLM: JSON response
    LLM-->>Flask: IntentExtraction object
    
    Note over Flask: Extract: dim=2D, type=truss, material=steel
    
    Flask->>DB: filter_blocks(2D, truss, steel)
    DB-->>Flask: [Bowstring Truss, Fish-Belly Truss, ...]
    
    Flask->>SessionMgr: Update state (phase="selecting")
    Flask-->>User: Display block candidates
    
    User->>Flask: "What's a bowstring truss?"
    Flask->>LLM: invoke(BlockExplanation prompt)
    LLM->>OpenAI: API call
    OpenAI-->>LLM: Educational explanation
    LLM-->>Flask: BlockExplanation object
    Flask-->>User: Display explanation
    
    User->>Flask: "1" (select first block)
    Flask->>DB: get_block("001637")
    DB-->>Flask: Block details
    
    Flask->>DB: get_param_schema("001637")
    Note over DB: Parses *.JS file<br/>using esprima
    DB-->>Flask: {n, H, L, L_1, L_2}
    
    Flask->>LLM: invoke(SmartParameterExtraction)
    Note over LLM: Check if user already<br/>mentioned values
    LLM-->>Flask: {} (no values found)
    
    Flask->>SessionMgr: Update state (phase="collecting")
    Flask->>LLM: Generate question for param "n"
    LLM-->>Flask: "How many bays does your truss need?"
    Flask-->>User: Display question + input widget
    
    User->>Flask: "8"
    Flask->>LLM: invoke(ParameterValueResponse)
    Note over LLM: Interpret: "8"<br/>Intent: provide_value<br/>Value: 8
    LLM-->>Flask: ParameterValueResponse(intent=provide_value, number=8)
    Flask->>SessionMgr: Store collected_params["n"] = 8
    
    Note over Flask: Repeat for remaining parameters...
    
    Flask->>SessionMgr: Update state (phase="generating")
    Flask->>DB: Load JS template
    DB-->>Flask: Raw JS code
    
    Flask->>JSManipulator: inject_parameters(collected_params)
    Note over JSManipulator: 1. Parse AST with esprima<br/>2. Find parameter_* calls<br/>3. Replace default values<br/>4. Return modified code
    JSManipulator-->>Flask: Generated JS code
    
    Flask->>Flask: Write to disk: 001637_generated.JS
    Flask-->>User: Success + file path
    Flask->>SessionMgr: Reset state (phase="understanding")
```

## 7. Database Schema Architecture

```mermaid
erDiagram
    BLOCK_LIBRARY ||--o{ BLOCK : contains
    BLOCK ||--|| METADATA : has
    BLOCK ||--|| INPUTS : has
    INPUTS ||--o{ PARAMETER_GROUP : contains
    PARAMETER_GROUP ||--o{ PARAMETER : contains
    BLOCK ||--o{ SELECTION_MODE : has
    INPUTS ||--o{ DYNAMIC_ARRAY : has
    
    BLOCK_LIBRARY {
        string library "2D or 3D"
        string version
    }
    
    BLOCK {
        string id PK "e.g. 001637"
        string name
        string dimensionality "2D/3D"
        string main_member "truss/frame/arch"
        string material "steel/wood/concrete"
    }
    
    METADATA {
        string description
        list tags
        dict classification
        dict visual_aids
    }
    
    INPUTS {
        dict topology
        dict geometry
        dict options
        list selection_modes
        list dynamic_arrays
    }
    
    PARAMETER {
        string key PK
        string label
        string type "float/int/boolean"
        any default
        string unit
        dict constraints
        string dependency
    }
    
    SELECTION_MODE {
        string parameter_name
        string label
        dict options
    }
    
    DYNAMIC_ARRAY {
        string driver_variable
        string template_name
        string label_template
        any default
    }
```

## 8. Code Generation Pipeline

```mermaid
flowchart LR
    A[JS Template File<br/>001637.JS] --> B[Read File Content]
    B --> C[esprima.parseScript]
    C --> D[Abstract Syntax Tree]
    
    D --> E[Traverse AST]
    E --> F{Find CallExpression}
    F -->|parameter_float| G[Extract param info]
    F -->|parameter_int| G
    F -->|parameter_check| G
    F -->|combobox| G
    F -->|other| E
    
    G --> H[Store: name, range, args, default]
    H --> E
    
    E --> I[All Calls Found]
    
    J[User Parameters<br/>n=8, L=12, H=3] --> K[Match param names]
    
    I --> L[Sort calls by range<br/>in reverse order]
    K --> L
    
    L --> M[For each matched param]
    M --> N[Find default value node<br/>in AST]
    N --> O[Get node.range start/end]
    O --> P[Create edit:<br/>range -> new_value]
    P --> M
    
    M --> Q[Apply all edits<br/>from end to start]
    Q --> R[Modified JS String]
    R --> S[Write to:<br/>001637_generated.JS]
    
    style C fill:#ffe1e1
    style D fill:#e1ffe1
    style Q fill:#e1f5ff
```

## 9. Request/Response Flow

```mermaid
sequenceDiagram
    participant Browser
    participant Flask
    participant Session
    participant LLM
    participant DB
    participant FileSystem
    
    Browser->>Flask: POST /api/chat
    Note over Browser,Flask: {session_id, message}
    
    Flask->>Session: get_session(session_id)
    alt Session not found
        Session->>Session: Create new session
    end
    Session-->>Flask: session state
    
    Flask->>Flask: Prune history to last 6 turns
    
    alt message == "restart"
        Flask->>Session: Reset session
        Flask-->>Browser: Empty response
    else Phase: understanding
        Flask->>DB: get_structure_types()
        Flask->>LLM: IntentExtraction
        LLM-->>Flask: {dim, type, material, response}
        Flask->>Session: Update requirements
        
        alt Requirements complete
            Flask->>DB: filter_blocks(requirements)
            DB-->>Flask: candidates[]
            Flask->>Session: Set phase="selecting"
            Flask-->>Browser: {messages, html: block_cards}
        else Requirements incomplete
            Flask-->>Browser: {messages: [ask_more_info]}
        end
        
    else Phase: selecting
        Flask->>LLM: BlockSelectionIntent
        
        alt Intent: describe
            Flask->>LLM: BlockExplanation
            LLM-->>Flask: explanation text
            Flask-->>Browser: {messages: [explanation]}
        else Intent: select
            Flask->>DB: get_block(block_id)
            Flask->>DB: get_param_schema(block_id)
            Flask->>FileSystem: Read *.JS template
            Flask->>LLM: SmartParameterExtraction
            
            alt Parameters extracted
                Flask->>Session: Pre-fill collected_params
            end
            
            Flask->>Session: Set phase="collecting"
            Flask->>LLM: Generate first param question
            Flask-->>Browser: {messages, ui_elements: param_widget}
        end
        
    else Phase: collecting
        alt User asks for help
            Flask->>LLM: ParameterExplanation
            LLM-->>Flask: help text
            Flask-->>Browser: {messages, ui_elements: same_widget}
        else User provides value
            Flask->>LLM: ParameterValueResponse
            LLM-->>Flask: {intent, value}
            Flask->>Session: Store parameter
            
            alt More parameters needed
                Flask->>LLM: Generate next param question
                Flask-->>Browser: {messages, ui_elements: next_widget}
            else All parameters collected
                Flask->>Session: Set phase="generating"
                Flask-->>Browser: {messages: ["Generating..."]}
            end
        end
        
    else Phase: generating
        Flask->>FileSystem: Read JS template
        Flask->>Flask: JSManipulator.inject_parameters()
        Flask->>FileSystem: Write *_generated.JS
        Flask->>Session: Reset to "understanding"
        Flask-->>Browser: {messages: [success, file_path, reset]}
    end
    
    Browser->>Browser: Render messages
    Browser->>Browser: Display UI elements
```

## 10. Deployment Architecture (Current vs Recommended)

```mermaid
graph TB
    subgraph "Current Architecture - Single Server"
        Client1[Browser Client]
        Client2[Browser Client]
        
        Server[Flask Server<br/>Port 5000]
        Memory[(In-Memory<br/>Sessions Dict)]
        Files[(Local File System)]
        
        Client1 --> Server
        Client2 --> Server
        Server --> Memory
        Server --> Files
        Server -.->|API Calls| OpenAI1[OpenAI API]
    end
    
    subgraph "Recommended Production Architecture"
        LB[Load Balancer<br/>nginx]
        
        subgraph "Application Tier"
            App1[Flask Server 1]
            App2[Flask Server 2]
            App3[Flask Server 3]
        end
        
        subgraph "Session Tier"
            Redis[(Redis<br/>Session Store)]
        end
        
        subgraph "Storage Tier"
            S3[(S3 / Object Storage<br/>Generated Files)]
            BlockDB[(Block Database<br/>PostgreSQL)]
        end
        
        subgraph "Monitoring"
            Prometheus[Prometheus]
            Grafana[Grafana Dashboard]
        end
        
        Clients[Multiple Clients] --> LB
        LB --> App1
        LB --> App2
        LB --> App3
        
        App1 --> Redis
        App2 --> Redis
        App3 --> Redis
        
        App1 --> S3
        App2 --> S3
        App3 --> S3
        
        App1 --> BlockDB
        App2 --> BlockDB
        App3 --> BlockDB
        
        App1 -.->|API Calls| OpenAI2[OpenAI API]
        App2 -.->|API Calls| OpenAI2
        App3 -.->|API Calls| OpenAI2
        
        App1 --> Prometheus
        App2 --> Prometheus
        App3 --> Prometheus
        Prometheus --> Grafana
    end
    
    style Memory fill:#ff9999
    style Files fill:#ff9999
    style Redis fill:#99ff99
    style S3 fill:#99ff99
```

## 11. Security Architecture (Issues & Fixes)

```mermaid
graph TD
    subgraph "Current Vulnerabilities"
        V1[Path Traversal<br/>in file writing]
        V2[XSS in Frontend<br/>innerHTML injection]
        V3[No CSRF Protection]
        V4[No Rate Limiting]
        V5[Broad CORS Policy]
        V6[No Input Validation]
    end
    
    subgraph "Recommended Security Layer"
        subgraph "Input Validation"
            IV1[Schema Validation<br/>Marshmallow]
            IV2[Path Sanitization<br/>os.path.normpath]
            IV3[Message Length Limits]
        end
        
        subgraph "Authentication & Authorization"
            Auth[JWT Tokens]
            RBAC[Role-Based Access]
        end
        
        subgraph "Rate Limiting"
            RL1[Flask-Limiter<br/>10 req/min]
            RL2[Redis-based Counter]
        end
        
        subgraph "Output Sanitization"
            OS1[DOMPurify.js<br/>Client-side]
            OS2[Bleach<br/>Server-side]
        end
        
        subgraph "Network Security"
            NS1[HTTPS Only]
            NS2[CORS Whitelist]
            NS3[CSRF Tokens]
        end
        
        subgraph "Monitoring"
            M1[Security Logs]
            M2[Intrusion Detection]
            M3[Audit Trail]
        end
    end
    
    Request[Incoming Request] --> IV1
    IV1 --> IV2
    IV2 --> IV3
    IV3 --> Auth
    Auth --> RL1
    RL1 --> Process[Process Request]
    Process --> OS1
    OS1 --> Response[Send Response]
    
    RL1 --> RL2
    Auth --> RBAC
    Response --> M1
    Process --> M3
    
    style V1 fill:#ff9999
    style V2 fill:#ff9999
    style V3 fill:#ff9999
    style V4 fill:#ff9999
```

---

## Architecture Summary Table

| Component | Technology | Purpose | Status |
|-----------|-----------|---------|--------|
| **Frontend** | HTML/JS/CSS | User Interface | ✅ Complete |
| **Web Framework** | Flask | HTTP Server | ✅ Working |
| **Session Management** | In-Memory Dict | State Persistence | ⚠️ Needs Redis |
| **LLM Client** | LangChain | AI Integration | ✅ Working |
| **LLM Provider** | OpenAI GPT-4o | Natural Language Processing | ✅ Working |
| **Database** | JSON Files | Block Storage | ⚠️ Consider PostgreSQL |
| **Code Generator** | esprima + Custom | JS Manipulation | ✅ Working |
| **File Storage** | Local Filesystem | Generated Files | ⚠️ Consider S3 |
| **Logging** | None | Debugging | ❌ Missing |
| **Monitoring** | None | System Health | ❌ Missing |
| **Testing** | None | Quality Assurance | ❌ Missing |
| **Security** | Basic | Protection | ❌ Inadequate |

---

## Key Architectural Decisions

### 1. **Stateful Session Management**
- **Decision:** Use in-memory dictionary keyed by session_id
- **Rationale:** Simple for prototype, fast access
- **Trade-off:** Doesn't scale, loses data on restart
- **Recommendation:** Migrate to Redis

### 2. **Phase-Based State Machine**
- **Decision:** Four distinct phases (understanding → selecting → collecting → generating)
- **Rationale:** Clear conversation flow, easy to reason about
- **Trade-off:** Rigid, hard to support non-linear conversations
- **Status:** ✅ Good choice for current use case

### 3. **LLM-Powered Intent Classification**
- **Decision:** Use structured outputs for every user input interpretation
- **Rationale:** Flexible, handles natural language variations
- **Trade-off:** Slower, costs per request, needs error handling
- **Status:** ✅ Innovative and effective

### 4. **JSON-Based Block Database**
- **Decision:** Store blocks in static JSON files
- **Rationale:** Easy to version control, human-readable
- **Trade-off:** No ACID guarantees, no complex queries
- **Recommendation:** Fine for read-only data, consider PostgreSQL for user data

### 5. **AST-Based Code Generation**
- **Decision:** Parse JS with esprima, modify AST nodes
- **Rationale:** Robust, syntax-aware manipulation
- **Trade-off:** Complex, language-specific
- **Status:** ✅ Solid approach

---

## Scaling Considerations

### Current Bottlenecks:
1. **LLM API calls** (1-3 seconds each) - Critical path
2. **In-memory sessions** - Single point of failure
3. **No caching** - Repeated queries waste resources
4. **Synchronous processing** - Blocks other requests

### Scaling Strategy:
```
Phase 1 (1-100 users):
- Add Redis for sessions
- Implement LRU cache for blocks
- Add basic monitoring

Phase 2 (100-1000 users):
- Deploy multiple Flask instances
- Add load balancer
- Implement async LLM calls
- Cache LLM responses for common queries

Phase 3 (1000+ users):
- Microservices architecture
- Dedicated LLM service
- CDN for static assets
- Database for analytics
```