import os
from app import create_app
from auth_middleware import get_jwt_secret

app = create_app()

if __name__ == "__main__":
    get_jwt_secret()  # Refuses to start if JWT_SECRET is not set
    port = int(os.getenv("PORT", 5000))
    print(f"🚀 Registro API Server running at http://localhost:{port}")
    print(f"📡 Health check: http://localhost:{port}/api/health")
    app.run(host="0.0.0.0", port=port, debug=False)
