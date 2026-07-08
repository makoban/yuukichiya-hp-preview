const toggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".site-nav");

if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
}

const googleCalendarAccess = window.yuukichiyaGoogleCalendarAccess || "";
const closureTitlePattern = /休業|定休日|臨時休業|夏季休業|冬季休業|年末年始|休み/;

const storeCalendarSettings = {
  main: {
    label: "本店",
    calendarId: "77341630b85cb54d7674740dd824782d84acf1290fa743c7ed0689f47fea413e@group.calendar.google.com",
    closedWeekday: 2,
    specialClosures: [
      "2026-08-07",
      "2026-08-08",
      "2026-08-09",
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
      "2026-08-15",
    ],
  },
  takahashi: {
    label: "髙橋店",
    calendarId: "02e7cae3780410d324c3243920d35e65a7554bba73a1af0a401304bde30fbe49@group.calendar.google.com",
    closedWeekday: 1,
    specialClosures: [
      "2026-08-07",
      "2026-08-08",
      "2026-08-09",
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
      "2026-08-15",
    ],
  },
};

const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

const padNumber = (value) => String(value).padStart(2, "0");

const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = padNumber(date.getMonth() + 1);
  const day = padNumber(date.getDate());
  return `${year}-${month}-${day}`;
};

const formatMonthKey = ({ year, month }) => `${year}-${padNumber(month)}`;

const dateKeyToDate = (dateKey) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const getTokyoToday = () => {
  const calendarBaseDate = window.yuukichiyaCalendarBaseDate;
  if (calendarBaseDate) return dateKeyToDate(calendarBaseDate);

  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
};

const addDays = (date, amount) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const getVisibleMonths = (baseDate = new Date(), count = 3) => {
  return Array.from({ length: count }, (_, index) => {
    const monthDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + index, 1);
    return {
      year: monthDate.getFullYear(),
      month: monthDate.getMonth() + 1,
    };
  });
};

const getCalendarTimeRange = (months) => {
  const firstMonth = months[0];
  const lastMonth = months[months.length - 1];
  const start = new Date(firstMonth.year, firstMonth.month - 1, 1);
  const end = new Date(lastMonth.year, lastMonth.month, 1);

  return {
    timeMin: `${formatDateKey(start)}T00:00:00+09:00`,
    timeMax: `${formatDateKey(end)}T00:00:00+09:00`,
  };
};

const getFallbackClosureKeys = (store, months) => {
  const visibleMonthKeys = new Set(months.map(formatMonthKey));
  const closureKeys = new Set();

  months.forEach(({ year, month }) => {
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month - 1, day);
      if (date.getDay() === store.closedWeekday) {
        closureKeys.add(formatDateKey(date));
      }
    }
  });

  store.specialClosures.forEach((dateKey) => {
    if (visibleMonthKeys.has(dateKey.slice(0, 7))) {
      closureKeys.add(dateKey);
    }
  });

  return closureKeys;
};

const getEventDateKeys = (event) => {
  const startValue = event.start?.date || event.start?.dateTime;
  const endValue = event.end?.date || event.end?.dateTime;
  if (!startValue) return [];

  const startKey = startValue.slice(0, 10);
  let endKey = endValue ? endValue.slice(0, 10) : startKey;

  if (!event.end?.date && endKey === startKey) {
    endKey = formatDateKey(addDays(dateKeyToDate(startKey), 1));
  }

  const start = dateKeyToDate(startKey);
  const end = dateKeyToDate(endKey);
  const dateKeys = [];

  if (end <= start) {
    return [startKey];
  }

  for (let date = start; date < end; date = addDays(date, 1)) {
    dateKeys.push(formatDateKey(date));
  }

  return dateKeys;
};

const fetchGoogleClosureKeys = async (store, months) => {
  if (!googleCalendarAccess || !store.calendarId) return new Set();

  const { timeMin, timeMax } = getCalendarTimeRange(months);
  const endpoint = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(store.calendarId)}/events`);
  endpoint.searchParams.set("key", googleCalendarAccess);
  endpoint.searchParams.set("timeMin", timeMin);
  endpoint.searchParams.set("timeMax", timeMax);
  endpoint.searchParams.set("singleEvents", "true");
  endpoint.searchParams.set("orderBy", "startTime");
  endpoint.searchParams.set("timeZone", "Asia/Tokyo");

  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Google Calendar API error: ${response.status}`);
  }

  const payload = await response.json();
  const closureKeys = new Set();

  (payload.items || []).forEach((event) => {
    const title = event.summary || "";
    if (event.status === "cancelled" || !closureTitlePattern.test(title)) return;

    getEventDateKeys(event).forEach((dateKey) => {
      closureKeys.add(dateKey);
    });
  });

  return closureKeys;
};

const renderMonthCalendar = ({ year, month, closureKeys }) => {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];

  for (let index = 0; index < firstDay; index += 1) {
    cells.push({ day: "", closed: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = formatDateKey(new Date(year, month - 1, day));
    cells.push({ day, closed: closureKeys.has(dateKey) });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ day: "", closed: false });
  }

  const calendar = document.createElement("article");
  calendar.className = "shop-month-calendar";

  const title = document.createElement("h4");
  title.textContent = `${year}年${month}月`;
  calendar.append(title);

  const grid = document.createElement("div");
  grid.className = "shop-month-calendar__grid";
  grid.setAttribute("role", "grid");
  grid.setAttribute("aria-label", `${year}年${month}月の営業日カレンダー`);

  weekdays.forEach((weekday) => {
    const item = document.createElement("div");
    item.className = "shop-month-calendar__weekday";
    item.textContent = weekday;
    grid.append(item);
  });

  cells.forEach((cell) => {
    const item = document.createElement("div");
    item.className = cell.closed
      ? "shop-month-calendar__day is-closed"
      : "shop-month-calendar__day";
    item.textContent = cell.day;
    if (cell.closed) {
      item.setAttribute("aria-label", `${month}月${cell.day}日 休業日`);
    }
    if (!cell.day) {
      item.setAttribute("aria-hidden", "true");
    }
    grid.append(item);
  });

  calendar.append(grid);
  return calendar;
};

const renderStoreCalendar = (target, months, closureKeys) => {
  target.replaceChildren();
  months.forEach((month) => {
    target.append(renderMonthCalendar({ ...month, closureKeys }));
  });
};

document.querySelectorAll(".shop-calendar-list[data-store-calendar]").forEach((target) => {
  const store = storeCalendarSettings[target.dataset.storeCalendar];
  if (!store) return;

  const visibleMonths = getVisibleMonths(getTokyoToday());
  const fallbackClosureKeys = getFallbackClosureKeys(store, visibleMonths);
  renderStoreCalendar(target, visibleMonths, fallbackClosureKeys);

  fetchGoogleClosureKeys(store, visibleMonths)
    .then((googleClosureKeys) => {
      if (!googleClosureKeys.size) return;

      renderStoreCalendar(
        target,
        visibleMonths,
        new Set([...fallbackClosureKeys, ...googleClosureKeys]),
      );
    })
    .catch(() => {
      target.dataset.calendarSource = "fallback";
    });
});
