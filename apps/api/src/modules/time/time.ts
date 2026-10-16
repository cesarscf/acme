// Visits, Quotes and Charges are stored in UTC and spoken in the Professional's time zone (no Temporal in Bun yet).

export function toInstant(date: string, time: string, timeZone: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wallClock = Date.UTC(year!, month! - 1, day!, hour!, minute!);
  // The offset at the guess can differ from the offset at the answer around a DST change, so it is checked twice.
  const guess = wallClock - offsetAt(wallClock, timeZone);
  return new Date(wallClock - offsetAt(guess, timeZone));
}

export function nextDay(date: string) {
  return addDays(date, 1);
}

export function addDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10);
}

export function localDate(instant: Date, timeZone: string) {
  const { year, month, day } = parts(instant, timeZone);
  return `${year}-${month}-${day}`;
}

export function formatLocalDateTime(instant: Date, timeZone: string) {
  const { weekday, day, month, hour, minute } = parts(instant, timeZone);
  return `${weekday}, ${day}/${month}, às ${hour}:${minute}`;
}

const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function localTime(instant: Date, timeZone: string) {
  const { hour, minute } = parts(instant, timeZone);
  return `${hour}:${minute}`;
}

// "Qua, 14 out", as the prototype names a day.
export function shortDay(instant: Date, timeZone: string) {
  const [year, month, day] = localDate(instant, timeZone).split('-').map(Number);
  const weekday = new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay();
  return `${weekdays[weekday]}, ${String(day).padStart(2, '0')} ${months[month! - 1]}`;
}

// "Seg, 19/10, às 08:00", a time offered to the Professional.
export function formatSlot(instant: Date, timeZone: string) {
  const [year, month, day] = localDate(instant, timeZone).split('-').map(Number);
  const weekday = new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay();
  const dayMonth = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
  return `${weekdays[weekday]}, ${dayMonth}, às ${localTime(instant, timeZone)}`;
}

// "12 ABR", the date of an earlier Job.
export function shortDate(instant: Date, timeZone: string) {
  const [, month, day] = localDate(instant, timeZone).split('-').map(Number);
  return `${String(day).padStart(2, '0')} ${months[month! - 1]!.toUpperCase()}`;
}

// How many local days the instant is before today: 0 today, 1 yesterday, negative ahead.
export function daysAgo(instant: Date, timeZone: string, now = new Date()) {
  const day = (date: Date) => Date.parse(localDate(date, timeZone));
  return Math.round((day(now) - day(instant)) / 86_400_000);
}

function offsetAt(instant: number, timeZone: string) {
  const { year, month, day, hour, minute, second } = parts(new Date(instant), timeZone);
  const asUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour) % 24,
    Number(minute),
    Number(second),
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
}

function parts(instant: Date, timeZone: string) {
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) => formatted.find((part) => part.type === type)!.value;
  return {
    weekday: value('weekday'),
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  };
}
