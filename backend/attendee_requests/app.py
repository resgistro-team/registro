from datetime import date, datetime
from flask import Flask, abort, jsonify, request
#Using Flask for API commands
app = Flask(__name__)

events = [
    {
        "event_id": 1,
        "title": "IT Job Fair",
        "description": "Meet IT employers and exchange information to hopefully form connections and gain employment",
        "date_and_time_start": datetime(2026, 10, 7, 13, 0),
        "date_and_time_end": datetime(2026, 10, 7, 17, 0),
        "category": "technology",
        "location": "Student Center Ballroom",
        "Organizer": "Eastern Michigan University",
        "status": "published",
    },
    {
        "event_id": 2,
        "title": "Jollof Wars",
        "description": "Come and enjoy Jollof rice from different West African cultures and vote for the best Jollof rice",
        "date_and_time_start": datetime(2026, 11, 20, 13, 0),
        "date_and_time_end": datetime(2026, 10, 7, 17, 0),
        "category": "cultural",
        "location": "Mckenny Hall Ballroom",
        "Organizer": "African Students Association",
        "status": "published",
    },
    {
        "event_id": 1,
        "title": "Bible Study",
        "description": "",
        "date_and_time_start": datetime(2026, 10, 7, 13, 0),
        "date_and_time_end": datetime(2026, 10, 7, 17, 0),
        "category": "technology",
        "location": "Student Center Room 300",
        "Organizer": "New Life Church",
        "status": "published",
    },
]
#this calls the health function to check if the app is functioning well
@app.get("/health")
def health_check():
    return jsonify({"status": "ok"})

@app.get("/events")
def list_events():
    results = [
        event for event in events
        if event["status"] == "published"
    ]

    search = request.args.get("search", "").casefold()
    category = request.args.get("category", "").casefold()

    if search:
        results = [
            event for event in results
            if search in event["title"].casefold()
            or search in event["description"].casefold()
            or search in event["location"].casefold()
        ]

    if category:
        results = [
            event for event in results
            if event["category"].casefold() == category
        ]