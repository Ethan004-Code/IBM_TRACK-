# EchoPantry Exchange

A community food sharing prototype for listing single items or bundles of up to five groceries as an exchange or giveaway, posting food requests, receiving match notifications, and confirming pickups. It does not handle payments or donate food automatically.

## Run locally

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Flask serves both the frontend and API from the same origin. Open <http://127.0.0.1:5000>. This avoids separate frontend/backend host and CORS mismatches. If you choose to serve `frontend/` separately during development, the browser targets Flask on port 5000; set `window.ECHOPANTRY_API_URL` before `app.js` loads for a different API origin and configure `FRONTEND_ORIGINS` accordingly.

## MySQL setup

Install and start MySQL, then create the EchoPantry database and tables:

```bash
mysql -u root -p < backend/mysql_schema.sql
```

Enter the credentials for your local MySQL account in `backend/.env`. The local file is ignored by git and loaded automatically by Flask. Set `MYSQL_PASSWORD` to your MySQL root password, or change `MYSQL_USER` and `MYSQL_PASSWORD` to a MySQL user that can create the database and tables.

```bash
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_local_mysql_password
MYSQL_DATABASE=echopantry
```

After configuring the credentials, create the database with `mysql -u root -p < backend/mysql_schema.sql`, install the backend requirements, and restart Flask.

The API stores profiles, hashed passwords, and hashed session tokens in MySQL. Account deletion sets `user_profiles.deleted_at` and revokes active sessions, preserving trade history and ratings. API records are stored in MySQL's `app_records` JSON column; types include listings, requests, offers, notifications, ratings, impact records, reports, and blocks. The health endpoint reports whether MySQL connected. Without a database connection, public sample listings still run in memory, but account creation and protected actions are disabled. Never commit database passwords. For HTTPS deployments set `COOKIE_SECURE=true`.

## Prototype behavior and limits

- Exchange matches use reciprocal item names, a shared public pickup zone, overlapping weekday/time windows when the entered availability is recognizable, and active deadlines. Python handles trade status and quantity/expiry validation. The sample matcher is deterministic. Natural-language request parsing uses watsonx.ai when its credentials are configured.
- Giveaway requests and food requests generate in-app notifications. The browser checks for notifications every 15 seconds.
- Both exchange participants must accept; both must confirm pickup before ratings are enabled. Reports and blocks are available on listing cards.
- Estimated impact is calculated from completed sample trades and is labeled as an estimate.
- The Flask API accesses MySQL using server-side connection settings. Use a limited database user and review deployment secrets and rate limits before public launch. The prototype is not affiliated with any official community or campus service.

## Natural-language request parsing

Install the updated backend dependencies, then configure these server-side watsonx.ai values before starting Flask:

```bash
export WATSONX_API_KEY="YOUR_IBM_CLOUD_API_KEY"
export WATSONX_URL="https://us-south.ml.cloud.ibm.com"
export WATSONX_PROJECT_ID="YOUR_WATSONX_PROJECT_ID"
export WATSONX_MODEL_ID="ibm/granite-3-8b-instruct"
```

The authenticated `POST /api/ai/parse-request` endpoint is connected to the “Describe what you need” form. Select **Fill from description**, review the extracted fields, provide any missing deadline or pickup zone, then post. It accepts `{"text":"I need apples by Friday and can offer rice"}` and returns a validated `parsed_request` with wanted items, quantities, offered items, a normalized calendar date when one can be extracted, and optional location and pickup availability. Missing location or availability stays `null`; the parser does not invent it. The endpoint only parses and returns a draft. The user can review it before posting through `POST /api/requests`.

watsonx.ai credentials stay in the Flask environment and are never sent to the browser. See IBM's [watsonx.ai Python SDK](https://ibm.github.io/watsonx-ai-python-sdk/) for supported models, regions, and configuration.
