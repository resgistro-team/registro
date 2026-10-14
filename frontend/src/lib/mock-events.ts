import type { RegistroEvent } from "./events";

/**
 * Stand-in for `GET` on Victor's event list until the attendee API lands (Oct 12).
 * The first two rows are the seed events from backend/database/seed.sql.
 * Delete this file once the page reads from the API.
 */

const ORGANIZER_ID = "10000000-0000-4000-8000-000000000001";
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

interface Draft {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  /** Days from now, and the hour it starts in UTC. */
  inDays: number;
  startsUtcHour: number;
  hours: number;
  capacity: number | null;
  registered: number;
  organizer: string;
}

const DRAFTS: Draft[] = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    title: "Campus Coding Workshop",
    description: "Practice Python with other students.",
    category: "Technology",
    location: "University Center, Room 201",
    inDays: 3,
    startsUtcHour: 22,
    hours: 2,
    capacity: 30,
    registered: 27,
    organizer: "Demo Organizer",
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    title: "Full Event Demo",
    description: "Test the no-spaces-left message.",
    category: "Workshop",
    location: "Room 202",
    inDays: 4,
    startsUtcHour: 21,
    hours: 1,
    capacity: 1,
    registered: 1,
    organizer: "Demo Organizer",
  },
  {
    id: "20000000-0000-4000-8000-000000000004",
    title: "Fall Career Fair",
    description: "Sixty employers, one afternoon. Bring copies of your resume.",
    category: "Career",
    location: "Student Center Ballroom",
    inDays: 6,
    startsUtcHour: 15,
    hours: 4,
    capacity: null,
    registered: 212,
    organizer: "Career Development Center",
  },
  {
    id: "20000000-0000-4000-8000-000000000005",
    title: "Open Mic Night",
    description: "Poetry, music and comedy. Sign up at the door to perform.",
    category: "Arts",
    location: "Halle Library Auditorium",
    inDays: 8,
    startsUtcHour: 23,
    hours: 2,
    capacity: 120,
    registered: 64,
    organizer: "Campus Life",
  },
  {
    id: "20000000-0000-4000-8000-000000000006",
    title: "Intramural Soccer Kickoff",
    description: "Find a team or bring your own. All skill levels.",
    category: "Sports",
    location: "Rec/IM Fields",
    inDays: 9,
    startsUtcHour: 20,
    hours: 3,
    capacity: 80,
    registered: 76,
    organizer: "Rec/IM",
  },
  {
    id: "20000000-0000-4000-8000-000000000007",
    title: "Design Jam",
    description: "Pair up, pick a brief, ship a prototype by sundown.",
    category: "Technology",
    location: "Sill Hall, Studio B",
    inDays: 12,
    startsUtcHour: 17,
    hours: 6,
    capacity: 40,
    registered: 18,
    organizer: "Design Club",
  },
];

export function mockEvents(now: Date = new Date()): RegistroEvent[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return DRAFTS.map((draft) => {
    const start = today + draft.inDays * DAY + draft.startsUtcHour * HOUR;
    return {
      event_id: draft.id,
      organizer_id: ORGANIZER_ID,
      title: draft.title,
      description: draft.description,
      image: null,
      category: draft.category,
      location: draft.location,
      start_datetime: new Date(start).toISOString(),
      end_datetime: new Date(start + draft.hours * HOUR).toISOString(),
      capacity: draft.capacity,
      status: "Published",
      created_at: new Date(today - 2 * DAY).toISOString(),
      organizer_name: draft.organizer,
      registration_count: draft.registered,
      remaining_capacity: draft.capacity === null ? null : draft.capacity - draft.registered,
    };
  });
}
