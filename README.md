# IBM_TRACK

Small browser frontend backed by a Flask development API.

## Run locally

Open two terminals from the project folder.

In terminal 1, start the backend:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

In terminal 2, serve the frontend:

```bash
cd frontend
python3 -m http.server 8000
```

Then open <http://127.0.0.1:8000> in your browser. The page checks the Flask health endpoint and sends problem descriptions to `http://127.0.0.1:5000/api/recommend`.

The recommendation endpoint currently returns a placeholder because the AI and database are not connected yet.
