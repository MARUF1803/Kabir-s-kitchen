import assert from 'node:assert/strict';
import test from 'node:test';
import {
  restaurantCalendarRange,
  restaurantDateTimeToUtc,
  shiftRestaurantCalendarDate,
  utcToRestaurantDateTimeInput
} from './restaurantTime.js';

test('restaurant-local campaign times convert to UTC and back', () => {
  const utc = restaurantDateTimeToUtc('2026-10-24T00:00', 'Asia/Dhaka');
  assert.equal(utc.toISOString(), '2026-10-23T18:00:00.000Z');
  assert.equal(utcToRestaurantDateTimeInput(utc, 'Asia/Dhaka'), '2026-10-24T00:00');
});

test('calendar day boundaries follow the restaurant timezone', () => {
  const { start, end } = restaurantCalendarRange(
    new Date('2026-10-24T12:00:00.000Z'),
    'day',
    'Asia/Dhaka'
  );
  assert.equal(start.toISOString(), '2026-10-23T18:00:00.000Z');
  assert.equal(end.toISOString(), '2026-10-24T18:00:00.000Z');
});

test('calendar weeks begin Monday in the restaurant timezone', () => {
  const { start, end } = restaurantCalendarRange(
    new Date('2026-10-24T12:00:00.000Z'),
    'week',
    'Asia/Dhaka'
  );
  assert.equal(utcToRestaurantDateTimeInput(start, 'Asia/Dhaka'), '2026-10-19T00:00');
  assert.equal(utcToRestaurantDateTimeInput(end, 'Asia/Dhaka'), '2026-10-26T00:00');
});

test('calendar day ranges account for daylight-saving transitions', () => {
  const { start, end } = restaurantCalendarRange(
    new Date('2026-03-08T16:00:00.000Z'),
    'day',
    'America/New_York'
  );
  assert.equal((end.getTime() - start.getTime()) / 3600000, 23);
});

test('calendar navigation shifts the restaurant-local date', () => {
  const shifted = shiftRestaurantCalendarDate(
    new Date('2026-10-24T12:00:00.000Z'),
    { days: 1 },
    'Asia/Dhaka'
  );
  assert.equal(utcToRestaurantDateTimeInput(shifted, 'Asia/Dhaka'), '2026-10-25T00:00');
});

test('nonexistent local times are rejected instead of silently shifted', () => {
  assert.throws(
    () => restaurantDateTimeToUtc('2026-03-08T02:30', 'America/New_York'),
    /does not exist/
  );
});
