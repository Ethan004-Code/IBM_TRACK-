from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)


@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "IBM Hackathon backend is running"})


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "backend": "Flask"})


@app.route("/api/recommend", methods=["POST"])
def recommend():
    data = request.get_json(silent=True) or {}
    problem = data.get("problem", "")

    if not isinstance(problem, str) or not problem.strip():
        return jsonify({"error": "Please provide a problem."}), 400

    problem = problem.strip()

    # Temporary response until MySQL and AI are connected.
    return jsonify(
        {
            "problem": problem,
            "recommendations": [],
            "message": "Recommendation system is not connected yet.",
        }
    )


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
