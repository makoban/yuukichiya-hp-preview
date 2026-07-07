const toggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".site-nav");

if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
}

const calendarFrames = document.querySelectorAll(".google-calendar-frame[data-calendar-id]");

const formatCalendarDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
};

calendarFrames.forEach((frame) => {
  const calendarId = frame.dataset.calendarId;
  const offset = Number.parseInt(frame.dataset.monthOffset || "0", 10);
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + offset + 1, 1);
  const monthLabel = `${monthStart.getFullYear()}年${monthStart.getMonth() + 1}月`;

  const params = new URLSearchParams({
    showTitle: "0",
    showNav: "0",
    showDate: "1",
    showPrint: "0",
    showTabs: "0",
    showCalendars: "0",
    showTz: "0",
    mode: "MONTH",
    wkst: "1",
    bgcolor: "#ffffff",
    src: calendarId,
    color: "#2f7d62",
    ctz: "Asia/Tokyo",
    dates: `${formatCalendarDate(monthStart)}/${formatCalendarDate(monthEnd)}`,
  });

  frame.title = `${frame.dataset.calendarTitle || "営業日カレンダー"} ${monthLabel}`;
  frame.src = `https://calendar.google.com/calendar/embed?${params.toString()}`;
});
