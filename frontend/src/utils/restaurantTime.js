const getParts = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);

  return Object.fromEntries(parts
    .filter(part => part.type !== 'literal')
    .map(part => [part.type, Number(part.value)]));
};

const partsAsUtc = ({ year, month, day, hour = 0, minute = 0, second = 0 }) =>
  Date.UTC(year, month - 1, day, hour, minute, second);

const localDateTimeParts = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value || '');
  if (!match) throw new RangeError('Enter a valid date and time.');
  const [, year, month, day, hour, minute] = match.map(Number);
  const parts = { year, month, day, hour, minute, second: 0 };
  const normalized = new Date(partsAsUtc(parts));
  if (normalized.getUTCFullYear() !== year || normalized.getUTCMonth() + 1 !== month ||
      normalized.getUTCDate() !== day || hour > 23 || minute > 59) {
    throw new RangeError('Enter a valid date and time.');
  }
  return parts;
};

export const restaurantDateTimeToUtc = (value, timeZone) => {
  const target = localDateTimeParts(value);
  const targetAsUtc = partsAsUtc(target);
  let candidate = targetAsUtc;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const observed = getParts(new Date(candidate), timeZone);
    const offset = partsAsUtc(observed) - candidate;
    const adjusted = targetAsUtc - offset;
    if (adjusted === candidate) break;
    candidate = adjusted;
  }

  const observed = getParts(new Date(candidate), timeZone);
  if (observed.year !== target.year || observed.month !== target.month ||
      observed.day !== target.day || observed.hour !== target.hour ||
      observed.minute !== target.minute) {
    throw new RangeError(`The selected time does not exist in ${timeZone}.`);
  }
  return new Date(candidate);
};

export const utcToRestaurantDateTimeInput = (value, timeZone) => {
  if (!value) return '';
  const { year, month, day, hour, minute } = getParts(new Date(value), timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const addCalendarDays = (parts, days) => {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
};

const dateInput = ({ year, month, day }) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00`;

export const restaurantCalendarRange = (date, view, timeZone) => {
  const selected = getParts(date, timeZone);
  let firstDay;
  let nextDay;

  if (view === 'month') {
    firstDay = { year: selected.year, month: selected.month, day: 1 };
    const nextMonth = new Date(Date.UTC(selected.year, selected.month, 1));
    nextDay = { year: nextMonth.getUTCFullYear(), month: nextMonth.getUTCMonth() + 1, day: 1 };
  } else if (view === 'week') {
    const weekday = new Date(Date.UTC(selected.year, selected.month - 1, selected.day)).getUTCDay();
    firstDay = addCalendarDays(selected, -((weekday + 6) % 7));
    nextDay = addCalendarDays(firstDay, 7);
  } else {
    firstDay = { year: selected.year, month: selected.month, day: selected.day };
    nextDay = addCalendarDays(firstDay, 1);
  }

  return {
    start: restaurantDateTimeToUtc(dateInput(firstDay), timeZone),
    end: restaurantDateTimeToUtc(dateInput(nextDay), timeZone)
  };
};

export const shiftRestaurantCalendarDate = (date, { days = 0, months = 0 }, timeZone) => {
  const selected = getParts(date, timeZone);
  const monthStart = new Date(Date.UTC(selected.year, selected.month - 1 + months, 1));
  const year = monthStart.getUTCFullYear();
  const month = monthStart.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const adjustedDay = Math.min(selected.day, lastDay);
  const shifted = addCalendarDays({ year, month, day: adjustedDay }, days);
  return restaurantDateTimeToUtc(dateInput(shifted), timeZone);
};
