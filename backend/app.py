import os
from datetime import datetime, timezone
from pathlib import Path
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Ensure environment variables are loaded
load_dotenv(Path(__file__).resolve().parent / ".env")

from routes.auth import auth_bp
from routes.events import events_bp
from routes.users import users_bp


def create_app():
    app = Flask(__name__)

    # CORS configuration matching original Express server
    CORS(
        app,
        resources={r"/api/*": {"origins": "*"}},
        methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "Authorization"]
    )

    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(events_bp, url_prefix="/api/events")
    app.register_blueprint(users_bp, url_prefix="/api/users")

    # Health check endpoint
    @app.route("/api/health", methods=["GET"])
    def health_check():
        return jsonify({
            "status": "ok",
            "service": "Registro API",
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        }), 200

    @app.errorhandler(500)
    def internal_error(err):
        return jsonify({"error": "Internal Server Error"}), 500

    return app
