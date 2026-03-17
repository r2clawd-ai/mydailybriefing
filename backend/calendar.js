const fetch = require('node-fetch');

const db = require('./db');
const { refreshGoogleAccessToken } = require('./oauth-google');

const GOOGLE_CALENDAR_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

function getWindowBounds(days = 2) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + days);

  return { start, end };
}

function formatTime(date) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function parseIcsDate(value) {
  if (!value) return null;

  if (/^\d{8}$/.test(value)) {
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(4, 6)) - 1;
    const day = Number(value.slice(6, 8));
    return { date: new Date(year, month, day), isAllDay: true };
  }

  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!match) return null;

  const [, year, month, day, hour, minute, second = '00', zulu] = match;
  const date = zulu
    ? new Date(Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    ))
    : new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    );

  return { date, isAllDay: false };
}

function eventOverlapsWindow(startDate, endDate, windowStart, windowEnd) {
  if (!startDate) return false;
  const effectiveEnd = endDate || startDate;
  return startDate < windowEnd && effectiveEnd > windowStart;
}

function normalizeCalendarEvent({ title, startDate, endDate, location, isAllDay, source }) {
  return {
    title: title || 'Untitled event',
    start: isAllDay ? 'All day' : formatTime(startDate),
    end: isAllDay ? 'All day' : formatTime(endDate || startDate),
    location: location || '',
    isAllDay: Boolean(isAllDay),
    source,
  };
}

async function fetchGoogleCalendarEvents(userToken, user, days) {
  const { start, end } = getWindowBounds(days);

  async function requestEvents(accessToken) {
    const params = new URLSearchParams({
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '50',
    });

    return fetch(`${GOOGLE_CALENDAR_EVENTS_URL}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(10000),
    });
  }

  let response = await requestEvents(user.google_calendar_token);
  if (response.status === 401 && user.google_calendar_refresh_token) {
    const refreshedUser = await refreshGoogleAccessToken(userToken);
    if (!refreshedUser?.google_calendar_token) {
      return null;
    }
    response = await requestEvents(refreshedUser.google_calendar_token);
  }

  if (!response.ok) {
    return null;
  }

  const payload = await response.json().catch(() => ({}));
  const items = Array.isArray(payload.items) ? payload.items : [];

  return items
    .filter((item) => item?.status !== 'cancelled')
    .map((item) => {
      const startValue = item.start?.dateTime || item.start?.date;
      const endValue = item.end?.dateTime || item.end?.date;
      const isAllDay = Boolean(item.start?.date && !item.start?.dateTime);
      const startDate = startValue ? new Date(startValue) : null;
      const endDate = endValue ? new Date(endValue) : null;
      return { item, startDate, endDate, isAllDay };
    })
    .filter(({ startDate, endDate }) => eventOverlapsWindow(startDate, endDate, start, end))
    .map(({ item, startDate, endDate, isAllDay }) => normalizeCalendarEvent({
      title: item.summary,
      startDate,
      endDate,
      location: item.location,
      isAllDay,
      source: 'google',
    }));
}

function parseIcsEvents(icsText) {
  const unfolded = icsText.replace(/\r\n[ \t]/g, '').replace(/\r/g, '\n');
  const blocks = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];

  return blocks.map((block) => {
    const event = {};

    for (const line of block.split('\n')) {
      const separatorIndex = line.indexOf(':');
      if (separatorIndex === -1) continue;
      const rawKey = line.slice(0, separatorIndex);
      const value = line.slice(separatorIndex + 1).trim();
      const key = rawKey.split(';')[0].toUpperCase();
      event[key] = value;
    }

    return event;
  });
}

async function fetchIcsEvents(icsUrl, days) {
  const { start, end } = getWindowBounds(days);
  const response = await fetch(icsUrl, {
    headers: { 'User-Agent': 'BriefingApp/1.0' },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    return [];
  }

  const icsText = await response.text();
  const events = parseIcsEvents(icsText);

  return events
    .map((event) => {
      const parsedStart = parseIcsDate(event.DTSTART);
      const parsedEnd = parseIcsDate(event.DTEND);
      const startDate = parsedStart?.date || null;
      const endDate = parsedEnd?.date || null;
      const isAllDay = parsedStart?.isAllDay || parsedEnd?.isAllDay || false;
      return { event, startDate, endDate, isAllDay };
    })
    .filter(({ startDate, endDate }) => eventOverlapsWindow(startDate, endDate, start, end))
    .map(({ event, startDate, endDate, isAllDay }) => normalizeCalendarEvent({
      title: event.SUMMARY,
      startDate,
      endDate,
      location: event.LOCATION,
      isAllDay,
      source: 'ics',
    }));
}

async function getCalendarEvents(userToken, options = {}) {
  try {
    const days = Number.isInteger(options.days) ? options.days : 2;
    const user = db.getUserByToken(userToken);
    if (!user) {
      return [];
    }

    if (user.google_calendar_token) {
      const googleEvents = await fetchGoogleCalendarEvents(userToken, user, days);
      if (googleEvents) {
        return googleEvents;
      }
    }

    if (user.calendar_ics_url) {
      return await fetchIcsEvents(user.calendar_ics_url, days);
    }

    return [];
  } catch (error) {
    console.error('Calendar fetch error:', error.message);
    return [];
  }
}

module.exports = {
  getCalendarEvents,
};
