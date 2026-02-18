# Athena RFEM Agent - Architecture Documentation

This document outlines the architecture of the Athena RFEM Agent, a system designed to generate structural engineering blocks for Dlubal RFEM 6 using natural language interactions.

## 1. System Architecture

The system follows a client-server architecture with separation between the web frontend, backend logic, and persistent storage.

```mermaid
graph TD
    %% Nodes
    Client["Web Client<br/>(Browser / HTML / JS)"]
    WebServer["Web Server<br/>(Flask / web_server.py)"]
    CoreLogic["Core Logic Layer<br/>(shared_logic.py)"]
    DB["Block Database<br/>(Class Instance)"]
    JSONStore[("JSON Files<br/>(Data Persistance)")]
    LLM["LLM Provider<br/>(OpenAI API)"]
    FileSystem["File System<br/>(Scripts / Templates)"]

    %% Relationships
    Client <-->|HTTP / WebSocket / JSON| WebServer
    WebServer <-->|"Import & Call"| CoreLogic
    
    CoreLogic -->|"Initialize & Query"| DB
    DB -->|"Read on Startup"| JSONStore
    
    CoreLogic <-->|"API Calls (HTTPS)"| LLM
    CoreLogic <-->|"Read/Write"| FileSystem
    
    %% Styles
    classDef external fill:#f9f,stroke:#333,stroke-width:2px;
    classDef app fill:#bbf,stroke:#333,stroke-width:2px;
    classDef db fill:#bfb,stroke:#333,stroke-width:2px;
    
    class LLM external;
    class WebServer,CoreLogic app;
    class DB,JSONStore,FileSystem db;
```

## 2. Data Flow Architecture

This diagram illustrates the lifecycle of a user request, highlighting the phase-based orchestration.

```mermaid
    graph TD
    %% User Interaction
    User((User))
    UI[Web Interface]
    
    %% Backend Components
    Endpoint["/api/chat Endpoint"]
    Orchestrator["Session/Phase Manager"]
    IntentEngine["Intent Extraction"]
    DBEngine["Database Search"]
    ParamEngine["Parameter Engine"]
    GenEngine["Code Generator"]
    
    %% Flow
    User -->|Type Message| UI
    UI -->|POST Request| Endpoint
    Endpoint --> Orchestrator
    
    %% Logic Branches
    Orchestrator -->|"Phase: Understanding"| IntentEngine
    IntentEngine -->|Query| LLM["LLM Service"]
    LLM -->|"Structured Intent"| IntentEngine
    IntentEngine --> DBEngine
    DBEngine -->|"Return Candidates"| Orchestrator
    
    Orchestrator -->|"Phase: Selecting"| ParamEngine
    ParamEngine -->|"Extract Values"| LLM
    
    Orchestrator -->|"Phase: Generating"| GenEngine
    GenEngine -->|"Inject Params"| Script["Generated .JS File"]
    
    %% Output
    Script -->|"Display Link"| UI
    UI -->|"Download Script"| User
    User -->|"Manual Import"| RFEM["Dlubal RFEM 6"]
```

## 3. Parameter Collection & Error Handling

The "Smart Parameter Collection" loop includes validation and fallback strategies for robust user interaction.

```mermaid
flowchart TD
    Start([Start Collection Phase]) --> SelectParam[Select Next Parameter]
    
    SelectParam --> GenQ["Generate Natural Question<br/>(LLM)"]
    GenQ --> UserOutput[/Display Question/]
    
    UserOutput --> UserInput[/User Types Answer/]
    UserInput --> Interpret["Smart Interpreter<br/>(LLM)"]
    
    %% Error Handling Path
    Interpret -.->|API Error/Timeout| Fallback["Use Default Extraction"]
    Fallback --> Validate
    
    %% Interpretation Outcomes
    Interpret -->|"Intent: Ask Help"| Explain["Generate Explanation<br/>(LLM)"]
    Explain --> UserOutput
    
    Interpret -->|"Intent: Use Default"| AssignDefault[Assign Default Value]
    
    Interpret -->|"Intent: Provide Value"| ExtractVal[Extract Value]
    ExtractVal --> Validate{Validate Type}
    
    %% Validation
    Validate -- Invalid --> ErrorMsg[Generate Error Msg]
    ErrorMsg --> UserOutput
    
    Validate -- Valid --> Store[Store Parameter]
    AssignDefault --> Store
    
    %% Loop Check
    Store --> Check{More Parameters?}
    Check -- Yes --> SelectParam
    Check -- No --> Generate[Trigger Code Generation]
    
    style Interpret fill:#f96,stroke:#333,stroke-width:2px
    style Fallback fill:#faa,stroke:#333,stroke-dasharray: 5 5
```

## 4. Component Architecture

Breakdown of code organization, standardizing module names.

```mermaid
graph TD
    subgraph "Frontend Layer"
        HTML["templates/index.html"]
        CSS["static/style.css"]
        ClientJS["Inline JavaScript"]
    end
    
    subgraph "Application Layer"
        Server["web_server.py"]
        
        subgraph "Session Management"
            State["Session Dictionary<br/>(In-Memory)"]
            Phase["Phase Logic"]
        end
    end
    
    subgraph "Core Logic Layer (shared_logic.py)"
        BaseModel["Pydantic Models"]
        Manipulator["JSManipulator Class"]
        Database["BlockDatabase Class"]
        
        LLM_Client["LangChain ChatOpenAI"]
    end
    
    subgraph "Data Layer"
        DB_2D["2D_DB.json"]
        DB_3D["3D_DB.json"]
        Script_Templates["*.JS Files"]
    end

    %% Connections
    Server --> HTML
    Server --> State
    Server --> Database
    Server --> Manipulator
    Server --> LLM_Client
    
    Database -->|Reads| DB_2D
    Database -->|Reads| DB_3D
    Manipulator -->|Reads/Writes| Script_Templates
```

## 5. Security & Configuration Architecture

Overview of security boundaries and configuration management.

```mermaid
graph LR
    subgraph "Environment"
        EnvFile[".env File"]
        SysEnv["System Environment"]
    end
    
    subgraph "Application Boundary"
        ConfigLoader["Config Loader"]
        APIKey["OpenAI API Key"]
        
        subgraph "Security Controls"
            InputSanitizer["Input Sanitization"]
            PathValidation["File Path Validation"]
        end
    end
    
    subgraph "External Services"
        OpenAI["OpenAI API"]
    end

    %% Flow
    EnvFile & SysEnv --> ConfigLoader
    ConfigLoader --> APIKey
    APIKey --> OpenAI
    
    UserRequest --> InputSanitizer
    InputSanitizer --> LLMCall
    
    FileRequest --> PathValidation
    PathValidation --> FileAccess
```

## 6. Deployment Architecture

Recommended setup for production deployment.

```mermaid
graph TD
    User((User))
    Internet((Internet))
    
    subgraph "Production Server"
        Nginx["Reverse Proxy (Nginx)<br/>SSL Termination"]
        Gunicorn["WSGI Server (Gunicorn)"]
        Flask["Flask App"]
        
        subgraph "Process Management"
            Supervisor["Supervisor/Systemd"]
        end
        
        subgraph "Storage"
            StaticFiles["Static Asset Volume"]
            GeneratedScripts["Script Output Volume"]
        end
    end
    
    %% Flow
    User --> Internet
    Internet --> Nginx
    Nginx --> Gunicorn
    Gunicorn --> Flask
    Supervisor --> Gunicorn
    
    Flask --> StaticFiles
    Flask --> GeneratedScripts
    
    Nginx --> StaticFiles
```

## Scalability Considerations

- **Session State**: Currently stored in-memory (`sessions` dictionary). For horizontal scaling, this should be moved to an external store (Redis/Memcached).
- **Concurrent Users**: Flask's built-in server is single-threaded by default. Production deployment requires valid WSGI (Gunicorn/uWSGI) with multiple workers.
- **File System**: Generated scripts are local. In a distributed environment, a shared volume or cloud storage (S3) would be required.
- **LLM Latency**: Heavy reliance on synchronous LLM calls. Consider background job queues (Celery/Redis Queue) for long-running generation tasks.

## 7. User Workflow (Manual Import)

This diagram explicitly differentiates the automated parts of the system from the manual steps required by the user.

```mermaid
graph LR
    subgraph "Athena Agent"
        UserC[User Input] --> WebUI[Web Interface]
        WebUI --> Generation[Code Generation]
        Generation --> ScriptFile[".JS Script File"]
    end
    
    subgraph "Manual Transfer"
        ScriptFile -->|Download/Copy Path| UserAction[User]
        UserAction -->|Open Script Manager| RFEM[Dlubal RFEM 6]
    end
    
    style UserAction fill:#f96,stroke:#333,stroke-width:2px;
    style RFEM fill:#f9f,stroke:#333,stroke-width:2px;
```

## 8. LLM Integration Architecture

The system leverages structured outputs (JSON enforcement) to turn natural language into executable data.

```mermaid
graph LR
    subgraph "Input Context"
        History[Chat History]
        UserMsg[User Message]
        Schema[Parameter Schema]
        Candidates[Block Candidates]
    end
    
    subgraph "LLM Processing (LangChain)"
        Model[GPT-4o]
        
        subgraph "Structured Chains"
            C1[IntentExtraction]
            C2[BlockSelectionIntent]
            C3[SmartParameterExtraction]
            C4[ParameterValueResponse]
            C5[BlockExplanation]
        end
    end
    
    subgraph "Structured Outputs"
        O1["Dimensionality / Type / Material"]
        O2["Selected Index / Action"]
        O3["Dict: {param_name: value}"]
        O4["Value / Intent (Default/Help)"]
        O5[Educational Text]
    end
    
    %% Flow
    History & UserMsg --> C1
    UserMsg & Candidates --> C2
    UserMsg & Schema --> C3
    UserMsg & Schema --> C4
    
    C1 --> Model --> O1
    C2 --> Model --> O2
    C3 --> Model --> O3
    C4 --> Model --> O4
    
    style Model fill:#ff9,stroke:#333,stroke-width:2px
```
