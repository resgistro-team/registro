import os
from flask import Flask, abort, jsonify, request
from dotenv import load_dotenv
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone

load_dotenv()

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ["DATABASE_URL"]
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

from sqlalchemy import text

with app.app_context():
    db.session.execute(text("SELECT 1"))
    print("Database connection OK")


class Event(db.Model):
    __tablename__ = "events"

    event_id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    category = db.Column(db.String(100))
    location = db.Column(db.String(200))
    start_datetime = db.Column(db.DateTime(timezone=True))
    status = db.Column(db.String(30), nullable=False)
    capacity = db.Column(db.Integer)


class Registration(db.Model):
    __tablename__ = "registrations"

    registration_id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(
        db.Integer, db.ForeignKey("events.event_id"), nullable=False
    )
    user_id = db.Column(db.Integer, nullable=False)
    registration_status = db.Column(db.String(30), nullable=False)
    registered_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
#this calls the health function to check if the app is functioning well
@app.get("/health")
def health_check():
    return jsonify({"status": "ok"})

@app.get("/")
def home():
    return jsonify({"message": "Welcome to the Registro API"})

@app.get("/events")
def list_events():
    query = Event.query.filter_by(status="published")

    search = request.args.get("search", "").strip()
    category = request.args.get("category", "").strip()

    if search:
        pattern = f"%{search}%"
        query = query.filter(
            db.or_(
                Event.title.ilike(pattern),
                Event.description.ilike(pattern),
                Event.location.ilike(pattern),
            )
        )

    if category:
        query = query.filter(Event.category.ilike(category))

    events = query.order_by(Event.start_datetime).all()

    return jsonify([
        {
            "event_id": event.event_id,
            "title": event.title,
            "description": event.description,
            "category": event.category,
            "location": event.location,
            "start_datetime": (
                event.start_datetime.isoformat()
                if event.start_datetime else None
            ),
        }
        for event in events
    ])


@app.get("/events/<int:event_id>")
def event_details(event_id):
    event = Event.query.filter_by(
        event_id=event_id,
        status="published",
    ).first_or_404()

    return jsonify({
        "event_id": event.event_id,
        "title": event.title,
        "description": event.description,
        "category": event.category,
        "location": event.location,
        "start_datetime": (
            event.start_datetime.isoformat()
            if event.start_datetime else None
        ),
        "capacity": event.capacity,
    })

@app.get("/me/registrations")
def my_registrations():
    user_id = current_user.id  # Supplied by your authentication setup

    registrations = Registration.query.filter_by(
        user_id=user_id,
        registration_status="registered",
    ).all()

    return jsonify([
        {
            "registration_id": registration.registration_id,
            "event_id": registration.event_id,
            "registration_status": registration.registration_status,
            "registered_at": registration.registered_at.isoformat(),
        }
        for registration in registrations
    ])

@app.post("/events/<int:event_id>/registrations")
def register_for_event(event_id):
    event = Event.query.filter_by(
        event_id=event_id,
        status="published",
    ).first()

    if event is None:
        return jsonify({"error": "Published event not found"}), 404

    # Prototype only: replace this with current_user.id when auth is set up.
    data = request.get_json(silent=True)
    attendee_id = data.get("attendee_id") if isinstance(data, dict) else None

    if type(attendee_id) is not int:
        return jsonify({"error": "attendee_id must be an integer"}), 400

    existing = Registration.query.filter_by(
        event_id=event_id,
        user_id=attendee_id,
    ).first()

    if existing and existing.registration_status == "registered":
        return jsonify({"error": "Already registered for this event"}), 409

    registered_count = Registration.query.filter_by(
        event_id=event_id,
        registration_status="registered",
    ).count()

    if event.capacity is not None and registered_count >= event.capacity:
        return jsonify({"error": "This event is full"}), 409

    if existing:
        # Reactivate a previous cancelled registration.
        existing.registration_status = "registered"
        existing.registered_at = datetime.now(timezone.utc)
        registration = existing
    else:
        registration = Registration(
            event_id=event_id,
            user_id=attendee_id,
            registration_status="registered",
        )
        db.session.add(registration)

    db.session.commit()

    return jsonify({
        "registration_id": registration.registration_id,
        "event_id": registration.event_id,
        "user_id": registration.user_id,
        "registration_status": registration.registration_status,
        "registered_at": registration.registered_at.isoformat(),
    }), 201