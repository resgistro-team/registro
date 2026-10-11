import os
from app import create_app
from auth_middleware import _supabase_config

app = create_app()

if __name__ == "__main__":
    _supabase_config()  # Refuses to start without Supabase Auth configuration
    port = int(os.getenv("PORT", 5000))
    print(f"🚀 Registro API Server running at http://localhost:{port}")
    print(f"📡 Health check: http://localhost:{port}/api/health")
    app.run(host="0.0.0.0", port=port, debug=False)
