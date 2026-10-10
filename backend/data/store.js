const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_FILE = path.join(__dirname, 'db.json');

function getInitialData() {
  const hashedPassword = bcrypt.hashSync('password123', 10);

  const users = [
    {
      id: 'usr_alex',
      name: 'Alex Rivera',
      email: 'alex@registro.io',
      password: hashedPassword,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
      role: 'organizer',
      bio: 'Tech community organizer & Lead Curator at Silicon North.',
      createdAt: '2026-01-10T10:00:00.000Z'
    },
    {
      id: 'usr_sarah',
      name: 'Sarah Chen',
      email: 'sarah@registro.io',
      password: hashedPassword,
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=250&q=80',
      role: 'attendee',
      bio: 'Product designer & creative technologist exploring interactive design.',
      createdAt: '2026-02-14T11:30:00.000Z'
    },
    {
      id: 'usr_marcus',
      name: 'Marcus Vance',
      email: 'marcus@registro.io',
      password: hashedPassword,
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
      role: 'attendee',
      bio: 'Full-stack engineer, open source enthusiast, and foodie.',
      createdAt: '2026-03-01T09:15:00.000Z'
    }
  ];

  // Helper date generators for dynamic future and past dates
  const now = new Date();
  const addDays = (d, days) => {
    const copy = new Date(d);
    copy.setDate(copy.getDate() + days);
    return copy.toISOString();
  };
  const setHours = (iso, h, m) => {
    const d = new Date(iso);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };

  const events = [
    {
      id: 'evt_nextgen_ai',
      organizerId: 'usr_alex',
      organizerName: 'Alex Rivera',
      title: 'NextGen AI & Autonomous Agents Summit 2026',
      description: 'Join premier AI researchers, agent engineers, and tech founders for an intensive one-day deep dive into autonomous cognitive architectures, tool-use reasoning, and real-world deployment patterns. Featuring live technical demos, hands-on architectural workshops, and an evening networking reception with venture partners.',
      image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
      category: 'Technology',
      location: 'Palace of Fine Arts & Innovation Center, San Francisco, CA',
      startDatetime: setHours(addDays(now, 5), 9, 30),
      endDatetime: setHours(addDays(now, 5), 18, 0),
      capacity: 250,
      status: 'Published',
      featured: true,
      tags: ['AI', 'Engineering', 'Founders', 'Autonomous'],
      createdAt: '2026-03-10T14:00:00.000Z'
    },
    {
      id: 'evt_future_ux',
      organizerId: 'usr_alex',
      organizerName: 'Alex Rivera',
      title: 'Design Systems & Spatial UX Masterclass',
      description: 'An interactive design masterclass breaking down the fundamentals of scalable multi-platform design tokens, micro-interactions, and spatial interface guidelines. Attendees will collaborate on building a unified component hierarchy and test prototypes with live user feedback sessions.',
      image: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=1200&q=80',
      category: 'Design',
      location: 'Metropolitan Design Studio, Brooklyn, NY (Hybrid Live Stream)',
      startDatetime: setHours(addDays(now, 8), 13, 0),
      endDatetime: setHours(addDays(now, 8), 17, 30),
      capacity: 80,
      status: 'Published',
      featured: true,
      tags: ['Figma', 'Design Systems', 'UX/UI', 'Spatial'],
      createdAt: '2026-03-12T16:20:00.000Z'
    },
    {
      id: 'evt_indie_founders',
      organizerId: 'usr_sarah',
      organizerName: 'Sarah Chen',
      title: 'Indie Builders & Bootstrappers Breakfast',
      description: 'An informal morning gathering for bootstrapped software founders, indie hackers, and creators. We share transparent revenue metrics, launch roadmaps, growth hacks, and give honest feedback on current MVPs over artisanal coffee and breakfast bagels.',
      image: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80',
      category: 'Business',
      location: 'Blue Bottle Cafe Rooftop, Austin, TX',
      startDatetime: setHours(addDays(now, 2), 8, 30),
      endDatetime: setHours(addDays(now, 2), 11, 0),
      capacity: 35,
      status: 'Published',
      featured: false,
      tags: ['Startup', 'Bootstrapping', 'Networking'],
      createdAt: '2026-03-15T09:00:00.000Z'
    },
    {
      id: 'evt_ambient_sounds',
      organizerId: 'usr_sarah',
      organizerName: 'Sarah Chen',
      title: 'Echoes & Synthesizers: Ambient Acoustic Night',
      description: 'An immersive audio-visual evening experience featuring ambient modular synth performances, generative live visuals, and spatial acoustic installations. Bring your curiosity and unwind in a curated sensory sanctuary.',
      image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
      category: 'Music & Arts',
      location: 'The Subterranean Atrium, Seattle, WA',
      startDatetime: setHours(addDays(now, 12), 20, 0),
      endDatetime: setHours(addDays(now, 12), 23, 30),
      capacity: 120,
      status: 'Published',
      featured: false,
      tags: ['Live Music', 'Ambient', 'Generative Art'],
      createdAt: '2026-03-18T18:00:00.000Z'
    },
    {
      id: 'evt_culinary_lab',
      organizerId: 'usr_alex',
      organizerName: 'Alex Rivera',
      title: 'Fermentation & Modern Gastronomy Lab',
      description: 'Discover the science and craftsmanship behind fermentation, sourdough chemistry, and heirloom botanical infusions. Led by master chefs and food scientists, this hands-on workshop includes tasting pairings and DIY starter cultures to take home.',
      image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
      category: 'Food & Drink',
      location: 'Artisan Culinary Institute, Chicago, IL',
      startDatetime: setHours(addDays(now, 16), 11, 0),
      endDatetime: setHours(addDays(now, 16), 15, 0),
      capacity: 25,
      status: 'Published',
      featured: false,
      tags: ['Food', 'Culinary', 'Workshop', 'Fermentation'],
      createdAt: '2026-03-20T10:15:00.000Z'
    },
    {
      id: 'evt_mindful_morning',
      organizerId: 'usr_sarah',
      organizerName: 'Sarah Chen',
      title: 'Sunrise Breathwork & High-Performance Mindfulness',
      description: 'Ground your mind and energize your biology with guided cold exposure physiology, rhythmic pranayama breathwork, and neuro-acoustic sound meditation overlooking the bay. Suitable for all experience levels.',
      image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80',
      category: 'Wellness',
      location: 'Crissy Field Promenade, San Francisco, CA',
      startDatetime: setHours(addDays(now, 3), 7, 0),
      endDatetime: setHours(addDays(now, 3), 9, 0),
      capacity: 50,
      status: 'Published',
      featured: false,
      tags: ['Wellness', 'Breathwork', 'Mindfulness', 'Morning'],
      createdAt: '2026-03-22T08:00:00.000Z'
    },
    {
      id: 'evt_draft_web3',
      organizerId: 'usr_alex',
      organizerName: 'Alex Rivera',
      title: 'Decentralized Identity & Privacy Protocol Roundtable',
      description: 'A private technical brainstorm session focusing on zero-knowledge identity primitives and self-sovereign credential interoperability.',
      image: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1200&q=80',
      category: 'Technology',
      location: 'Civic Lab Space, Boston, MA',
      startDatetime: setHours(addDays(now, 25), 14, 0),
      endDatetime: setHours(addDays(now, 25), 17, 0),
      capacity: 40,
      status: 'Draft',
      featured: false,
      tags: ['Cryptography', 'Privacy', 'Web3'],
      createdAt: '2026-03-24T12:00:00.000Z'
    },
    {
      id: 'evt_past_hackathon',
      organizerId: 'usr_alex',
      organizerName: 'Alex Rivera',
      title: 'Winter Open Hackathon 2026: Agentic Tools',
      description: 'A 48-hour global sprint building open-source developer tooling and autonomous agent workflows.',
      image: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&w=1200&q=80',
      category: 'Technology',
      location: 'Online / Discord Innovation Hub',
      startDatetime: setHours(addDays(now, -10), 10, 0),
      endDatetime: setHours(addDays(now, -8), 18, 0),
      capacity: 300,
      status: 'Completed',
      featured: false,
      tags: ['Hackathon', 'OpenSource', 'Completed'],
      createdAt: '2026-01-05T09:00:00.000Z'
    }
  ];

  const registrations = [
    {
      id: 'reg_101',
      eventId: 'evt_nextgen_ai',
      userId: 'usr_sarah',
      userName: 'Sarah Chen',
      userEmail: 'sarah@registro.io',
      status: 'confirmed',
      registeredAt: '2026-03-12T15:30:00.000Z',
      ticketCode: 'REG-AI-9481'
    },
    {
      id: 'reg_102',
      eventId: 'evt_nextgen_ai',
      userId: 'usr_marcus',
      userName: 'Marcus Vance',
      userEmail: 'marcus@registro.io',
      status: 'confirmed',
      registeredAt: '2026-03-13T10:10:00.000Z',
      ticketCode: 'REG-AI-8290'
    },
    {
      id: 'reg_103',
      eventId: 'evt_future_ux',
      userId: 'usr_marcus',
      userName: 'Marcus Vance',
      userEmail: 'marcus@registro.io',
      status: 'confirmed',
      registeredAt: '2026-03-14T11:45:00.000Z',
      ticketCode: 'REG-UX-4103'
    },
    {
      id: 'reg_104',
      eventId: 'evt_indie_founders',
      userId: 'usr_alex',
      userName: 'Alex Rivera',
      userEmail: 'alex@registro.io',
      status: 'confirmed',
      registeredAt: '2026-03-16T12:00:00.000Z',
      ticketCode: 'REG-IF-7721'
    },
    {
      id: 'reg_105',
      eventId: 'evt_past_hackathon',
      userId: 'usr_sarah',
      userName: 'Sarah Chen',
      userEmail: 'sarah@registro.io',
      status: 'confirmed',
      registeredAt: '2026-01-10T08:00:00.000Z',
      ticketCode: 'REG-HK-1102'
    }
  ];

  return { users, events, registrations };
}

class Store {
  constructor() {
    this.init();
  }

  init() {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initial = getInitialData();
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
      this.data = initial;
    } else {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        this.data = JSON.parse(raw);
        if (!this.data.users || !this.data.events || !this.data.registrations) {
          throw new Error('Corrupt data structure');
        }
      } catch (err) {
        console.warn('Resetting corrupt DB to defaults:', err.message);
        const initial = getInitialData();
        fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
        this.data = initial;
      }
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('Error persisting database:', err);
    }
  }

  // Users
  getUsers() {
    return this.data.users;
  }

  getUserById(id) {
    return this.data.users.find(u => u.id === id);
  }

  getUserByEmail(email) {
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  createUser(user) {
    this.data.users.push(user);
    this.save();
    return user;
  }

  updateUser(id, updates) {
    const idx = this.data.users.findIndex(u => u.id === id);
    if (idx === -1) return null;
    this.data.users[idx] = { ...this.data.users[idx], ...updates };
    this.save();
    return this.data.users[idx];
  }

  // Events
  getEvents() {
    return this.data.events;
  }

  getEventById(id) {
    return this.data.events.find(e => e.id === id);
  }

  createEvent(event) {
    this.data.events.unshift(event);
    this.save();
    return event;
  }

  updateEvent(id, updates) {
    const idx = this.data.events.findIndex(e => e.id === id);
    if (idx === -1) return null;
    this.data.events[idx] = { ...this.data.events[idx], ...updates };
    this.save();
    return this.data.events[idx];
  }

  getEventsByOrganizerId(organizerId) {
    return this.data.events
      .filter(e => e.organizerId === organizerId)
      .sort((a, b) => new Date(a.startDatetime) - new Date(b.startDatetime));
  }

  deleteEvent(id) {
    const initialLen = this.data.events.length;
    this.data.events = this.data.events.filter(e => e.id !== id);
    this.data.registrations = this.data.registrations.filter(r => r.eventId !== id);
    this.save();
    return this.data.events.length < initialLen;
  }

  cancelEventRegistrations(eventId) {
    let count = 0;
    this.data.registrations.forEach(r => {
      if (r.eventId === eventId && r.status === 'confirmed') {
        r.status = 'cancelled';
        count++;
      }
    });
    if (count > 0) this.save();
    return count;
  }

  // Registrations
  getRegistrations() {
    return this.data.registrations;
  }

  getRegistrationsByEventId(eventId) {
    return this.data.registrations.filter(r => r.eventId === eventId && r.status === 'confirmed');
  }

  getRegistrationsByUserId(userId) {
    return this.data.registrations.filter(r => r.userId === userId && r.status === 'confirmed');
  }

  isRegistered(eventId, userId) {
    return this.data.registrations.some(
      r => r.eventId === eventId && r.userId === userId && r.status === 'confirmed'
    );
  }

  createRegistration(reg) {
    this.data.registrations.push(reg);
    this.save();
    return reg;
  }

  cancelRegistration(eventId, userId) {
    const reg = this.data.registrations.find(
      r => r.eventId === eventId && r.userId === userId && r.status === 'confirmed'
    );
    if (!reg) return false;
    reg.status = 'cancelled';
    this.save();
    return true;
  }
}

module.exports = new Store();
