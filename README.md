# SupportRAG - Enterprise IT Support RAG

SupportRAG is an enterprise-grade IT support copilot built with FastAPI, LangGraph, OpenAI, Pinecone, and Tavily. It helps employees get answers from a private company knowledge base, falls back to trusted external web search when the internal knowledge is weak, and exposes a simple web UI plus API endpoints for integration.

The system is designed for internal helpdesk and IT support use cases such as VPN setup, password reset guidance, MFA troubleshooting, device policy questions, and general knowledge-base answering.

## Why this project exists

Most enterprise support teams have knowledge spread across:

- internal policy documents
- runbooks and procedures
- onboarding guides
- service desk handbooks
- vendor documentation

SupportRAG brings that knowledge into a retrieval workflow that:

1. routes user questions to the most relevant source
2. searches the private company knowledge base first
3. grades the evidence before responding
4. uses external web search only when the internal KB is insufficient
5. explains the source behind the answer

## Key features

- Agentic RAG workflow using LangGraph
- Private knowledge-base retrieval first
- Evidence grading and response validation
- Web fallback with Tavily search
- Document ingestion for PDF, TXT, Markdown, and DOCX files
- FastAPI backend and browser-based chat interface
- API endpoints for chat and ingestion
- Built-in sample enterprise KB for quick demos

## Architecture

This project combines several components:

- Frontend: FastAPI + Jinja2 templates + static assets
- API layer: FastAPI routes
- Agent orchestration: LangGraph workflow
- Retrieval: Pinecone vector store + OpenAI embeddings
- LLM orchestration: OpenAI chat models
- External fallback: Tavily web search
- File ingestion: PDF/TXT/MD/DOCX parsing with chunking

## Project structure

```text
SupportRAG---Enterprise-IT-Support-RAG/
├── app/
│   ├── api/
│   │   └── routes.py
│   ├── core/
│   │   ├── config.py
│   │   └── log_config.py
│   ├── rag/
│   │   ├── state.py
│   │   ├── vectorstore.py
│   │   └── workflow.py
│   ├── services/
│   │   ├── audit.py
│   │   ├── ingestion.py
│   │   └── __init__.py
│   ├── main.py
│   └── __init__.py
├── data/
│   ├── audit.db
│   └── sample_kb/
│       ├── company_it_handbook.md
│       └── service_desk_runbook.md
├── static/
├── templates/
│   └── index.html
├── uploads/
├── .env
├── .gitignore
├── Dockerfile
├── ingest_sample_kb.py
├── requirements.txt
├── run.py
└── README.md
```

## Prerequisites

- Python 3.11+
- API access to:
  - OpenAI
  - Pinecone
  - Tavily
- A Pinecone index ready for vector storage

## Setup

1. Create a virtual environment:

```bash
python -m venv venv
```

2. Activate it:

On Windows PowerShell:

```powershell
.\venv\Scripts\Activate.ps1
```

On macOS/Linux:

```bash
source venv/bin/activate
```

3. Install dependencies:

```bash
pip install -r requirements.txt
```

4. Create a `.env` file in the project root with the required values:

```env
OPENAI_API_KEY=your_openai_key
TAVILY_API_KEY=your_tavily_key
PINECONE_API_KEY=your_pinecone_key
PINECONE_INDEX_NAME=support-rag
PINECONE_NAMESPACE=company-it-kb
OPENAI_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small
ADMIN_API_KEY=your_admin_key
```

> The application reads configuration from `.env` via `pydantic-settings`.

## Index the sample knowledge base

This project includes a sample internal KB under `data/sample_kb`. To index it into Pinecone:

```bash
python ingest_sample_kb.py
```

This loads the sample documents, chunks them, and stores vector embeddings in Pinecone.

## Run the app

Start the API and web UI:

```bash
python run.py
```

This launches Uvicorn with the app entrypoint `app.main:app`.

Open the browser at:

```text
http://127.0.0.1:8080/
```

### Alternative run command

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8080 --reload
```

## Docker

A Dockerfile is included for containerized deployment:

```bash
docker build -t supportrag .
docker run -p 8080:8080 --env-file .env supportrag
```

## Usage

### Browser UI

- Open the app in a browser.
- Ask IT support questions in the chat box.
- Review the agent trace panel to see routing, retrieval, and grading steps.
- Upload company documents from the sidebar to add knowledge to the vector store.

### API usage

#### Health check

```bash
curl http://127.0.0.1:8080/api/health
```

#### Ask a question

```bash
curl -X POST http://127.0.0.1:8080/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question":"How do I connect to the company VPN?"}'
```

#### Stream responses

```bash
curl -X POST http://127.0.0.1:8080/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"question":"What is the password reset process?"}'
```

#### Ingest a document

```bash
curl -X POST http://127.0.0.1:8080/api/ingest \
  -H "x-admin-key: your_admin_key" \
  -F "file=@/path/to/your/document.pdf"
```

Supported file types:

- `.pdf`
- `.txt`
- `.md`
- `.docx`

## API behavior

The application routes user questions through a LangGraph workflow:

1. route question as either internal KB or direct chat
2. search internal KB via Pinecone retrieval
3. grade the evidence quality
4. if evidence is weak, search the web via Tavily
5. rewrite the query and retry as needed
6. return a grounded answer with citations and trace data

The result payload includes:

- `answer`
- `source_used`
- `trace`
- `citations`
- `rewritten_query`

## Notes

- This project is intended for internal enterprise support scenarios and should be paired with a secure admin workflow and access controls.
- Private company policies and support docs should be reviewed before publishing them to the vector store.
- The app uses a Pinecone index, so the target environment must already have that resource configured.
