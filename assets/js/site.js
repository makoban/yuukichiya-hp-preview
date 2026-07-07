const toggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".site-nav");

if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
}

const sourceHolidayCalendars = {
  // Current Jimdo source calendar copied from https://www.yuukichi-ya.com/.
  main: {
    label: "本店",
    months: [
      { year: 2026, month: 6, closed: [2, 9, 16, 23, 30] },
      { year: 2026, month: 7, closed: [7, 14, 21, 28] },
      { year: 2026, month: 8, closed: [4, 7, 8, 9, 10, 11, 12, 13, 14, 15, 18, 25] },
    ],
  },
  takahashi: {
    label: "髙橋店",
    months: [
      { year: 2026, month: 6, closed: [1, 8, 15, 22, 29] },
      { year: 2026, month: 7, closed: [6, 13, 20, 27] },
      { year: 2026, month: 8, closed: [3, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 24, 31] },
    ],
  },
};

const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

const renderMonthCalendar = ({ year, month, closed }) => {
  const closedDays = new Set(closed);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];

  for (let index = 0; index < firstDay; index += 1) {
    cells.push({ day: "", closed: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, closed: closedDays.has(day) });
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

document.querySelectorAll(".shop-calendar-list[data-store-calendar]").forEach((target) => {
  const calendar = sourceHolidayCalendars[target.dataset.storeCalendar];
  if (!calendar) return;

  target.replaceChildren();
  calendar.months.forEach((month) => {
    target.append(renderMonthCalendar(month));
  });
});
