const express = require('express');
const { v4: uuidv4 } = require('uuid');
const store = require('../data/store');
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/auth');

const router = express.Router();

// Supported event statuses
const VALID_STATUSES = ['Draft', 'Published', 'Cancelled', 'Completed'];

// Standardized error response helper matching team contract
function sendError(res, status, code, message) {
  return res.status(status).json({
    code,
    error: {
      code,
      message
    },
    message
  });
}

// Helper to enrich event with registration metadata & contract fields
function enrichEvent(event, currentUserId = null) {
  const registrations = store.getRegistrationsByEventId(event.id);
  const registeredCount = registrations.length;
  const capacity = event.capacity !== undefined ? event.capacity : 100;
  const spotsLeft = capacity === null ? null : Math.max(0, capacity - registeredCount);
  const remainingCapacity = spotsLeft;
  const isSoldOut = capacity !== null && capacity > 0 && spotsLeft === 0;

  let isUserRegistered = false;
  let userRegistration = null;

  if (currentUserId) {
    const reg = registrations.find(r => r.userId === currentUserId);
    if (reg) {
      isUserRegistered = true;
      userRegistration = reg;
    }
  }

  return {
    ...event,
    // Contract fields
    event_id: event.id,
    organizer_id: event.organizerId,
    organizer_name: event.organizerName,
    start_datetime: event.startDatetime,
    end_datetime: event.endDatetime,
    created_at: event.createdAt,
    registration_count: registeredCount,
    remaining_capacity: remainingCapacity,
    // UI convenience fields
    registeredCount,
    spotsLeft,
    isSoldOut,
    isUserRegistered,
    userRegistration
  };
}

// ==========================================
// AHMED'S PART: ORGANIZER EVENT ENDPOINTS
// ==========================================

// GET /api/events/organizer - List all events for authenticated organizer (Ahmed)
router.get('/organizer', authMiddleware, (req, res) => {
  const events = store.getEventsByOrganizerId(req.user.id);
  const enriched = events.map(e => enrichEvent(e, req.user.id));
  res.json(enriched);
});

// GET /api/events/organizer/:id - Get single organizer event in any status for editing (Ahmed)
router.get('/organizer/:id', authMiddleware, (req, res) => {
  const event = store.getEventById(req.params.id);
  if (!event) {
    return sendError(res, 404, 'EVENT_NOT_FOUND', 'Event not found.');
  }

  if (event.organizerId !== req.user.id) {
    return sendError(res, 403, 'FORBIDDEN', 'Only this event\'s organizer can manage it.');
  }

  const enriched = enrichEvent(event, req.user.id);
  enriched.attendees = store.getRegistrationsByEventId(event.id);
  res.json(enriched);
});

// POST /api/events - Create new event (Ahmed)
// Required fields: title, description, location, start_datetime, end_datetime
router.post('/', authMiddleware, (req, res) => {
  const body = req.body || {};

  // Support both camelCase and snake_case inputs
  const title = body.title;
  const description = body.description;
  const location = body.location;
  const startDatetime = body.startDatetime || body.start_datetime;
  const endDatetime = body.endDatetime || body.end_datetime;
  const image = body.image !== undefined ? body.image : null;
  const category = body.category !== undefined ? body.category : null;
  const capacityRaw = body.capacity !== undefined ? body.capacity : null;
  const status = body.status || 'Draft';
  const tags = body.tags;

  // 1. Validate required fields
  if (
    !title || typeof title !== 'string' || !title.trim() ||
    !description || typeof description !== 'string' || !description.trim() ||
    !location || typeof location !== 'string' || !location.trim() ||
    !startDatetime ||
    !endDatetime
  ) {
    return sendError(
      res,
      400,
      'INVALID_INPUT',
      'Missing required event fields: title, description, location, start_datetime, and end_datetime are required.'
    );
  }

  // 2. Validate dates
  const startDate = new Date(startDatetime);
  const endDate = new Date(endDatetime);

  if (isNaN(startDate.getTime())) {
    return sendError(res, 400, 'INVALID_INPUT', 'start_datetime must be a valid ISO 8601 datetime.');
  }
  if (isNaN(endDate.getTime())) {
    return sendError(res, 400, 'INVALID_INPUT', 'end_datetime must be a valid ISO 8601 datetime.');
  }
  if (startDate <= new Date()) {
    return sendError(res, 400, 'INVALID_INPUT', 'start_datetime must be in the future.');
  }
  if (endDate <= startDate) {
    return sendError(res, 400, 'INVALID_INPUT', 'end_datetime must be after start_datetime.');
  }

  // 3. Validate capacity
  let capacity = null;
  if (capacityRaw !== null && capacityRaw !== undefined && capacityRaw !== '') {
    capacity = parseInt(capacityRaw, 10);
    if (isNaN(capacity) || capacity <= 0 || capacity > 2147483647) {
      return sendError(res, 400, 'INVALID_INPUT', 'capacity must be a positive integer or null.');
    }
  }

  // 4. Validate status
  if (!VALID_STATUSES.includes(status)) {
    return sendError(res, 400, 'INVALID_INPUT', `Unsupported event status. Must be one of: ${VALID_STATUSES.join(', ')}.`);
  }

  // Default images by category if none provided
  const defaultImages = {
    Technology: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
    Design: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=1200&q=80',
    Business: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80',
    'Music & Arts': 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
    'Food & Drink': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
    Wellness: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80'
  };

  const selectedCategory = category ? category.trim() : 'Technology';
  const coverImage = image && image.trim() !== '' ? image.trim() : (defaultImages[selectedCategory] || defaultImages.Technology);

  // Authenticated organizer ID is always enforced (never trust client organizer_id)
  const newEvent = {
    id: `evt_${uuidv4().substring(0, 8)}`,
    organizerId: req.user.id,
    organizerName: req.user.name,
    title: title.trim(),
    description: description.trim(),
    location: location.trim(),
    image: coverImage,
    category: selectedCategory,
    startDatetime: startDate.toISOString(),
    endDatetime: endDate.toISOString(),
    capacity,
    status,
    featured: false,
    tags: Array.isArray(tags) ? tags : [selectedCategory],
    createdAt: new Date().toISOString()
  };

  store.createEvent(newEvent);
  const enriched = enrichEvent(newEvent, req.user.id);

  res.status(201).json({
    message: 'Event created successfully!',
    event: enriched
  });
});

// PUT /api/events/:id & PATCH /api/events/:id - Update event (Ahmed)
// Owner-only partial update; capacity cannot fall below active registrations
function handleUpdateEvent(req, res) {
  const event = store.getEventById(req.params.id);
  if (!event) {
    return sendError(res, 404, 'EVENT_NOT_FOUND', 'Event not found.');
  }

  if (event.organizerId !== req.user.id) {
    return sendError(res, 403, 'FORBIDDEN', 'Only this event\'s organizer can manage it.');
  }

  const body = req.body || {};
  const updates = {};

  // Text fields
  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || !body.title.trim()) {
      return sendError(res, 400, 'INVALID_INPUT', 'title must be non-empty text.');
    }
    updates.title = body.title.trim();
  }
  if (body.description !== undefined) {
    if (typeof body.description !== 'string' || !body.description.trim()) {
      return sendError(res, 400, 'INVALID_INPUT', 'description must be non-empty text.');
    }
    updates.description = body.description.trim();
  }
  if (body.location !== undefined) {
    if (typeof body.location !== 'string' || !body.location.trim()) {
      return sendError(res, 400, 'INVALID_INPUT', 'location must be non-empty text.');
    }
    updates.location = body.location.trim();
  }
  if (body.image !== undefined) updates.image = body.image ? body.image.trim() : null;
  if (body.category !== undefined) updates.category = body.category ? body.category.trim() : null;
  if (body.tags !== undefined) updates.tags = Array.isArray(body.tags) ? body.tags : [body.category || 'General'];

  // Datetime fields
  const newStart = body.startDatetime || body.start_datetime;
  const newEnd = body.endDatetime || body.end_datetime;
  const resolvedStart = newStart ? new Date(newStart) : new Date(event.startDatetime);
  const resolvedEnd = newEnd ? new Date(newEnd) : new Date(event.endDatetime);

  if (newStart !== undefined) {
    if (isNaN(resolvedStart.getTime())) {
      return sendError(res, 400, 'INVALID_INPUT', 'start_datetime must be an ISO 8601 datetime.');
    }
    if (resolvedStart <= new Date()) {
      return sendError(res, 400, 'INVALID_INPUT', 'A new start_datetime must be in the future.');
    }
    updates.startDatetime = resolvedStart.toISOString();
  }
  if (newEnd !== undefined) {
    if (isNaN(resolvedEnd.getTime())) {
      return sendError(res, 400, 'INVALID_INPUT', 'end_datetime must be an ISO 8601 datetime.');
    }
    updates.endDatetime = resolvedEnd.toISOString();
  }
  if (resolvedEnd <= resolvedStart) {
    return sendError(res, 400, 'INVALID_INPUT', 'end_datetime must be after start_datetime.');
  }

  // Capacity validation: cannot fall below count of active registered attendees
  const capacityRaw = body.capacity;
  if (capacityRaw !== undefined) {
    const activeCount = store.getRegistrationsByEventId(event.id).length;
    if (capacityRaw === null || capacityRaw === '') {
      updates.capacity = null; // Unlimited capacity
    } else {
      const parsedCapacity = parseInt(capacityRaw, 10);
      if (isNaN(parsedCapacity) || parsedCapacity <= 0 || parsedCapacity > 2147483647) {
        return sendError(res, 400, 'INVALID_INPUT', 'capacity must be a positive integer or null.');
      }
      if (parsedCapacity < activeCount) {
        return sendError(
          res,
          409,
          'CAPACITY_TOO_SMALL',
          `Proposed capacity (${parsedCapacity}) cannot be below active registrations (${activeCount}).`
        );
      }
      updates.capacity = parsedCapacity;
    }
  }

  // Status updates
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return sendError(res, 400, 'INVALID_INPUT', `Unsupported event status: ${body.status}.`);
    }
    updates.status = body.status;

    // Cancelling an event cancels its active registrations
    if (body.status === 'Cancelled' && event.status !== 'Cancelled') {
      store.cancelEventRegistrations(event.id);
    }
  }

  const updated = store.updateEvent(req.params.id, updates);
  const enriched = enrichEvent(updated, req.user.id);

  res.json({
    message: 'Event updated successfully!',
    event: enriched
  });
}

router.put('/:id', authMiddleware, handleUpdateEvent);
router.patch('/:id', authMiddleware, handleUpdateEvent);

// PATCH /api/events/:id/status - Update status shortcut (Ahmed)
router.patch('/:id/status', authMiddleware, (req, res) => {
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    return sendError(res, 400, 'INVALID_INPUT', `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}.`);
  }
  req.body = { status };
  return handleUpdateEvent(req, res);
});

// DELETE /api/events/:id - Delete event (Ahmed)
// Owner-only permanent deletion, cascades to registrations
router.delete('/:id', authMiddleware, (req, res) => {
  const event = store.getEventById(req.params.id);
  if (!event) {
    return sendError(res, 404, 'EVENT_NOT_FOUND', 'Event not found.');
  }

  if (event.organizerId !== req.user.id) {
    return sendError(res, 403, 'FORBIDDEN', 'Only this event\'s organizer can manage it.');
  }

  store.deleteEvent(req.params.id);
  res.json({
    success: true,
    message: 'Event deleted successfully.'
  });
});

// GET /api/events/:id/registrations - Get attendee list for organizer (Ahmed)
router.get('/:id/registrations', authMiddleware, (req, res) => {
  const event = store.getEventById(req.params.id);
  if (!event) {
    return sendError(res, 404, 'EVENT_NOT_FOUND', 'Event not found.');
  }

  if (event.organizerId !== req.user.id) {
    return sendError(res, 403, 'FORBIDDEN', 'Only this event\'s organizer can view attendees.');
  }

  const registrations = store.getRegistrationsByEventId(req.params.id);
  res.json({
    eventId: event.id,
    eventTitle: event.title,
    capacity: event.capacity,
    totalAttendees: registrations.length,
    attendees: registrations
  });
});

// ==========================================
// PUBLIC & ATTENDEE ENDPOINTS
// ==========================================

// GET /api/events - List events with search and filters
router.get('/', optionalAuthMiddleware, (req, res) => {
  const { category, search, dateFilter, organizerId, status, sort } = req.query;
  let events = store.getEvents();

  // If filtering by organizerId
  if (organizerId) {
    events = events.filter(e => e.organizerId === organizerId);
    if (status && status !== 'all') {
      events = events.filter(e => e.status.toLowerCase() === status.toLowerCase());
    }
  } else {
    // Public discovery: only Published events (or Completed if showing past)
    if (!status) {
      events = events.filter(e => e.status === 'Published' || e.status === 'Completed');
    } else if (status !== 'all') {
      events = events.filter(e => e.status.toLowerCase() === status.toLowerCase());
    }
  }

  // Category filter
  if (category && category.toLowerCase() !== 'all') {
    events = events.filter(
      e => e.category && e.category.toLowerCase() === category.toLowerCase()
    );
  }

  // Search keyword (title, description, location, organizer)
  if (search) {
    const q = search.toLowerCase().trim();
    events = events.filter(
      e =>
        (e.title && e.title.toLowerCase().includes(q)) ||
        (e.description && e.description.toLowerCase().includes(q)) ||
        (e.location && e.location.toLowerCase().includes(q)) ||
        (e.organizerName && e.organizerName.toLowerCase().includes(q))
    );
  }

  const now = new Date();

  // Date filter
  if (dateFilter) {
    if (dateFilter === 'today') {
      const todayStr = now.toISOString().slice(0, 10);
      events = events.filter(e => e.startDatetime && e.startDatetime.slice(0, 10) === todayStr);
    } else if (dateFilter === 'this_week') {
      const weekAhead = new Date(now);
      weekAhead.setDate(weekAhead.getDate() + 7);
      events = events.filter(e => {
        const d = new Date(e.startDatetime);
        return d >= now && d <= weekAhead;
      });
    } else if (dateFilter === 'upcoming') {
      events = events.filter(e => new Date(e.startDatetime) >= now);
    } else if (dateFilter === 'past') {
      events = events.filter(e => new Date(e.startDatetime) < now);
    }
  }

  // Enrich with current user registration info and spots
  const currentUserId = req.user ? req.user.id : null;
  let enriched = events.map(e => enrichEvent(e, currentUserId));

  // Sorting
  if (sort === 'popular') {
    enriched.sort((a, b) => b.registeredCount - a.registeredCount);
  } else if (sort === 'newest') {
    enriched.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else {
    // Default: upcoming soonest
    enriched.sort((a, b) => new Date(a.startDatetime) - new Date(b.startDatetime));
  }

  res.json(enriched);
});

// GET /api/events/:id - Get single event detail
router.get('/:id', optionalAuthMiddleware, (req, res) => {
  const event = store.getEventById(req.params.id);
  if (!event) {
    return sendError(res, 404, 'EVENT_NOT_FOUND', 'Event not found.');
  }

  const currentUserId = req.user ? req.user.id : null;
  const isOwner = currentUserId && event.organizerId === currentUserId;

  // Public callers can only view Published events (organizer can view their own Draft/Cancelled)
  if (event.status !== 'Published' && !isOwner) {
    return sendError(res, 409, 'EVENT_NOT_PUBLISHED', 'This event is not published.');
  }

  const enriched = enrichEvent(event, currentUserId);
  if (isOwner) {
    enriched.attendees = store.getRegistrationsByEventId(event.id);
  }

  res.json(enriched);
});

// POST /api/events/:id/register - Register for event
router.post('/:id/register', authMiddleware, (req, res) => {
  const event = store.getEventById(req.params.id);
  if (!event) {
    return sendError(res, 404, 'EVENT_NOT_FOUND', 'Event not found.');
  }

  if (event.status !== 'Published') {
    return sendError(res, 409, 'EVENT_NOT_PUBLISHED', 'This event is not published.');
  }

  const now = new Date();
  if (new Date(event.startDatetime) <= now) {
    return sendError(res, 409, 'EVENT_ALREADY_STARTED', 'This event has already started.');
  }

  // Check if user is already registered
  if (store.isRegistered(event.id, req.user.id)) {
    return sendError(res, 409, 'ALREADY_REGISTERED', 'User is already registered for this event.');
  }

  // Check capacity
  const existing = store.getRegistrationsByEventId(event.id);
  if (event.capacity !== null && event.capacity !== undefined && existing.length >= event.capacity) {
    return sendError(res, 409, 'EVENT_FULL', 'This event is full.');
  }

  const prefix = (event.category || 'REG').substring(0, 3).toUpperCase();
  const ticketCode = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;

  const newRegistration = {
    id: `reg_${uuidv4().substring(0, 8)}`,
    eventId: event.id,
    userId: req.user.id,
    userName: req.user.name,
    userEmail: req.user.email,
    userAvatar: req.user.avatar,
    status: 'confirmed',
    registeredAt: new Date().toISOString(),
    ticketCode
  };

  store.createRegistration(newRegistration);
  const updatedEvent = enrichEvent(event, req.user.id);

  res.status(201).json({
    message: 'Successfully registered for event!',
    registration: newRegistration,
    event: updatedEvent
  });
});

// DELETE /api/events/:id/register - Cancel registration
router.delete('/:id/register', authMiddleware, (req, res) => {
  const event = store.getEventById(req.params.id);
  if (!event) {
    return sendError(res, 404, 'EVENT_NOT_FOUND', 'Event not found.');
  }

  const now = new Date();
  if (new Date(event.startDatetime) <= now) {
    return sendError(res, 409, 'EVENT_ALREADY_STARTED', 'This event has already started.');
  }

  const success = store.cancelRegistration(event.id, req.user.id);
  if (!success) {
    return sendError(res, 404, 'REGISTRATION_NOT_FOUND', 'Registration not found.');
  }

  const updatedEvent = enrichEvent(event, req.user.id);

  res.json({
    message: 'Registration cancelled successfully.',
    event: updatedEvent
  });
});

module.exports = router;
