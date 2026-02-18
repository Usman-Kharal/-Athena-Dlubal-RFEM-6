# 🏗️ RFEM Structural Block Generator

An AI-powered web application that generates parametric structural block scripts for **Dlubal RFEM 6** through natural language conversation.

![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-3.0+-green?logo=flask&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-purple?logo=openai&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow)

## ✨ Features

- **🤖 AI-Powered Conversation** — Describe what you need in natural language (e.g., *"I need a 2D steel truss"*)
- **🔍 Smart Block Selection** — Automatically matches your requirements to the right structural block template
- **⚙️ Parameter Configuration** — AI-guided parameter collection with intelligent defaults
- **📝 JS Code Generation** — Generates ready-to-use RFEM 6 block scripts with your custom parameters
- **🦉 Athena Assistant** — Named after the goddess of wisdom, guides you through the entire workflow

## 📁 Project Structure

```
RFEM-Block-Generator/
├── Athena_AI_Agent.py     # Flask API server (main entry point)
├── shared_logic.py        # Core logic: LLM, database, JS manipulator
├── templates/
│   └── index.html         # Chat-based web UI
├── static/
│   ├── style.css          # Main stylesheet
│   └── colors.css         # Color theme variables
├── 2D/                    # 2D block templates (.JS) + database
│   └── 2D_DB.json
├── 3D/                    # 3D block templates (.JS) + database
│   └── 3D_DB.json
├── docs/                  # Documentation
│   └── architecture.md
├── config.ini.template    # Configuration template (copy to config.ini)
└── requirements.txt       # Python dependencies
```

## 🚀 Getting Started

### Prerequisites

- **Python 3.10+**
- **OpenAI API Key** (GPT-4o)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/RFEM-Block-Generator.git
   cd RFEM-Block-Generator
   ```

2. **Create a virtual environment**
   ```bash
   python -m venv .venv
   
   # Windows
   .venv\Scripts\activate
   
   # macOS/Linux
   source .venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure your API key**
   
   Create a `.env` file in the project root:
   ```env
   OPENAI_API_KEY=sk-your-api-key-here
   ```
   
   Or copy and edit the config template:
   ```bash
   copy config.ini.template config.ini
   # Edit config.ini with your Dlubal API key
   ```

5. **Run the application**
   ```bash
   python Athena_AI_Agent.py
   ```
   
   The browser will automatically open to `http://localhost:5000` when the server is ready.

## 💬 Usage

1. **Describe your structure** — Tell Athena what you need (e.g., *"I want a 3D steel frame for a warehouse"*)
2. **Select a block** — Choose from matching structural block templates
3. **Configure parameters** — Set dimensions, spans, heights, etc. (or use defaults)
4. **Get your code** — The generated `.JS` file is saved and ready to import into RFEM 6

### Example Conversation

```
You: I need a 2D steel truss
Athena: I can help with that! I found 3 matching blocks...
You: 1
Athena: What should be the total span length?
You: 12 meters
Athena: ✅ Code generated! → 2D/001637_generated.JS
```

## 🔧 Configuration

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | Your OpenAI API key | ✅ Yes |
| `dlubal.api_key` | Dlubal Extranet API key | Optional |
| `server.address` | RFEM server address | Optional |

## 🏛️ Architecture
 
 The system uses a **multi-phase conversational AI pipeline**:
 
 ```mermaid
 graph TD
     Client["Web Client<br/>(Browser / HTML / JS)"]
     WebServer["Web Server<br/>(Flask / Athena_AI_Agent.py)"]
     CoreLogic["Core Logic Layer<br/>(shared_logic.py)"]
     DB["Block Database<br/>(Class Instance)"]
     JSONStore[("JSON Files<br/>(Data Persistence)")]
     LLM["LLM Provider<br/>(OpenAI API)"]
     FileSystem["File System<br/>(Scripts / Templates)"]
 
     Client <-->|HTTP / WebSocket / JSON| WebServer
     WebServer <-->|"Import & Call"| CoreLogic
     CoreLogic -->|"Initialize & Query"| DB
     DB -->|"Read on Startup"| JSONStore
     CoreLogic <-->|"API Calls (HTTPS)"| LLM
     CoreLogic <-->|"Read/Write"| FileSystem
     
     classDef app fill:#bbf,stroke:#333,stroke-width:2px;
     classDef db fill:#bfb,stroke:#333,stroke-width:2px;
     classDef external fill:#f9f,stroke:#333,stroke-width:2px;
     
     class WebServer,CoreLogic app;
     class DB,JSONStore,FileSystem db;
     class LLM external;
 ```

See [`architecture.md`](docs/architecture.md) for detailed diagrams and [`evaluation_results.md`](docs/evaluation_results.md) for performance metrics.

## 🛡️ Security

- **API keys** are stored in `.env` / `config.ini` (both gitignored)
- **No secrets** are committed to the repository
- The `config.ini.template` file shows the required format without actual keys

## 📄 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
