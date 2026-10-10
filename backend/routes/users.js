const express = require('express');
const store = require('../data/store');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/users/my-events - Get all registered events for logged-in user
router.get('/my-events', authMiddleware, (req, res) => {
  const registrations = store.getRegistrationsByUserId(req.user.id);
  const now = new Date();

  const userEvents = registrations.map(reg => {
    const event = store.getEventById(reg.eventId);
    return {
      registration: reg,
      event: event || {
        id: reg.eventId,
        title: 'Event no longer available',
        status: 'Cancelled',
        startDatetime: reg.registeredAt
      }
    };
  });

  const upcoming = userEvents.filter(
    item => item.event.startDatetime && new Date(item.event.startDatetime) >= now
  ).sort((a, b) => new Date(a.event.startDatetime) - new Date(b.event.startDatetime));

  const past = userEvents.filter(
    item => item.event.startDatetime && new Date(item.event.startDatetime) < now
  ).sort((a, b) => new Date(b.event.startDatetime) - new Date(a.event.startDatetime));

  res.json({
    total: registrations.length,
    upcoming,
    past
  });
});

// GET /api/users/organizer/dashboard - Stats and events for organizer
router.get('/organizer/dashboard', authMiddleware, (req, res) => {
  const events = store.getEvents().filter(e => e.organizerId === req.user.id);
  
  let totalRegistrations = 0;
  let totalCapacity = 0;

  const enrichedEvents = events.map(event => {
    const attendees = store.getRegistrationsByEventId(event.id);
    const regCount = attendees.length;
    const capacity = event.capacity || 100;
    
    totalRegistrations += regCount;
    totalCapacity += capacity;

    const fillPercentage = capacity > 0 ? Math.round((regCount / capacity) * 100) : 0;

    return {
      ...event,
      registeredCount: regCount,
      spotsLeft: Math.max(0, capacity - regCount),
      fillPercentage,
      attendees: attendees.slice(0, 10) // Preview top 10
    };
  });

  const publishedCount = events.filter(e => e.status === 'Published').length;
  const draftCount = events.filter(e => e.status === 'Draft').length;
  const cancelledCount = events.filter(e => e.status === 'Cancelled').length;

  res.json({
    stats: {
      totalEvents: events.length,
      publishedCount,
      draftCount,
      cancelledCount,
      totalRegistrations,
      totalCapacity,
      averageFillRate: totalCapacity > 0 ? Math.round((totalRegistrations / totalCapacity) * 100) : 0
    },
    events: enrichedEvents
  });
});

module.exports = router;
