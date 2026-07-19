const toggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".site-nav");

if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
}

const heroSlider = document.querySelector("[data-hero-slider]");

if (heroSlider) {
  const slides = [...heroSlider.querySelectorAll("[data-hero-slide]")];
  const dots = [...heroSlider.querySelectorAll("[data-hero-dot]")];
  const previousButton = heroSlider.querySelector("[data-hero-prev]");
  const nextButton = heroSlider.querySelector("[data-hero-next]");
  const pauseButton = heroSlider.querySelector("[data-hero-pause]");
  const liveRegion = heroSlider.querySelector("[data-hero-live]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const focusableSelector = "a, button, input, select, textarea, [tabindex]";
  const autoplayDelay = 5000;
  let activeIndex = 0;
  let autoplayTimer;
  let interactionPaused = false;
  let userPaused = reduceMotion.matches;
  let motionOverride = false;
  let touchStartX = 0;
  let touchStartY = 0;

  const setSlideFocusable = (slide, isActive) => {
    slide.querySelectorAll(focusableSelector).forEach((element) => {
      if (isActive) {
        element.removeAttribute("tabindex");
      } else {
        element.setAttribute("tabindex", "-1");
      }
    });
  };

  const getNormalizedIndex = (index) => (index + slides.length) % slides.length;

  const updatePauseButton = () => {
    if (!pauseButton) return;
    const autoplayEnabled = !userPaused && (!reduceMotion.matches || motionOverride);
    pauseButton.setAttribute("aria-label", autoplayEnabled ? "自動再生を停止" : "自動再生を開始");
    const icon = pauseButton.querySelector("span");
    if (icon) icon.textContent = autoplayEnabled ? "Ⅱ" : "▶";
  };

  const showSlide = (index, { announce = true } = {}) => {
    activeIndex = getNormalizedIndex(index);

    slides.forEach((slide, slideIndex) => {
      const isActive = slideIndex === activeIndex;
      slide.classList.toggle("is-active", isActive);
      slide.setAttribute("aria-hidden", String(!isActive));
      setSlideFocusable(slide, isActive);
    });

    dots.forEach((dot, dotIndex) => {
      const isActive = dotIndex === activeIndex;
      dot.classList.toggle("is-active", isActive);
      dot.setAttribute("aria-current", String(isActive));
    });

    const followingSlide = slides[getNormalizedIndex(activeIndex + 1)];
    followingSlide?.querySelectorAll("img").forEach((image) => {
      image.loading = "eager";
    });

    if (announce && liveRegion) {
      liveRegion.textContent = `${activeIndex + 1}枚目 ${slides[activeIndex].dataset.slideLabel}`;
    }
  };

  const stopAutoplay = () => {
    window.clearInterval(autoplayTimer);
    autoplayTimer = undefined;
  };

  const canAutoplay = () => {
    const motionAllowed = !reduceMotion.matches || motionOverride;
    return slides.length > 1 && !userPaused && !interactionPaused && !document.hidden && motionAllowed;
  };

  const startAutoplay = () => {
    stopAutoplay();
    if (!canAutoplay()) return;
    autoplayTimer = window.setInterval(() => {
      showSlide(activeIndex + 1, { announce: false });
    }, autoplayDelay);
  };

  const showManualSlide = (index) => {
    showSlide(index);
    startAutoplay();
  };

  previousButton?.addEventListener("click", () => showManualSlide(activeIndex - 1));
  nextButton?.addEventListener("click", () => showManualSlide(activeIndex + 1));

  dots.forEach((dot) => {
    dot.addEventListener("click", () => showManualSlide(Number(dot.dataset.heroDot)));
  });

  pauseButton?.addEventListener("click", () => {
    if (reduceMotion.matches && userPaused) motionOverride = true;
    userPaused = !userPaused;
    updatePauseButton();
    startAutoplay();
  });

  heroSlider.addEventListener("mouseenter", () => {
    interactionPaused = true;
    stopAutoplay();
  });

  heroSlider.addEventListener("mouseleave", () => {
    interactionPaused = false;
    startAutoplay();
  });

  heroSlider.addEventListener("focusin", () => {
    interactionPaused = true;
    stopAutoplay();
  });

  heroSlider.addEventListener("focusout", (event) => {
    if (heroSlider.contains(event.relatedTarget)) return;
    interactionPaused = false;
    startAutoplay();
  });

  heroSlider.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showManualSlide(activeIndex - 1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      showManualSlide(activeIndex + 1);
    }
  });

  heroSlider.addEventListener("touchstart", (event) => {
    touchStartX = event.changedTouches[0].clientX;
    touchStartY = event.changedTouches[0].clientY;
  }, { passive: true });

  heroSlider.addEventListener("touchend", (event) => {
    const differenceX = event.changedTouches[0].clientX - touchStartX;
    const differenceY = event.changedTouches[0].clientY - touchStartY;
    if (Math.abs(differenceX) < 48 || Math.abs(differenceX) <= Math.abs(differenceY) * 1.2) return;
    showManualSlide(activeIndex + (differenceX < 0 ? 1 : -1));
  }, { passive: true });

  document.addEventListener("visibilitychange", startAutoplay);
  reduceMotion.addEventListener?.("change", () => {
    if (reduceMotion.matches && !motionOverride) userPaused = true;
    updatePauseButton();
    startAutoplay();
  });

  showSlide(0, { announce: false });
  updatePauseButton();
  startAutoplay();
}

const publicCalendarFeedUrl =
  window.yuukichiyaCalendarFeedUrl ||
  "https://kokotomo-sns.bantex.jp/api/public/hp-calendar/yuukichiya/events.json";
const closureTitlePattern = /休業|定休日|臨時休業|夏季休業|冬季休業|年末年始|休み/;
let publicCalendarFeedPromise;

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
const weekdayNames = ["日", "月", "火", "水", "木", "金", "土"];

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

const stripHtml = (value = "") => {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<p[^>]*>/gi, "");
  return wrapper.textContent.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
};

const getDateLabel = (dateKey) => {
  const date = dateKeyToDate(dateKey);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${weekdayNames[date.getDay()]}）`;
};

const getTimeLabel = (event) => {
  if (event.allDay) return "終日";
  if (!event.startText) return "";

  return event.endText ? `${event.startText} - ${event.endText}` : event.startText;
};

const getTimeTextFromValue = (value) => {
  if (!value || !value.includes("T")) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });
};

const buildCalendarEvent = ({
  id,
  title,
  description = "",
  location = "",
  startValue,
  endValue,
  allDay = false,
  source = "google",
}) => {
  const fallbackStartKey = startValue ? startValue.slice(0, 10) : "";
  const dateKeys = getEventDateKeys({
    start: allDay ? { date: startValue } : { dateTime: startValue },
    end: allDay ? { date: endValue } : { dateTime: endValue },
  });

  return {
    id: id || `${source}-${title}-${fallbackStartKey}`,
    title,
    description: stripHtml(description),
    location: stripHtml(location),
    dateKeys,
    allDay,
    source,
    isClosure: closureTitlePattern.test(title),
    startText: getTimeTextFromValue(startValue),
    endText: getTimeTextFromValue(endValue),
  };
};

const getFallbackEvents = (store, months) => {
  const visibleMonthKeys = new Set(months.map(formatMonthKey));
  const events = [];

  months.forEach(({ year, month }) => {
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month - 1, day);
      if (date.getDay() === store.closedWeekday) {
        const dateKey = formatDateKey(date);
        events.push(buildCalendarEvent({
          id: `${store.label}-weekly-${dateKey}`,
          title: "休業日",
          description: `${store.label}の定休日です。`,
          startValue: dateKey,
          endValue: formatDateKey(addDays(date, 1)),
          allDay: true,
          source: "fallback",
        }));
      }
    }
  });

  store.specialClosures.forEach((dateKey) => {
    if (visibleMonthKeys.has(dateKey.slice(0, 7))) {
      events.push(buildCalendarEvent({
        id: `${store.label}-special-${dateKey}`,
        title: "夏季休業",
        description: "夏季休業日です。",
        startValue: dateKey,
        endValue: formatDateKey(addDays(dateKeyToDate(dateKey), 1)),
        allDay: true,
        source: "fallback",
      }));
    }
  });

  return events;
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

const normalizeGoogleEvent = (event) => {
  const allDay = Boolean(event.start?.date);
  const startValue = event.start?.date || event.start?.dateTime;
  const endValue = event.end?.date || event.end?.dateTime;
  if (!startValue) return null;

  return buildCalendarEvent({
    id: event.id,
    title: event.summary || "予定",
    description: event.description || "",
    location: event.location || "",
    startValue,
    endValue,
    allDay,
    source: "google",
  });
};

const fetchPublicCalendarFeed = async () => {
  const response = await fetch(publicCalendarFeedUrl, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Public calendar API error: ${response.status}`);
  }

  const payload = await response.json();
  if (!payload || typeof payload.stores !== "object") {
    throw new Error("Public calendar API returned an invalid payload");
  }
  return payload;
};

const getPublicCalendarFeed = () => {
  if (!publicCalendarFeedPromise) {
    publicCalendarFeedPromise = fetchPublicCalendarFeed();
  }
  return publicCalendarFeedPromise;
};

const fetchPublicCalendarEvents = async (store, months) => {
  const payload = await getPublicCalendarFeed();
  return filterEventsToMonths(
    getSnapshotEntries(payload, store)
      .map(normalizeGoogleEvent)
      .filter(Boolean),
    months,
  );
};

const getPreviewEvents = (store, months) => {
  const previewEvents = window.yuukichiyaCalendarPreviewEvents || {};
  const entries = previewEvents[store.label] || previewEvents[store.calendarId] || [];
  const monthKeys = new Set(months.map(formatMonthKey));

  return entries
    .map(normalizeGoogleEvent)
    .filter(Boolean)
    .filter((event) => event.dateKeys.some((dateKey) => monthKeys.has(dateKey.slice(0, 7))));
};

const getSnapshotEntries = (payload, store) => {
  const stores = payload?.stores || payload || {};
  return stores[store.label] || stores[store.calendarId] || [];
};

const filterEventsToMonths = (events, months) => {
  const monthKeys = new Set(months.map(formatMonthKey));
  return events.filter((event) => event.dateKeys.some((dateKey) => monthKeys.has(dateKey.slice(0, 7))));
};

const fetchSnapshotEvents = async (store, months) => {
  const response = await fetch("assets/data/calendar-events.json", { cache: "no-store" });
  if (!response.ok) return [];

  const payload = await response.json();
  return filterEventsToMonths(
    getSnapshotEntries(payload, store)
      .map(normalizeGoogleEvent)
      .filter(Boolean),
    months,
  );
};

const getDedupedEvents = (events) => {
  const seen = new Set();
  return events.filter((event) => {
    const eventKey = `${event.title}-${event.dateKeys.join(",")}-${getTimeLabel(event)}`;
    if (seen.has(eventKey)) return false;

    seen.add(eventKey);
    return true;
  });
};

const groupEventsByDate = (events) => {
  return events.reduce((groups, event) => {
    event.dateKeys.forEach((dateKey) => {
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey).push(event);
    });

    return groups;
  }, new Map());
};

const sortCalendarEvents = (events) => {
  return events.sort((first, second) => {
    if (first.isClosure !== second.isClosure) return first.isClosure ? -1 : 1;
    if (first.allDay !== second.allDay) return first.allDay ? -1 : 1;
    return getTimeLabel(first).localeCompare(getTimeLabel(second), "ja");
  });
};

const getDayEvents = (eventsByDate, dateKey) => {
  return sortCalendarEvents([...(eventsByDate.get(dateKey) || [])]);
};

const openCalendarDetails = ({ dateKey, events, storeLabel }) => {
  const dialog = document.querySelector(".calendar-detail-dialog");
  if (!dialog) return;

  dialog.querySelector(".calendar-detail-dialog__store").textContent = storeLabel;
  dialog.querySelector(".calendar-detail-dialog__date").textContent = getDateLabel(dateKey);

  const list = dialog.querySelector(".calendar-detail-dialog__list");
  list.replaceChildren();

  events.forEach((event) => {
    const item = document.createElement("li");
    item.className = event.isClosure
      ? "calendar-detail-event is-closure"
      : "calendar-detail-event";

    const title = document.createElement("h4");
    title.textContent = event.title;
    item.append(title);

    const timeLabel = getTimeLabel(event);
    if (timeLabel) {
      const time = document.createElement("p");
      time.className = "calendar-detail-event__meta";
      time.textContent = timeLabel;
      item.append(time);
    }

    if (event.location) {
      const location = document.createElement("p");
      location.className = "calendar-detail-event__meta";
      location.textContent = event.location;
      item.append(location);
    }

    if (event.description) {
      const description = document.createElement("p");
      description.className = "calendar-detail-event__description";
      description.textContent = event.description;
      item.append(description);
    }

    list.append(item);
  });

  dialog.hidden = false;
  dialog.querySelector(".calendar-detail-dialog__close").focus();
};

const closeCalendarDetails = () => {
  const dialog = document.querySelector(".calendar-detail-dialog");
  if (dialog) dialog.hidden = true;
};

const ensureCalendarDetailDialog = () => {
  if (document.querySelector(".calendar-detail-dialog")) return;

  const dialog = document.createElement("div");
  dialog.className = "calendar-detail-dialog";
  dialog.hidden = true;
  dialog.innerHTML = `
    <div class="calendar-detail-dialog__backdrop" data-calendar-detail-close></div>
    <section class="calendar-detail-dialog__panel" role="dialog" aria-modal="true" aria-labelledby="calendar-detail-title">
      <button class="calendar-detail-dialog__close" type="button" data-calendar-detail-close aria-label="予定詳細を閉じる">×</button>
      <p class="calendar-detail-dialog__store"></p>
      <h3 id="calendar-detail-title" class="calendar-detail-dialog__date"></h3>
      <ul class="calendar-detail-dialog__list"></ul>
    </section>
  `;

  dialog.addEventListener("click", (event) => {
    if (event.target.closest("[data-calendar-detail-close]")) {
      closeCalendarDetails();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeCalendarDetails();
  });

  document.body.append(dialog);
};

const renderMonthCalendar = ({ year, month, eventsByDate, storeLabel }) => {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];

  for (let index = 0; index < firstDay; index += 1) {
    cells.push({ day: "", closed: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = formatDateKey(new Date(year, month - 1, day));
    const events = getDayEvents(eventsByDate, dateKey);
    cells.push({
      day,
      dateKey,
      events,
      closed: events.some((event) => event.isClosure),
    });
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
    const item = cell.events?.length ? document.createElement("button") : document.createElement("div");
    const classNames = ["shop-month-calendar__day"];
    if (cell.closed) {
      classNames.push("is-closed");
    } else if (cell.events?.length) {
      classNames.push("has-events");
    }
    item.className = classNames.join(" ");
    item.textContent = "";

    if (cell.day) {
      const number = document.createElement("span");
      number.className = "shop-month-calendar__day-number";
      number.textContent = cell.day;
      item.append(number);
    }

    if (cell.events?.length) {
      const labels = document.createElement("span");
      labels.className = "shop-month-calendar__events";

      cell.events.slice(0, 2).forEach((event) => {
        const label = document.createElement("span");
        label.className = event.isClosure
          ? "shop-month-calendar__event is-closure"
          : "shop-month-calendar__event";
        label.textContent = event.title;
        labels.append(label);
      });

      if (cell.events.length > 2) {
        const more = document.createElement("span");
        more.className = "shop-month-calendar__event-more";
        more.textContent = `+${cell.events.length - 2}`;
        labels.append(more);
      }

      item.append(labels);
      item.type = "button";
      item.setAttribute("aria-label", `${month}月${cell.day}日 ${cell.events.length}件の予定`);
      item.addEventListener("click", () => {
        openCalendarDetails({
          dateKey: cell.dateKey,
          events: cell.events,
          storeLabel,
        });
      });
    }
    if (!cell.day) {
      item.setAttribute("aria-hidden", "true");
    }
    grid.append(item);
  });

  calendar.append(grid);
  return calendar;
};

const renderStoreCalendar = (target, months, events, storeLabel) => {
  const eventsByDate = groupEventsByDate(events);
  target.replaceChildren();
  months.forEach((month) => {
    target.append(renderMonthCalendar({ ...month, eventsByDate, storeLabel }));
  });
};

document.querySelectorAll(".shop-calendar-list[data-store-calendar]").forEach((target) => {
  const store = storeCalendarSettings[target.dataset.storeCalendar];
  if (!store) return;

  ensureCalendarDetailDialog();

  const visibleMonths = getVisibleMonths(getTokyoToday());
  const fallbackEvents = getFallbackEvents(store, visibleMonths);
  const previewEvents = getPreviewEvents(store, visibleMonths);
  const baseEvents = [...fallbackEvents, ...previewEvents];
  renderStoreCalendar(target, visibleMonths, getDedupedEvents(baseEvents), store.label);

  fetchPublicCalendarEvents(store, visibleMonths)
    .then((publicEvents) => {
      renderStoreCalendar(
        target,
        visibleMonths,
        getDedupedEvents([...baseEvents, ...publicEvents]),
        store.label,
      );
      target.dataset.calendarSource = "public-api";
    })
    .catch(() => {
      target.dataset.calendarSource = "snapshot";
      return fetchSnapshotEvents(store, visibleMonths)
        .then((snapshotEvents) => {
          renderStoreCalendar(
            target,
            visibleMonths,
            getDedupedEvents([...baseEvents, ...snapshotEvents]),
            store.label,
          );
        })
        .catch(() => {
          target.dataset.calendarSource = "fallback";
        });
    });
});
