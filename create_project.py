from pathlib import Path

root_dir = Path(".")

# Folder to create

folders = [
    "app/api",
    "app/core",
    "app/rag",
    "app/services",
    "data",
    "templates",
    "static",
    "uploads",
    "tests",
]

files = [
    "app/main.py",
    "requirements",
    "ingest_sample_kb.py",
    "run.py",
    ".env"
]

for folder in folders:
    (root_dir / folder).mkdir(parents=True, exist_ok=True)

for file in files:
    (root_dir / file).touch(exist_ok=True)

print("Project structure created successfully")