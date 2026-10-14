"""Add (or remove) a set of demo events, so the poster wall looks alive for a demo.

    python seed_demo_events.py            # add the events, dated from today
    python seed_demo_events.py --remove   # delete them and their demo hosts

Everything goes through data.repository, so the normal validation applies.
Turnout is never faked: every event starts with nobody registered.
Demo hosts use demo+...@example.com addresses, which is how --remove finds them.
"""
import sys
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from data import repository as repo
from data.cover_urls import COVERS

EASTERN = ZoneInfo("America/New_York")

HOSTS = {
    "open-stage": "Open Stage Collective",
    "detroit-tech": "Detroit Tech Meetup",
    "asa": "African Students Association",
    "ypsi-run": "Ypsi Run Club",
    "dyp": "Detroit Young Professionals",
    "art-studio": "Ypsi Art Studio",
    "careers": "Career Development Center",
    "volunteers": "Ypsi Volunteers",
    "study": "Study Buddies",
    "pickup": "Pickup Sports Crew",
}

# (host, title, category, location, days from today, start "HH:MM", hours, capacity, (cover set, index), description)
EVENTS = [
    ("open-stage", "Open Mic Night", "Music", "The Back Room, Ann Arbor", 0, "20:00", 2.5, 80, ("music", 0),
     "Poetry, music and comedy. Sign up at the door to perform, or just come listen. Doors at 7:45."),
    ("pickup", "Pickup Soccer Under the Lights", "Sports", "Rec/IM Fields, Ypsilanti", 1, "18:00", 2, 22, ("sports", 0),
     "Casual 7v7. All levels, teams picked on the spot. Bring a light and a dark shirt."),
    ("detroit-tech", "Detroit Tech Meetup: Shipping AI Features", "Technology", "TechTown Innovation Hall, Detroit", 1, "18:30", 2, 120, ("tech", 1),
     "Three short talks from people who put AI features in front of real users, then pizza and questions."),
    ("asa", "Jollof Wars", "Culture", "McKenny Hall Ballroom, Ypsilanti", 2, "18:00", 3, 150, ("culture", 0),
     "Ghana, Nigeria, Senegal and more go head to head. Taste every pot, then vote for the best jollof."),
    ("ypsi-run", "Saturday Morning Run Club", "Sports", "Riverside Park, Ypsilanti", 3, "09:00", 1.5, None, ("social", 2),
     "Easy 5K along the river, every pace welcome. Coffee after for anyone who wants it."),
    ("dyp", "Rooftop Social: Fall Edition", "Social", "Corktown Rooftop, Detroit", 3, "19:00", 4, 60, ("social", 0),
     "Music, food trucks and the skyline. Come solo, leave with friends."),
    ("art-studio", "Pottery and Paint Night", "Arts", "Ypsi Art Studio, Ypsilanti", 4, "14:00", 3, 16, ("arts", 0),
     "Make a mug, paint a canvas, take both home. All materials included. No experience needed."),
    ("study", "Study Jam: Midterm Edition", "Study", "Halle Library, 3rd floor, Ypsilanti", 5, "18:00", 4, 30, ("academic", 0),
     "Quiet tables, group rooms and tutors on hand for math and chem. Snacks at 8."),
    ("careers", "Career Fair: Tech and Design", "Career", "Student Center Ballroom, Ypsilanti", 6, "11:00", 4, None, ("career", 1),
     "Forty employers hiring for internships and first jobs. Bring copies of your resume."),
    ("volunteers", "Neighborhood Cleanup Day", "Community", "Frog Island Park, Ypsilanti", 10, "10:00", 3, 40, ("community", 0),
     "Gloves, bags and lunch provided. Two hours that make the park better for everyone."),
]


def email_for(slug):
    return f"demo+{slug}@example.com"


def add():
    today = datetime.now(EASTERN).date()
    hosts = {slug: repo.get_or_create_user(email_for(slug), name)["user_id"] for slug, name in HOSTS.items()}
    for host, title, category, location, days, start, hours, capacity, cover_set, description in EVENTS:
        day = today + timedelta(days=days)
        h, m = map(int, start.split(":"))
        begins = datetime(day.year, day.month, day.day, h, m, tzinfo=EASTERN)
        # Skip anything already over, so a rerun late in the day still succeeds.
        if begins <= datetime.now(EASTERN):
            begins += timedelta(days=7)
        cover_set, index = cover_set
        cover = COVERS[cover_set][index]
        event = repo.create_event(
            hosts[host],
            title=title,
            description=description,
            category=category,
            location=location,
            start_datetime=begins,
            end_datetime=begins + timedelta(hours=hours),
            capacity=capacity,
            image=cover,
            status="Published",
        )
        print(f"added  {begins:%a %b %d %I:%M %p}  {event['title']}")


def remove():
    removed = 0
    for slug in HOSTS:
        user = repo.find_user_by_email(email_for(slug))
        if not user:
            continue
        for event in repo.list_organizer_events(user["user_id"]):
            repo.delete_event(event["event_id"], user["user_id"])
            removed += 1
        with repo.connect() as conn:
            conn.execute("DELETE FROM public.users WHERE user_id = %s", (user["user_id"],))
    print(f"removed {removed} demo events and their hosts")


if __name__ == "__main__":
    remove() if "--remove" in sys.argv else add()
