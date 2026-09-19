"""Fresh Coders 2.0 — Euphoria 2026 examination platform API (Flask + SQLite)."""
from flask import Flask, jsonify
from flask_cors import CORS

from config import config
from database import close_db, init_db
from routes.admin_routes import admin_bp
from routes.auth_routes import auth_bp, developer_bp
from routes.staff_routes import staff_bp
from routes.student_routes import student_bp

DEFAULT_SECRET = "dev-only-change-me"


def create_app() -> Flask:
    app = Flask(__name__)

    # Fail fast: in production the default secret is never acceptable.
    if config.is_production and (not config.SECRET_KEY or config.SECRET_KEY == DEFAULT_SECRET):
        raise RuntimeError(
            "SECRET_KEY must be set to a unique random value outside of development."
        )

    app.config["SECRET_KEY"] = config.SECRET_KEY
    app.config["MAX_CONTENT_LENGTH"] = config.MAX_CONTENT_LENGTH

    CORS(
        app,
        origins=[o.strip() for o in config.CORS_ORIGINS.split(",") if o.strip()],
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
    )

    app.register_blueprint(auth_bp)
    app.register_blueprint(developer_bp)
    app.register_blueprint(student_bp)
    app.register_blueprint(staff_bp)
    app.register_blueprint(admin_bp)

    app.teardown_appcontext(close_db)

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok", "env": config.FLASK_ENV})

    @app.errorhandler(404)
    def not_found(_error):
        return jsonify({"message": "Resource not found."}), 404

    @app.errorhandler(413)
    def body_too_large(_error):
        return jsonify({"message": "Request body exceeds the allowed limit."}), 413

    @app.errorhandler(ValueError)
    @app.errorhandler(TypeError)
    def bad_input(error):
        return jsonify({"message": f"Invalid request: {error}"}), 400

    @app.errorhandler(500)
    def server_error(_error):
        return jsonify({"message": "Unexpected server error."}), 500

    with app.app_context():
        init_db()

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=not config.is_production, port=5000)