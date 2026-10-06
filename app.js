const STORAGE_KEY = "college-control-center.tasks";
const SUBJECT_STORAGE_KEY = "college-control-center.subjects";
const SCHEDULE_STORAGE_KEY = "college-control-center.schedule";
const THEME_STORAGE_KEY = "college-control-center.theme";
const TIMER_STORAGE_KEY = "college-control-center.timer";
const CONTACT_ACCESS_KEY = "c7a33ed6-fa8e-42be-add3-76cf18b1f359";
const CONTACT_COOLDOWN_KEY = "college-control-center.contact-last-submit";
const CONTACT_COOLDOWN_MS = 30_000;
const TIMER_DEFAULT_SECONDS = 25 * 60;
const TIMER_MAX_SECONDS = 24 * 60 * 60;
const SUBJECT_COLORS = ["#50bd66", "#4a90d9", "#df8750", "#9a70c5", "#d45b66", "#3a9c9a"];
const TASK_TAG_PRESETS = [
	{ name: "ДЗ", color: "#df8750" },
	{ name: "Самообразование", color: "#4a90d9" },
	{ name: "Работа", color: "#9a70c5" },
];

function normalizeTaskTags(tags) {
	if (!Array.isArray(tags)) return [];
	const seenNames = new Set();
	return tags
		.filter((tag) => tag && typeof tag.name === "string" && typeof tag.color === "string")
		.map((tag) => ({ name: tag.name.trim().slice(0, 40), color: tag.color }))
		.filter((tag) => {
			const normalizedName = tag.name.toLocaleLowerCase("ru-RU");
			if (!tag.name || !/^#[0-9a-f]{6}$/i.test(tag.color) || seenNames.has(normalizedName)) return false;
			seenNames.add(normalizedName);
			return true;
		})
		.slice(0, 20);
}

function loadTimerState() {
	let storedTimer;
	try {
		storedTimer = JSON.parse(localStorage.getItem(TIMER_STORAGE_KEY) ?? "null");
	} catch (error) {
		console.error("Не удалось загрузить состояние таймера из localStorage.", error);
	}
	if (!storedTimer || typeof storedTimer !== "object" || Array.isArray(storedTimer)) {
		return {
			durationSeconds: TIMER_DEFAULT_SECONDS,
			remainingSeconds: TIMER_DEFAULT_SECONDS,
			targetTimestamp: null,
			isRunning: false,
			isFinished: false,
			taskId: "",
			tagName: "",
			completionStatus: "in-progress",
		};
	}

	const durationSeconds = Number.isInteger(storedTimer.durationSeconds)
		&& storedTimer.durationSeconds > 0 && storedTimer.durationSeconds <= TIMER_MAX_SECONDS
		? storedTimer.durationSeconds
		: TIMER_DEFAULT_SECONDS;
	const remainingSeconds = Number.isInteger(storedTimer.remainingSeconds)
		&& storedTimer.remainingSeconds >= 0 && storedTimer.remainingSeconds <= TIMER_MAX_SECONDS
		? storedTimer.remainingSeconds
		: durationSeconds;
	const targetTimestamp = typeof storedTimer.targetTimestamp === "number" && Number.isFinite(storedTimer.targetTimestamp)
		? storedTimer.targetTimestamp
		: null;
	const isRunning = storedTimer.isRunning === true && targetTimestamp !== null;

	return {
		durationSeconds,
		remainingSeconds,
		targetTimestamp,
		isRunning,
		isFinished: storedTimer.isFinished === true && remainingSeconds === 0,
		taskId: typeof storedTimer.taskId === "string" ? storedTimer.taskId : "",
		tagName: typeof storedTimer.tagName === "string" ? storedTimer.tagName : "",
		completionStatus: storedTimer.completionStatus === "done" ? "done" : "in-progress",
	};
}

function loadLastContactSubmission() {
	try {
		const timestamp = Number(localStorage.getItem(CONTACT_COOLDOWN_KEY));
		return Number.isFinite(timestamp) ? timestamp : 0;
	} catch (error) {
		console.error("Не удалось прочитать время последней отправки формы.", error);
		return 0;
	}
}

function createId() {
	return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isValidDateString(value) {
	return typeof value === "string"
		&& /^\d{4}-\d{2}-\d{2}$/.test(value)
		&& getLocalDateString(parseLocalDateString(value)) === value;
}

function loadStoredList(key) {
	try {
		const value = JSON.parse(localStorage.getItem(key) ?? "[]");
		return Array.isArray(value) ? value : [];
	} catch (error) {
		console.error(`Не удалось загрузить данные «${key}» из localStorage.`, error);
		return [];
	}
}

function saveStoredList(key, value) {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch (error) {
		console.error(`Не удалось сохранить данные «${key}» в localStorage.`, error);
	}
}

function applyTheme(theme, savePreference = false) {
	const normalizedTheme = theme === "dark" ? "dark" : "light";
	document.documentElement.dataset.theme = normalizedTheme;
	themeToggle.setAttribute("aria-pressed", String(normalizedTheme === "dark"));
	themeToggle.setAttribute("aria-label", `Включить ${normalizedTheme === "dark" ? "светлую" : "тёмную"} тему`);
	themeColorMeta.content = normalizedTheme === "dark" ? "#101914" : "#18352d";

	if (savePreference) {
		try {
			localStorage.setItem(THEME_STORAGE_KEY, normalizedTheme);
		} catch (error) {
			console.error("Не удалось сохранить тему.", error);
		}
	}
}

function getSavedTheme() {
	try {
		const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
		return savedTheme === "light" || savedTheme === "dark" ? savedTheme : null;
	} catch (error) {
		console.error("Не удалось прочитать выбранную тему.", error);
		return null;
	}
}

function showToast(message) {
	const toast = document.createElement("div");
	toast.className = "toast";
	toast.setAttribute("role", "status");
	const icon = document.createElement("span");
	icon.className = "toast__icon";
	icon.setAttribute("aria-hidden", "true");
	icon.textContent = "✓";
	const text = document.createElement("span");
	text.textContent = message;
	toast.append(icon, text);
	toastRegion.append(toast);
	window.setTimeout(() => {
		toast.classList.add("is-leaving");
		toast.addEventListener("animationend", () => toast.remove(), { once: true });
	}, 2800);
}

function getReminder() {
	const today = getLocalDateString(new Date());
	const tomorrowDate = new Date();
	tomorrowDate.setDate(tomorrowDate.getDate() + 1);
	const tomorrow = getLocalDateString(tomorrowDate);
	const todayTasks = tasks.filter((task) => !task.isCompleted && task.date === today);
	if (todayTasks.length) {
		return {
			title: "Сегодня дедлайн",
			body: todayTasks.map((task) => task.title).join(", "),
			message: `Сегодня дедлайн: ${todayTasks.map((task) => task.title).join(", ")}`,
		};
	}

	const tomorrowCount = tasks.filter((task) => !task.isCompleted && task.date === tomorrow).length;
	if (tomorrowCount) {
		return {
			title: "Задачи на завтра",
			body: `Задач: ${tomorrowCount}`,
			message: `На завтра задач: ${tomorrowCount}`,
		};
	}
	return null;
}

async function showReminderNotification(reminder) {
	const options = {
		body: reminder.body,
		icon: new URL("./icon-192.png", document.baseURI).href,
	};
	if ("serviceWorker" in navigator) {
		try {
			const registration = await navigator.serviceWorker.getRegistration();
			if (registration) {
				await registration.showNotification(reminder.title, options);
				return;
			}
		} catch (error) {
			console.error("Не удалось показать уведомление через Service Worker.", error);
		}
	}

	try {
		new Notification(reminder.title, options);
	} catch (error) {
		console.error("Не удалось показать системное уведомление.", error);
		showToast("Не удалось показать системное уведомление");
	}
}

function renderReminder(showNotification = true) {
	const reminder = getReminder();
	reminderBanner.hidden = !reminder;
	if (!reminder) return;
	reminderMessage.textContent = reminder.message;
	if (showNotification && "Notification" in window && Notification.permission === "granted") {
		showReminderNotification(reminder);
	}
}

function validateBackup(backup) {
	const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
	const hasValidTags = (tags) => {
		if (!Array.isArray(tags) || tags.length > 20) return false;
		const names = new Set();
		return tags.every((tag) => {
			if (!isRecord(tag) || typeof tag.name !== "string" || !tag.name.trim() || tag.name.trim().length > 40
				|| typeof tag.color !== "string" || !/^#[0-9a-f]{6}$/i.test(tag.color)) return false;
			const normalizedName = tag.name.trim().toLocaleLowerCase("ru-RU");
			if (names.has(normalizedName)) return false;
			names.add(normalizedName);
			return true;
		});
	};
	if (!isRecord(backup) || backup.format !== "college-control-center" || backup.version !== 1) {
		throw new Error("Файл не является резервной копией College Control Center версии 1.");
	}
	if (!Array.isArray(backup.tasks) || !Array.isArray(backup.subjects) || !Array.isArray(backup.schedule)) {
		throw new Error("В файле должны быть списки задач, предметов и расписания.");
	}

	const importedTasks = backup.tasks.map((task, index) => {
		if (!isRecord(task)
			|| typeof task.id !== "string" || !task.id
			|| typeof task.title !== "string" || !task.title.trim()
			|| typeof task.date !== "string"
			|| !/^\d{4}-\d{2}-\d{2}$/.test(task.date)
			|| getLocalDateString(parseLocalDateString(task.date)) !== task.date
			|| typeof task.subject !== "string" || !task.subject.trim()
			|| typeof task.description !== "string"
			|| typeof task.isCompleted !== "boolean"
			|| typeof task.isImportant !== "boolean"
			|| (task.tags !== undefined && !hasValidTags(task.tags))
			|| (task.status !== undefined && !["todo", "in-progress", "done"].includes(task.status))
			|| (task.createdAt !== undefined && typeof task.createdAt !== "string")) {
			throw new Error(`Задача №${index + 1} содержит некорректные данные.`);
		}
		return new Task(task);
	});

	const importedSubjects = backup.subjects.map((subject, index) => {
		if (!isRecord(subject)
			|| typeof subject.id !== "string" || !subject.id
			|| typeof subject.name !== "string" || !subject.name.trim()
			|| typeof subject.color !== "string" || !/^#[0-9a-f]{6}$/i.test(subject.color)) {
			throw new Error(`Предмет №${index + 1} содержит некорректные данные.`);
		}
		return { id: subject.id, name: subject.name.trim(), color: subject.color };
	});
	const subjectNames = importedSubjects.map((subject) => subject.name.toLocaleLowerCase("ru-RU"));
	if (new Set(subjectNames).size !== subjectNames.length) {
		throw new Error("В резервной копии есть предметы с одинаковыми названиями.");
	}

	const importedSchedule = backup.schedule.map((entry, index) => {
		if (!isRecord(entry)
			|| typeof entry.id !== "string" || !entry.id
			|| !Number.isInteger(entry.day) || entry.day < 1 || entry.day > 6
			|| typeof entry.time !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(entry.time)
			|| typeof entry.subject !== "string" || !entry.subject.trim()
			|| typeof entry.room !== "string") {
			throw new Error(`Запись расписания №${index + 1} содержит некорректные данные.`);
		}
		return { id: entry.id, day: entry.day, time: entry.time, subject: entry.subject, room: entry.room };
	});

	return { tasks: importedTasks, subjects: importedSubjects, schedule: importedSchedule };
}

function importBackup(backup) {
	const data = validateBackup(backup);
	const storedValues = [
		[STORAGE_KEY, data.tasks],
		[SUBJECT_STORAGE_KEY, data.subjects],
		[SCHEDULE_STORAGE_KEY, data.schedule],
	];
	const previousValues = storedValues.map(([key]) => localStorage.getItem(key));

	try {
		for (const [key, value] of storedValues) {
			localStorage.setItem(key, JSON.stringify(value));
		}
	} catch (error) {
		for (let index = 0; index < storedValues.length; index += 1) {
			try {
				const [key] = storedValues[index];
				const previousValue = previousValues[index];
				if (previousValue === null) localStorage.removeItem(key);
				else localStorage.setItem(key, previousValue);
			} catch (rollbackError) {
				console.error("Не удалось восстановить данные после ошибки импорта.", rollbackError);
			}
		}
		throw new Error(`Не удалось сохранить резервную копию: ${error.message}`);
	}

	tasks.splice(0, tasks.length, ...data.tasks);
	subjects.splice(0, subjects.length, ...data.subjects);
	scheduleEntries.splice(0, scheduleEntries.length, ...data.schedule);
	updateSubjectSelectors();
	renderCalendar();
	renderTasks();
	renderSubjectList();
	renderSchedule();
	renderReminder(false);
}

class Task {
	constructor({
		id = createId(),
		title = "",
		date = "",
		subject = "",
		description = "",
		isCompleted = false,
		isImportant = false,
		tags = [],
		status = isCompleted ? "done" : "todo",
		createdAt = new Date().toISOString(),
	} = {}) {
		this.id = id;
		this.title = title;
		this.date = date;
		this.subject = subject;
		this.description = description;
		this.isCompleted = isCompleted;
		this.isImportant = isImportant;
		this.tags = normalizeTaskTags(tags);
		this.status = isCompleted ? "done" : status === "in-progress" ? "in-progress" : "todo";
		this.createdAt = createdAt;
	}
}

function loadTasks() {
	return loadStoredList(STORAGE_KEY)
		.filter((task) => task && typeof task === "object" && !Array.isArray(task)
			&& typeof task.title === "string" && task.title.trim()
			&& isValidDateString(task.date))
		.map((task) => new Task({
			id: typeof task.id === "string" ? task.id : undefined,
			title: task.title,
			date: task.date,
			subject: typeof task.subject === "string" ? task.subject : "",
			description: typeof task.description === "string" ? task.description : "",
			isCompleted: task.isCompleted === true,
			isImportant: task.isImportant === true,
			tags: task.tags,
			status: ["todo", "in-progress", "done"].includes(task.status) ? task.status : undefined,
			createdAt: typeof task.createdAt === "string" ? task.createdAt : undefined,
		}));
}

function saveTasks() {
	saveStoredList(STORAGE_KEY, tasks);
}

function loadSubjects() {
	return loadStoredList(SUBJECT_STORAGE_KEY)
		.filter((subject) => subject && typeof subject === "object" && typeof subject.name === "string")
		.map((subject, index) => {
			const color = typeof subject.color === "string" && /^#[0-9a-f]{6}$/i.test(subject.color)
				? subject.color
				: SUBJECT_COLORS[index % SUBJECT_COLORS.length];
			return { id: typeof subject.id === "string" ? subject.id : createId(), name: subject.name.trim(), color };
		})
		.filter((subject) => subject.name);
}

function loadScheduleEntries() {
	return loadStoredList(SCHEDULE_STORAGE_KEY)
		.filter((entry) => entry && typeof entry === "object")
		.map((entry) => ({
			id: typeof entry.id === "string" ? entry.id : createId(),
			day: typeof entry.day === "number" || typeof entry.day === "string" ? Number(entry.day) : Number.NaN,
			time: typeof entry.time === "string" ? entry.time : "",
			subject: typeof entry.subject === "string" ? entry.subject : "",
			room: typeof entry.room === "string" ? entry.room : "",
		}))
		.filter((entry) => Number.isInteger(entry.day) && entry.day >= 1 && entry.day <= 6
			&& /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(entry.time));
}

function saveSubjects() {
	saveStoredList(SUBJECT_STORAGE_KEY, subjects);
}

function saveScheduleEntries() {
	saveStoredList(SCHEDULE_STORAGE_KEY, scheduleEntries);
}

function getLocalDateString(date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function parseLocalDateString(dateString) {
	const [year, month, day] = dateString.split("-").map(Number);
	return new Date(year, month - 1, day);
}

const tasks = loadTasks();
const subjects = loadSubjects();
const scheduleEntries = loadScheduleEntries();
const pageViewButtons = [...document.querySelectorAll("[data-view-button]")];
const pageViews = [...document.querySelectorAll("[data-page-view]")];
const subjectList = document.querySelector("#subject-list");
const subjectAddButton = document.querySelector("#subject-add");
const subjectDialog = document.querySelector("#subject-dialog");
const subjectForm = document.querySelector("#subject-form");
const subjectFormTitle = document.querySelector("#subject-dialog-title");
const subjectFormMessage = document.querySelector("#subject-form-message");
const subjectDialogCancel = document.querySelector("#subject-cancel");
const taskAddSubjectButton = document.querySelector("#task-add-subject");
const scheduleGrid = document.querySelector(".schedule-table");
const scheduleDialog = document.querySelector("#schedule-dialog");
const scheduleForm = document.querySelector("#schedule-form");
const scheduleFormTitle = document.querySelector("#schedule-dialog-title");
const scheduleDialogCancel = document.querySelector("#schedule-cancel");
const taskDialogCancel = document.querySelector("#task-cancel");
const themeToggle = document.querySelector("#theme-toggle");
const themeColorMeta = document.querySelector('meta[name="theme-color"]');
const menuOpenButton = document.querySelector("#menu-open");
const menuCloseButton = document.querySelector("#menu-close");
const sidePanel = document.querySelector("#side-panel");
const toastRegion = document.querySelector("#toast-region");
const exportDataButton = document.querySelector("#export-data");
const importDataButton = document.querySelector("#import-data");
const importFileInput = document.querySelector("#import-file");
const notificationButton = document.querySelector("#enable-notifications");
const reminderBanner = document.querySelector("#reminder-banner");
const reminderMessage = document.querySelector("#reminder-message");
const contactDialog = document.querySelector("#contact-dialog");
const contactForm = document.querySelector("#contact-form");
const contactStatus = document.querySelector("#contact-status");
const contactSubmitButton = document.querySelector("#contact-submit");
const contactFields = ["name", "email", "subject", "message"]
	.map((name) => contactForm.elements.namedItem(name));
let lastContactSubmissionAt = loadLastContactSubmission();
let contactCooldownTimer = null;
let isContactSending = false;
for (const dialog of document.querySelectorAll("dialog")) {
	dialog.addEventListener("keydown", (event) => {
		if (event.key !== "Escape") return;
		event.preventDefault();
		dialog.close();
	});
}

function migrateSubjectNames() {
	const knownNames = new Set(subjects.map((subject) => subject.name.toLocaleLowerCase("ru-RU")));
	const legacyNames = [...tasks, ...scheduleEntries]
		.map((item) => item.subject.trim())
		.filter((name) => name && !knownNames.has(name.toLocaleLowerCase("ru-RU")));
	let addedCount = 0;

	for (const name of legacyNames) {
		const normalizedName = name.toLocaleLowerCase("ru-RU");
		if (knownNames.has(normalizedName)) continue;
		subjects.push({
			id: createId(),
			name,
			color: SUBJECT_COLORS[subjects.length % SUBJECT_COLORS.length],
		});
		knownNames.add(normalizedName);
		addedCount += 1;
	}

	if (addedCount) saveSubjects();
}

migrateSubjectNames();
const calendarGrid = document.querySelector("#calendar-grid");
const calendarMonth = document.querySelector("#calendar-month");
const previousMonthButton = document.querySelector("#calendar-previous");
const nextMonthButton = document.querySelector("#calendar-next");
const todayButton = document.querySelector("#calendar-today");
const taskForm = document.querySelector(".task-form");
const taskDialog = document.querySelector(".task-dialog");
const taskDialogTitle = document.querySelector("#task-dialog-title");
const taskList = document.querySelector(".task-list");
const taskViewButtons = [...document.querySelectorAll("[data-task-view]")];
const taskCalendarView = document.querySelector("#task-calendar-view");
const taskBoard = document.querySelector("#task-board");
const taskBoardColumns = [...document.querySelectorAll("[data-task-status]")];
const tasksTitle = document.querySelector("#tasks-title");
const taskSearchInput = document.querySelector("#task-search");
const taskSubjectFilter = document.querySelector("#task-subject-filter");
const taskTagFilter = document.querySelector("#task-tag-filter");
const taskSubjectSelect = document.querySelector("#task-subject");
const scheduleSubjectSelect = document.querySelector("#schedule-subject");
const taskFilterButtons = [...document.querySelectorAll("[data-task-filter]")];
const taskTagOptions = document.querySelector("#task-tag-options");
const taskTagNameInput = document.querySelector("#task-tag-name");
const taskTagColorInput = document.querySelector("#task-tag-color");
const taskTagAddButton = document.querySelector("#task-tag-add");
const timerDisplay = document.querySelector("#timer-display");
const timerClock = document.querySelector("#timer-clock");
const timerCaption = document.querySelector("#timer-caption");
const timerStatus = document.querySelector("#timer-status");
const timerMinutesInput = document.querySelector("#timer-minutes");
const timerSecondsInput = document.querySelector("#timer-seconds");
const timerSetDurationButton = document.querySelector("#timer-set-duration");
const timerTargetSelect = document.querySelector("#timer-target");
const timerCompletionStatus = document.querySelector("#timer-completion-status");
const timerStartButton = document.querySelector("#timer-start");
const timerPauseButton = document.querySelector("#timer-pause");
const timerResetButton = document.querySelector("#timer-reset");
const taskStatistics = {
	total: document.querySelector("#stats-total"),
	completed: document.querySelector("#stats-completed"),
	overdue: document.querySelector("#stats-overdue"),
	deadline: document.querySelector("#stats-deadline"),
};
const addTaskButton = document.querySelector(".add-task-button");
const saveTaskButton = taskForm.querySelector('button[type="submit"]');
const taskFields = ["title", "date", "subject"].map((name) => taskForm.elements.namedItem(name));
const touchedFields = new Set();
const timerState = loadTimerState();
let selectedTaskTags = [];
let timerInterval = null;
let timerHasFinished = timerState.isFinished;
const initialDate = new Date();
let selectedDate = getLocalDateString(initialDate);
let displayedMonth = new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
let activeTaskFilter = "all";
let activeTaskView = "list";
let editingTaskId = null;
let editingSubjectId = null;
let editingScheduleId = null;
let returnToTaskAfterSubjectSave = false;

function saveTimerState() {
	try {
		localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(timerState));
	} catch (error) {
		console.error("Не удалось сохранить состояние таймера.", error);
	}
}

function formatTimerTime(totalSeconds) {
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getTaskTags() {
	const tagsByName = new Map();
	for (const tag of [...TASK_TAG_PRESETS, ...tasks.flatMap((task) => task.tags), ...selectedTaskTags]) {
		const key = tag.name.toLocaleLowerCase("ru-RU");
		if (!tagsByName.has(key)) tagsByName.set(key, tag);
	}
	return [...tagsByName.values()];
}

function renderTaskTagOptions() {
	taskTagOptions.replaceChildren();
	for (const tag of getTaskTags()) {
		const label = document.createElement("label");
		label.className = "task-tag-option";
		const checkbox = document.createElement("input");
		checkbox.type = "checkbox";
		checkbox.checked = selectedTaskTags.some((selectedTag) => selectedTag.name === tag.name);
		checkbox.addEventListener("change", () => {
			if (checkbox.checked) {
				selectedTaskTags = normalizeTaskTags([...selectedTaskTags, tag]);
			} else {
				selectedTaskTags = selectedTaskTags.filter((selectedTag) => selectedTag.name !== tag.name);
			}
		});
		const mark = document.createElement("span");
		mark.className = "task-tag";
		mark.style.setProperty("--tag-color", tag.color);
		mark.textContent = tag.name;
		label.append(checkbox, mark);
		taskTagOptions.append(label);
	}
}

function updateTaskTagFilter() {
	const selectedTag = taskTagFilter.value;
	taskTagFilter.replaceChildren(new Option("Все теги", ""));
	for (const tag of getTaskTags().filter((item) => tasks.some((task) => task.tags.some(
		(taskTag) => taskTag.name.toLocaleLowerCase("ru-RU") === item.name.toLocaleLowerCase("ru-RU"),
	)))) {
		taskTagFilter.append(new Option(tag.name, tag.name));
	}
	if ([...taskTagFilter.options].some((option) => option.value === selectedTag)) {
		taskTagFilter.value = selectedTag;
	}
}

function updateTimerTargetOptions() {
	const selectedValue = timerState.taskId ? `task:${timerState.taskId}` : timerState.tagName ? `tag:${timerState.tagName}` : "";
	timerTargetSelect.replaceChildren(new Option("Без привязки", ""));
	const taskGroup = document.createElement("optgroup");
	taskGroup.label = "Задачи";
	for (const task of tasks) {
		const option = new Option(`${task.title}${task.isCompleted ? " (выполнена)" : ""}`, `task:${task.id}`);
		option.disabled = task.isCompleted && task.id !== timerState.taskId;
		taskGroup.append(option);
	}
	if (timerState.taskId && !tasks.some((task) => task.id === timerState.taskId)) {
		taskGroup.append(new Option("Выбранная задача удалена", selectedValue));
	}
	if (taskGroup.children.length) timerTargetSelect.append(taskGroup);

	const tagGroup = document.createElement("optgroup");
	tagGroup.label = "Категории";
	for (const tag of getTaskTags()) tagGroup.append(new Option(tag.name, `tag:${tag.name}`));
	timerTargetSelect.append(tagGroup);
	timerTargetSelect.value = selectedValue;
}

function updateTimerDurationInputs() {
	timerMinutesInput.value = String(Math.floor(timerState.durationSeconds / 60));
	timerSecondsInput.value = String(timerState.durationSeconds % 60);
}

function renderTimer() {
	if (timerState.isRunning && timerState.targetTimestamp !== null) {
		timerState.remainingSeconds = Math.max(0, Math.ceil((timerState.targetTimestamp - Date.now()) / 1000));
	}
	timerDisplay.textContent = formatTimerTime(timerState.remainingSeconds);
	timerClock.setAttribute("aria-label", `Осталось ${formatTimerTime(timerState.remainingSeconds)}`);
	timerClock.classList.toggle("is-complete", timerHasFinished);
	timerCaption.textContent = timerHasFinished
		? "Фокус-сессия завершена"
		: timerState.isRunning
			? "Идёт фокус-сессия"
			: timerState.remainingSeconds === timerState.durationSeconds
				? "Готов к фокус-сессии"
				: "Таймер на паузе";
	timerStartButton.disabled = timerState.isRunning || timerState.remainingSeconds === 0;
	timerPauseButton.disabled = !timerState.isRunning;
	timerResetButton.disabled = false;
	timerMinutesInput.disabled = timerState.isRunning;
	timerSecondsInput.disabled = timerState.isRunning;
	timerSetDurationButton.disabled = timerState.isRunning;
	timerTargetSelect.disabled = timerState.isRunning;
	timerCompletionStatus.disabled = timerState.isRunning;
	for (const button of document.querySelectorAll("[data-timer-add]")) button.disabled = timerState.isRunning;
}

function finishTimer() {
	if (timerHasFinished) return;
	if (timerInterval !== null) {
		window.clearInterval(timerInterval);
		timerInterval = null;
	}
	timerState.isRunning = false;
	timerState.targetTimestamp = null;
	timerState.remainingSeconds = 0;
	timerState.isFinished = true;
	timerHasFinished = true;

	const task = tasks.find((item) => item.id === timerState.taskId);
	let message = "Фокус-сессия завершена. Отличная работа!";
	if (task && !task.isCompleted) {
		task.isCompleted = timerState.completionStatus === "done";
		task.status = timerState.completionStatus;
		saveTasks();
		renderCalendar();
		renderTasks();
		renderReminder(false);
		message = `Таймер завершён: «${task.title}» — ${timerState.completionStatus === "done" ? "выполнено" : "в работе"}.`;
		if (task.isCompleted) launchConfetti();
	} else if (task?.isCompleted) {
		message = `Таймер завершён. Задача «${task.title}» уже выполнена.`;
	} else if (timerState.taskId) {
		message = "Таймер завершён, но выбранная задача была удалена.";
	} else if (timerState.tagName) {
		message = `Фокус-сессия «${timerState.tagName}» завершена. Отличная работа!`;
	}

	timerStatus.textContent = message;
	saveTimerState();
	renderTimer();
	showToast("Время вышло!");
	if ("Notification" in window && Notification.permission === "granted") {
		try {
			new Notification("Фокус-сессия завершена", { body: message });
		} catch (error) {
			console.error("Не удалось показать уведомление о завершении таймера.", error);
		}
	}
}

function startTimer() {
	if (timerState.remainingSeconds <= 0) {
		timerStatus.textContent = "Нажмите «Сброс», чтобы начать новую сессию.";
		return;
	}
	timerHasFinished = false;
	timerState.isFinished = false;
	timerState.isRunning = true;
	timerState.targetTimestamp = Date.now() + timerState.remainingSeconds * 1000;
	timerStatus.textContent = "";
	saveTimerState();
	renderTimer();
	timerInterval = window.setInterval(() => {
		renderTimer();
		if (timerState.remainingSeconds === 0) finishTimer();
	}, 250);
}

function pauseTimer() {
	if (!timerState.isRunning) return;
	timerState.remainingSeconds = Math.max(0, Math.ceil((timerState.targetTimestamp - Date.now()) / 1000));
	if (timerState.remainingSeconds === 0) {
		finishTimer();
		return;
	}
	timerState.isRunning = false;
	timerState.targetTimestamp = null;
	if (timerInterval !== null) {
		window.clearInterval(timerInterval);
		timerInterval = null;
	}
	saveTimerState();
	renderTimer();
	timerStatus.textContent = "Таймер приостановлен.";
}

function setTimerDuration(totalSeconds) {
	if (!Number.isInteger(totalSeconds) || totalSeconds < 1 || totalSeconds > TIMER_MAX_SECONDS) {
		timerStatus.textContent = "Укажите время от 1 секунды до 24 часов.";
		return false;
	}
	timerState.durationSeconds = totalSeconds;
	timerState.remainingSeconds = totalSeconds;
	timerState.isRunning = false;
	timerState.targetTimestamp = null;
	timerState.isFinished = false;
	timerHasFinished = false;
	timerStatus.textContent = "";
	updateTimerDurationInputs();
	saveTimerState();
	renderTimer();
	return true;
}

function setTimerFromInputs() {
	const minutes = Number(timerMinutesInput.value);
	const seconds = Number(timerSecondsInput.value);
	const totalSeconds = minutes * 60 + seconds;
	if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440
		|| !Number.isInteger(seconds) || seconds < 0 || seconds > 59
		|| totalSeconds < 1 || totalSeconds > TIMER_MAX_SECONDS) {
		timerStatus.textContent = "Введите минуты от 0 до 1440 и секунды от 0 до 59. Общее время — от 1 секунды до 24 часов.";
		return;
	}
	setTimerDuration(totalSeconds);
}

function validateTaskField(field, showError) {
	const value = field.value.trim();
	let message = "";

	if (!value) {
		const labels = {
			title: "Введите название.",
			date: "Выберите дату.",
			subject: "Введите предмет.",
		};
		message = labels[field.name];
	}

	const errorId = `${field.id}-error`;
	let error = document.getElementById(errorId);
	if (!error) {
		error = document.createElement("span");
		error.id = errorId;
		error.className = "field-error";
		error.setAttribute("aria-live", "polite");
		field.insertAdjacentElement("afterend", error);
	}

	if (showError && message) {
		error.textContent = message;
		error.hidden = false;
		field.setAttribute("aria-invalid", "true");
	} else {
		error.textContent = "";
		error.hidden = true;
		field.removeAttribute("aria-invalid");
	}

	field.setAttribute("aria-describedby", errorId);
	return message === "";
}

function updateTaskFormValidation() {
	let formIsValid = true;

	for (const field of taskFields) {
		const isValid = validateTaskField(field, touchedFields.has(field));
		if (!isValid) formIsValid = false;
	}

	saveTaskButton.disabled = !formIsValid;
	return formIsValid;
}

for (const field of taskFields) {
	field.addEventListener("input", () => {
		touchedFields.add(field);
		updateTaskFormValidation();
	});
	field.addEventListener("blur", () => {
		touchedFields.add(field);
		updateTaskFormValidation();
	});
}

taskSearchInput.addEventListener("input", renderTasks);
taskSubjectFilter.addEventListener("change", renderTasks);
taskTagFilter.addEventListener("change", renderTasks);
taskTagAddButton.addEventListener("click", () => {
	const name = taskTagNameInput.value.trim();
	if (!name) {
		taskTagNameInput.focus();
		return;
	}
	const existingTag = getTaskTags().find((tag) => tag.name.toLocaleLowerCase("ru-RU") === name.toLocaleLowerCase("ru-RU"));
	const tag = existingTag ?? { name, color: taskTagColorInput.value };
	if (!selectedTaskTags.some((selectedTag) => selectedTag.name.toLocaleLowerCase("ru-RU") === name.toLocaleLowerCase("ru-RU"))
		&& selectedTaskTags.length >= 20) {
		showToast("К одной задаче можно добавить не более 20 тегов");
		return;
	}
	selectedTaskTags = normalizeTaskTags([...selectedTaskTags, tag]);
	taskTagNameInput.value = "";
	renderTaskTagOptions();
	if (existingTag) showToast(`Тег «${existingTag.name}» выбран`);
});
taskTagNameInput.addEventListener("keydown", (event) => {
	if (event.key === "Enter") {
		event.preventDefault();
		taskTagAddButton.click();
	}
});
for (const button of taskViewButtons) {
	button.addEventListener("click", () => setTaskView(button.dataset.taskView));
}
for (const button of taskFilterButtons) {
	button.addEventListener("click", () => setTaskFilter(button.dataset.taskFilter));
}
timerSetDurationButton.addEventListener("click", setTimerFromInputs);
for (const button of document.querySelectorAll("[data-timer-add]")) {
	button.addEventListener("click", () => {
		const additionalSeconds = Number(button.dataset.timerAdd);
		const nextDuration = Math.min(TIMER_MAX_SECONDS, timerState.durationSeconds + additionalSeconds);
		setTimerDuration(nextDuration);
		if (timerState.durationSeconds === TIMER_MAX_SECONDS) {
			timerStatus.textContent = "Максимальная длительность таймера — 24 часа.";
		}
	});
}
for (const field of [timerMinutesInput, timerSecondsInput]) {
	field.addEventListener("keydown", (event) => {
		if (event.key === "Enter") {
			event.preventDefault();
			setTimerFromInputs();
		}
	});
}
timerTargetSelect.addEventListener("change", () => {
	const [targetType, ...targetParts] = timerTargetSelect.value.split(":");
	timerState.taskId = targetType === "task" ? targetParts.join(":") : "";
	timerState.tagName = targetType === "tag" ? targetParts.join(":") : "";
	saveTimerState();
});
timerCompletionStatus.addEventListener("change", () => {
	timerState.completionStatus = timerCompletionStatus.value;
	saveTimerState();
});
timerStartButton.addEventListener("click", startTimer);
timerPauseButton.addEventListener("click", pauseTimer);
timerResetButton.addEventListener("click", () => {
	if (timerInterval !== null) {
		window.clearInterval(timerInterval);
		timerInterval = null;
	}
	timerState.isRunning = false;
	timerState.isFinished = false;
	timerState.targetTimestamp = null;
	timerState.remainingSeconds = timerState.durationSeconds;
	timerHasFinished = false;
	timerStatus.textContent = "Таймер сброшен.";
	saveTimerState();
	renderTimer();
});

function setTaskView(view) {
	activeTaskView = view;
	for (const button of taskViewButtons) {
		button.setAttribute("aria-pressed", String(button.dataset.taskView === view));
	}
	taskCalendarView.hidden = view !== "calendar";
	taskList.hidden = view === "board";
	taskBoard.hidden = view !== "board";
	renderTasks();
}

function switchPage(pageName) {
	for (const page of pageViews) page.hidden = page.dataset.pageView !== pageName;
	for (const button of pageViewButtons) {
		button.setAttribute("aria-pressed", String(button.dataset.viewButton === pageName));
	}
	addTaskButton.hidden = pageName !== "tasks";
	if (pageName === "subjects") renderSubjectList();
	if (pageName === "schedule") renderSchedule();
	if (pageName === "timer") renderTimer();
}

function closeSidePanel() {
	if (sidePanel.open) sidePanel.close();
}

function getContactCooldownSeconds() {
	return Math.max(0, Math.ceil((lastContactSubmissionAt + CONTACT_COOLDOWN_MS - Date.now()) / 1000));
}

function refreshContactSubmissionTimestamp() {
	try {
		const storedTimestamp = Number(localStorage.getItem(CONTACT_COOLDOWN_KEY));
		if (Number.isFinite(storedTimestamp)) {
			lastContactSubmissionAt = Math.max(lastContactSubmissionAt, storedTimestamp);
		}
	} catch (error) {
		console.error("Не удалось проверить интервал между отправками формы.", error);
	}
}

function updateContactSubmitButton() {
	const remainingSeconds = getContactCooldownSeconds();
	contactSubmitButton.classList.toggle("is-loading", isContactSending);
	contactSubmitButton.disabled = isContactSending || remainingSeconds > 0;
	contactSubmitButton.textContent = isContactSending
		? "Отправка…"
		: remainingSeconds > 0
			? `Повторить через ${remainingSeconds} с`
			: "Отправить сообщение";

	if (remainingSeconds === 0 && contactCooldownTimer !== null) {
		window.clearInterval(contactCooldownTimer);
		contactCooldownTimer = null;
	}
}

function startContactCooldown() {
	updateContactSubmitButton();
	if (contactCooldownTimer === null) {
		contactCooldownTimer = window.setInterval(updateContactSubmitButton, 1000);
	}
}

function validateContactForm() {
	let isValid = true;

	for (const field of contactFields) {
		const value = field.value.trim();
		let message = "";
		if (!value) {
			message = `Заполните поле «${field.labels[0].textContent}».`;
		} else if (field.name === "email" && !field.validity.valid) {
			message = "Введите корректный адрес email.";
		} else if (field.name === "message" && value.length < 10) {
			message = "Сообщение должно содержать не менее 10 символов.";
		} else if (field.name === "name" && value.length > 100) {
			message = "Имя не должно превышать 100 символов.";
		} else if (field.name === "subject" && value.length > 150) {
			message = "Тема не должна превышать 150 символов.";
		} else if (field.name === "message" && value.length > 5000) {
			message = "Сообщение не должно превышать 5000 символов.";
		}

		const errorId = `${field.id}-error`;
		let error = document.getElementById(errorId);
		if (!error) {
			error = document.createElement("span");
			error.id = errorId;
			error.className = "field-error";
			error.setAttribute("aria-live", "polite");
			field.insertAdjacentElement("afterend", error);
		}

		error.textContent = message;
		error.hidden = !message;
		if (message) {
			field.setAttribute("aria-invalid", "true");
			field.setAttribute("aria-describedby", errorId);
			isValid = false;
		} else {
			field.removeAttribute("aria-invalid");
			field.removeAttribute("aria-describedby");
		}
	}

	return isValid;
}

for (const field of contactFields) {
	field.addEventListener("input", () => {
		if (field.hasAttribute("aria-invalid")) validateContactForm();
	});
}

contactForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	contactStatus.textContent = "";
	contactStatus.className = "contact-status";
	if (!validateContactForm()) {
		contactFields.find((field) => field.hasAttribute("aria-invalid"))?.focus();
		return;
	}

	refreshContactSubmissionTimestamp();
	const remainingSeconds = getContactCooldownSeconds();
	if (remainingSeconds > 0) {
		contactStatus.textContent = `Повторно отправить сообщение можно через ${remainingSeconds} с.`;
		startContactCooldown();
		return;
	}

	if (CONTACT_ACCESS_KEY === "ВСТАВЬ_КЛЮЧ") {
		contactStatus.textContent = "Форма пока не настроена: укажите ключ Web3Forms в app.js.";
		contactStatus.classList.add("is-error");
		return;
	}

	isContactSending = true;
	updateContactSubmitButton();
	lastContactSubmissionAt = Date.now();
	try {
		localStorage.setItem(CONTACT_COOLDOWN_KEY, String(lastContactSubmissionAt));
	} catch (error) {
		console.error("Не удалось сохранить интервал защиты формы от повторной отправки.", error);
	}
	startContactCooldown();

	try {
		const response = await fetch("https://api.web3forms.com/submit", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				access_key: CONTACT_ACCESS_KEY,
				name: contactForm.elements.name.value.trim(),
				email: contactForm.elements.email.value.trim(),
				subject: contactForm.elements.subject.value.trim(),
				message: contactForm.elements.message.value.trim(),
				botcheck: "",
			}),
		});
		let result;
		try {
			result = await response.json();
		} catch {
			throw new Error("Сервис вернул некорректный ответ.");
		}
		if (!response.ok || result?.success !== true) {
			throw new Error(typeof result?.message === "string" ? result.message : "Сервис не принял сообщение.");
		}

		contactForm.reset();
		for (const field of contactFields) {
			field.removeAttribute("aria-invalid");
			field.removeAttribute("aria-describedby");
			document.getElementById(`${field.id}-error`)?.remove();
		}
		contactStatus.textContent = "Сообщение отправлено. Спасибо, что связались с нами!";
		contactStatus.classList.add("is-success");
	} catch (error) {
		console.error("Не удалось отправить сообщение через Web3Forms.", error);
		contactStatus.textContent = error instanceof TypeError
			? "Не удалось связаться с сервисом. Проверьте подключение к интернету и попробуйте позже."
			: `Не удалось отправить сообщение: ${error.message}`;
		contactStatus.classList.add("is-error");
	} finally {
		isContactSending = false;
		updateContactSubmitButton();
	}
});

document.querySelector("[data-contact-open]").addEventListener("click", (event) => {
	event.preventDefault();
	closeSidePanel();
	contactDialog.showModal();
});
document.querySelector("#contact-cancel").addEventListener("click", () => contactDialog.close());
contactDialog.addEventListener("close", () => {
	contactForm.reset();
	contactStatus.textContent = "";
	contactStatus.className = "contact-status";
	for (const field of contactFields) {
		field.removeAttribute("aria-invalid");
		field.removeAttribute("aria-describedby");
		document.getElementById(`${field.id}-error`)?.remove();
	}
});
if (getContactCooldownSeconds() > 0) startContactCooldown();

exportDataButton.addEventListener("click", () => {
	const backup = {
		format: "college-control-center",
		version: 1,
		exportedAt: new Date().toISOString(),
		tasks,
		subjects,
		schedule: scheduleEntries,
	};
	const file = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
	const downloadUrl = URL.createObjectURL(file);
	const link = document.createElement("a");
	link.href = downloadUrl;
	link.download = `college-control-center-${getLocalDateString(new Date())}.json`;
	document.body.append(link);
	link.click();
	link.remove();
	window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
	showToast("Резервная копия скачана");
});

importDataButton.addEventListener("click", () => importFileInput.click());
importFileInput.addEventListener("change", async () => {
	const file = importFileInput.files?.[0];
	if (!file) return;
	try {
		const backup = JSON.parse(await file.text());
		importBackup(backup);
		showToast("Задачи, предметы и расписание восстановлены");
	} catch (error) {
		console.error("Не удалось импортировать резервную копию.", error);
		showToast(error instanceof SyntaxError ? "Файл не содержит корректный JSON" : error.message);
	} finally {
		importFileInput.value = "";
	}
});

if ("Notification" in window && Notification.permission === "default") {
	notificationButton.hidden = false;
	notificationButton.addEventListener("click", async () => {
		try {
			const permission = await Notification.requestPermission();
			notificationButton.hidden = true;
			if (permission === "granted") {
				const reminder = getReminder();
				if (reminder) showReminderNotification(reminder);
				showToast("Системные уведомления включены");
			} else if (permission === "denied") {
				showToast("Разрешите уведомления в настройках браузера");
			}
		} catch (error) {
			console.error("Не удалось запросить разрешение на уведомления.", error);
			showToast("Не удалось включить уведомления");
		}
	});
}

if ("serviceWorker" in navigator && window.isSecureContext) {
	navigator.serviceWorker.register("./service-worker.js", { scope: "./" })
		.catch((error) => console.error("Не удалось зарегистрировать Service Worker.", error));
}

const systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
applyTheme(getSavedTheme() ?? (systemThemeQuery.matches ? "dark" : "light"));
themeToggle.addEventListener("click", () => {
	const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
	applyTheme(nextTheme, true);
});
systemThemeQuery.addEventListener("change", (event) => {
	if (!getSavedTheme()) applyTheme(event.matches ? "dark" : "light");
});

menuOpenButton.addEventListener("click", () => {
	sidePanel.showModal();
	menuOpenButton.setAttribute("aria-expanded", "true");
});
menuCloseButton.addEventListener("click", closeSidePanel);
sidePanel.addEventListener("close", () => menuOpenButton.setAttribute("aria-expanded", "false"));
sidePanel.addEventListener("click", (event) => {
	if (event.target === sidePanel) closeSidePanel();
});
for (const link of sidePanel.querySelectorAll("a")) {
	link.addEventListener("click", (event) => {
		const pageName = link.dataset.menuPage;
		if (pageName) {
			event.preventDefault();
			switchPage(pageName);
			if (link.dataset.menuScroll === "#calendar-title") setTaskView("calendar");
		}
		closeSidePanel();
		const scrollTarget = link.dataset.menuScroll;
		if (pageName && scrollTarget) {
			window.setTimeout(() => document.querySelector(scrollTarget)?.scrollIntoView({ behavior: "smooth", block: "start" }), 220);
		}
	});
}

function findSubject(name) {
	return subjects.find((subject) => subject.name === name);
}

function updateSubjectSelect(select, selectedName = select.value, placeholder = "Выберите предмет") {
	select.replaceChildren(new Option(placeholder, ""));
	for (const subject of subjects) {
		const option = new Option(subject.name, subject.name);
		option.style.setProperty("--subject-color", subject.color);
		select.append(option);
	}
	if (subjects.some((subject) => subject.name === selectedName)) select.value = selectedName;
}

function updateSubjectSelectors() {
	const selectedFilterSubject = taskSubjectFilter.value;
	const taskSubject = taskSubjectSelect.value;
	const scheduleSubject = scheduleSubjectSelect.value;
	updateSubjectSelect(taskSubjectFilter, selectedFilterSubject, "Все предметы");
	updateSubjectSelect(taskSubjectSelect, taskSubject);
	updateSubjectSelect(scheduleSubjectSelect, scheduleSubject);
}

function createSubjectColorMark(subject) {
	const mark = document.createElement("span");
	mark.className = "subject-color-mark";
	mark.style.setProperty("--subject-color", subject.color);
	mark.setAttribute("aria-hidden", "true");
	return mark;
}

function renderSubjectList() {
	subjectList.replaceChildren();
	if (subjects.length === 0) {
		const empty = document.createElement("li");
		empty.className = "empty-state";
		empty.textContent = "Предметов пока нет. Добавьте первый, чтобы использовать его в задачах и расписании.";
		subjectList.append(empty);
		return;
	}

	for (const subject of subjects) {
		const item = document.createElement("li");
		item.className = "subject-item";
		const details = document.createElement("div");
		details.className = "subject-item__details";
		details.append(createSubjectColorMark(subject));

		const name = document.createElement("strong");
		name.textContent = subject.name;
		details.append(name);

		const references = tasks.filter((task) => task.subject === subject.name).length
			+ scheduleEntries.filter((entry) => entry.subject === subject.name).length;
		const usage = document.createElement("span");
		usage.className = "subject-item__usage";
		usage.textContent = references ? `Используется: ${references}` : "Не используется";
		details.append(usage);

		const actions = document.createElement("div");
		actions.className = "subject-item__actions";
		actions.append(createTaskAction("Переименовать", "", () => openSubjectDialog(subject.id)));
		actions.append(createTaskAction("Удалить", "task-item__action--delete", () => deleteSubject(subject)));
		item.append(details, actions);
		subjectList.append(item);
	}
}

function openSubjectDialog(subjectId = null, fromTask = false) {
	subjectForm.reset();
	subjectFormMessage.textContent = "";
	editingSubjectId = subjectId;
	returnToTaskAfterSubjectSave = fromTask;
	const subject = subjects.find((item) => item.id === subjectId);
	subjectFormTitle.textContent = subject ? "Переименовать предмет" : "Новый предмет";
	subjectForm.elements.id.value = subject?.id ?? "";
	subjectForm.elements.name.value = subject?.name ?? "";
	subjectForm.elements.color.value = subject?.color ?? SUBJECT_COLORS[subjects.length % SUBJECT_COLORS.length];
	subjectDialog.showModal();
}

function deleteSubject(subject) {
	const affectedTasks = tasks.filter((task) => task.subject === subject.name);
	const affectedLessons = scheduleEntries.filter((entry) => entry.subject === subject.name);
	const isUsed = affectedTasks.length + affectedLessons.length > 0;
	if (subject.name === "Без предмета" && isUsed) {
		window.alert("Сначала назначьте этим задачам и парам другие предметы.");
		return;
	}
	const fallbackName = "Без предмета";
	const confirmation = isUsed
		? `Удалить предмет «${subject.name}»? ${affectedTasks.length + affectedLessons.length} связанных задач и пар будут переназначены на «${fallbackName}».`
		: `Удалить предмет «${subject.name}»?`;
	if (!window.confirm(confirmation)) return;

	if (isUsed) {
		let fallbackSubject = subjects.find((item) => item.name === fallbackName && item.id !== subject.id);
		if (!fallbackSubject) {
			fallbackSubject = { id: createId(), name: fallbackName, color: "#71827a" };
			subjects.push(fallbackSubject);
		}
		for (const task of affectedTasks) task.subject = fallbackName;
		for (const lesson of affectedLessons) lesson.subject = fallbackName;
		saveTasks();
		saveScheduleEntries();
	}

	const index = subjects.findIndex((item) => item.id === subject.id);
	if (index === -1) return;
	subjects.splice(index, 1);
	saveSubjects();
	updateSubjectSelectors();
	renderSubjectList();
	renderTasks();
	renderSchedule();
	showToast(isUsed ? "Предмет удалён, связанные записи сохранены" : "Предмет удалён");
}

function saveSubjectFromForm(event) {
	event.preventDefault();
	const name = subjectForm.elements.name.value.trim();
	const color = subjectForm.elements.color.value;
	if (!name) {
		subjectForm.elements.name.focus();
		return;
	}
	const normalizedName = name.toLocaleLowerCase("ru-RU");
	const duplicate = subjects.find((subject) => subject.id !== editingSubjectId
		&& subject.name.toLocaleLowerCase("ru-RU") === normalizedName);
	if (duplicate) {
		subjectFormMessage.textContent = "Предмет с таким названием уже есть.";
		subjectForm.elements.name.focus();
		return;
	}

	let subject = subjects.find((item) => item.id === editingSubjectId);
	const isEditing = Boolean(subject);
	if (subject) {
		const previousName = subject.name;
		subject.name = name;
		subject.color = color;
		for (const task of tasks) {
			if (task.subject === previousName) task.subject = name;
		}
		for (const entry of scheduleEntries) {
			if (entry.subject === previousName) entry.subject = name;
		}
		saveTasks();
		saveScheduleEntries();
	} else {
		subject = { id: createId(), name, color };
		subjects.push(subject);
	}

	saveSubjects();
	updateSubjectSelectors();
	if (returnToTaskAfterSubjectSave && taskDialog.open) {
		taskSubjectSelect.value = subject.name;
		updateTaskFormValidation();
	}
	subjectDialog.close();
	renderSubjectList();
	renderCalendar();
	renderTasks();
	renderReminder(false);
	renderSchedule();
	showToast(isEditing ? "Предмет обновлён" : "Предмет добавлен");
}

for (const button of pageViewButtons) {
	button.addEventListener("click", () => switchPage(button.dataset.viewButton));
}
subjectAddButton.addEventListener("click", () => openSubjectDialog());
taskAddSubjectButton.addEventListener("click", () => openSubjectDialog(null, true));
subjectForm.addEventListener("submit", saveSubjectFromForm);
subjectDialogCancel.addEventListener("click", () => subjectDialog.close());
subjectDialog.addEventListener("close", () => {
	subjectForm.reset();
	subjectFormMessage.textContent = "";
	editingSubjectId = null;
	returnToTaskAfterSubjectSave = false;
});
taskSubjectSelect.addEventListener("change", updateTaskFormValidation);

function renderSchedule() {
	for (const cell of scheduleGrid.querySelectorAll("[data-schedule-day]")) {
		const day = Number(cell.dataset.scheduleDay);
		cell.replaceChildren();
		const dayLessons = scheduleEntries
			.filter((entry) => entry.day === day)
			.sort((first, second) => first.time.localeCompare(second.time));

		if (dayLessons.length === 0) {
			const empty = document.createElement("p");
			empty.className = "schedule-day__empty";
		empty.textContent = "Пар пока нет";
		cell.append(empty);
		}

		const lessonList = document.createElement("ul");
		lessonList.className = "schedule-day__lessons";
		for (const lesson of dayLessons) {
			const item = document.createElement("li");
			item.className = "schedule-lesson";
			const subject = findSubject(lesson.subject);
			if (subject) item.style.setProperty("--subject-color", subject.color);
			const heading = document.createElement("div");
			heading.className = "schedule-lesson__heading";
			const time = document.createElement("time");
			time.textContent = lesson.time;
			const name = document.createElement("strong");
			name.textContent = lesson.subject;
			heading.append(time, name);
			item.append(heading);

			if (lesson.room) {
				const room = document.createElement("span");
				room.className = "schedule-lesson__room";
				room.textContent = `Ауд. ${lesson.room}`;
				item.append(room);
			}

			const actions = document.createElement("div");
			actions.className = "schedule-lesson__actions";
			actions.append(createTaskAction("Изменить", "", () => openScheduleDialog(lesson.id)));
			actions.append(createTaskAction("Удалить", "task-item__action--delete", () => deleteScheduleEntry(lesson)));
			item.append(actions);
			lessonList.append(item);
		}
		if (dayLessons.length) cell.append(lessonList);

		const addButton = document.createElement("button");
		addButton.type = "button";
		addButton.className = "schedule-day__add";
		addButton.textContent = "+ Добавить пару";
		addButton.addEventListener("click", () => openScheduleDialog(null, day));
		cell.append(addButton);
	}
}

function openScheduleDialog(scheduleId = null, day = 1) {
	if (subjects.length === 0) {
		window.alert("Сначала добавьте предмет.");
		switchPage("subjects");
		return;
	}
	scheduleForm.reset();
	updateSubjectSelect(scheduleSubjectSelect, "");
	editingScheduleId = scheduleId;
	const lesson = scheduleEntries.find((entry) => entry.id === scheduleId);
	scheduleFormTitle.textContent = lesson ? "Редактировать пару" : "Новая пара";
	scheduleForm.elements.id.value = lesson?.id ?? "";
	scheduleForm.elements.day.value = String(lesson?.day ?? day);
	scheduleForm.elements.time.value = lesson?.time ?? "";
	scheduleForm.elements.subject.value = lesson?.subject ?? "";
	scheduleForm.elements.room.value = lesson?.room ?? "";
	scheduleDialog.showModal();
}

function deleteScheduleEntry(lesson) {
	if (!window.confirm(`Удалить пару «${lesson.subject}» в ${lesson.time}?`)) return;
	const index = scheduleEntries.findIndex((entry) => entry.id === lesson.id);
	if (index === -1) return;
	scheduleEntries.splice(index, 1);
	saveScheduleEntries();
	renderSchedule();
	renderSubjectList();
	showToast("Пара удалена");
}

scheduleForm.addEventListener("submit", (event) => {
	event.preventDefault();
	if (!scheduleForm.reportValidity()) return;
	const lessonData = {
		day: Number(scheduleForm.elements.day.value),
		time: scheduleForm.elements.time.value,
		subject: scheduleForm.elements.subject.value,
		room: scheduleForm.elements.room.value.trim(),
	};
	const lesson = scheduleEntries.find((entry) => entry.id === editingScheduleId);
	const isEditing = Boolean(lesson);
	if (lesson) Object.assign(lesson, lessonData);
	else scheduleEntries.push({ id: createId(), ...lessonData });
	saveScheduleEntries();
	scheduleDialog.close();
	renderSchedule();
	renderSubjectList();
	showToast(isEditing ? "Пара обновлена" : "Пара добавлена в расписание");
});

scheduleDialogCancel.addEventListener("click", () => scheduleDialog.close());
scheduleDialog.addEventListener("close", () => {
	scheduleForm.reset();
	editingScheduleId = null;
	scheduleFormTitle.textContent = "Новая пара";
});

function createTaskElement(task) {
	const item = document.createElement("li");
	item.className = "task-item";
	item.dataset.taskId = task.id;
	if (task.isCompleted) item.classList.add("is-completed");
	if (!task.isCompleted && task.date < getLocalDateString(new Date())) {
		item.classList.add("is-overdue");
	}

	const content = document.createElement("div");
	content.className = "task-item__content";

	const title = document.createElement("h3");
	title.className = "task-item__title";
	title.textContent = task.title;

	const meta = document.createElement("p");
	meta.className = "task-item__meta";
	meta.textContent = task.date;

	const subject = findSubject(task.subject);
	const subjectLabel = document.createElement("span");
	subjectLabel.className = "task-item__subject";
	if (subject) subjectLabel.style.setProperty("--subject-color", subject.color);
	subjectLabel.textContent = task.subject || "Без предмета";

	content.append(title, subjectLabel, meta);
	if (task.tags.length) {
		const tags = document.createElement("div");
		tags.className = "task-item__tags";
		for (const tag of task.tags) {
			const tagChip = document.createElement("span");
			tagChip.className = "task-tag";
			tagChip.style.setProperty("--tag-color", tag.color);
			tagChip.textContent = tag.name;
			tags.append(tagChip);
		}
		content.append(tags);
	}

	if (task.description) {
		const description = document.createElement("p");
		description.className = "task-item__description";
		description.textContent = task.description;
		content.append(description);
	}

	item.append(content);

	const footer = document.createElement("div");
	footer.className = "task-item__footer";
	const badges = document.createElement("div");
	badges.className = "task-item__badges";

	if (task.isImportant) {
		const importance = document.createElement("span");
		importance.className = "task-item__importance";
		importance.textContent = "Важная";
		badges.append(importance);
	}

	if (item.classList.contains("is-overdue")) {
		const overdue = document.createElement("span");
		overdue.className = "task-item__overdue";
		overdue.textContent = "Просрочена";
		badges.append(overdue);
	}

	const actions = document.createElement("div");
	actions.className = "task-item__actions";
	const statusButton = createTaskAction(
		task.status === "in-progress" ? "Вернуть в список" : "Начать выполнение",
		"task-item__action--status",
		() => {
			task.status = task.status === "in-progress" ? "todo" : "in-progress";
			saveTasks();
			renderTasks();
		},
	);
	actions.append(statusButton);
	const completeLabel = document.createElement("label");
	completeLabel.className = "task-item__complete";
	const completeCheckbox = document.createElement("input");
	completeCheckbox.type = "checkbox";
	completeCheckbox.checked = task.isCompleted;
	completeCheckbox.addEventListener("change", () => {
		task.isCompleted = completeCheckbox.checked;
		task.status = task.isCompleted ? "done" : "todo";
		saveTasks();
		renderReminder(false);
		updateTaskStatistics();
		if (task.isCompleted) {
			completeCheckbox.disabled = true;
			item.classList.add("is-completing");
			launchConfetti();
			const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
			window.setTimeout(renderTasks, reducedMotion ? 20 : 520);
		} else {
			renderTasks();
		}
		showToast(task.isCompleted ? "Задача выполнена" : "Задача возвращена в активные");
	});
	completeLabel.append(completeCheckbox, document.createTextNode("Выполнено"));
	actions.append(completeLabel);
	statusButton.hidden = task.isCompleted;
	actions.append(createTaskAction("Редактировать", "", () => openTaskDialog(task.id)));
	actions.append(createTaskAction("Удалить", "task-item__action--delete", () => {
		if (!window.confirm(`Удалить задачу «${task.title}»?`)) return;
		const removeTask = () => {
			const taskIndex = tasks.findIndex((itemTask) => itemTask.id === task.id);
			if (taskIndex === -1) return;
			tasks.splice(taskIndex, 1);
			saveTasks();
			renderCalendar();
			renderTasks();
			renderReminder(false);
			renderSubjectList();
			showToast("Задача удалена");
		};
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			removeTask();
		} else {
			item.classList.add("is-removing");
			window.setTimeout(removeTask, 200);
		}
	}));

	footer.append(badges, actions);
	item.append(footer);
	return item;
}

function createTaskAction(label, modifier, onClick) {
	const button = document.createElement("button");
	button.type = "button";
	button.className = `task-item__action ${modifier}`.trim();
	button.textContent = label;
	button.addEventListener("click", onClick);
	return button;
}

function launchConfetti() {
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

	const canvas = document.createElement("canvas");
	const context = canvas.getContext("2d");
	if (!context) {
		console.warn("Не удалось запустить конфетти: Canvas 2D недоступен.");
		return;
	}

	const pixelRatio = window.devicePixelRatio || 1;
	const resizeCanvas = () => {
		canvas.width = window.innerWidth * pixelRatio;
		canvas.height = window.innerHeight * pixelRatio;
		canvas.style.width = `${window.innerWidth}px`;
		canvas.style.height = `${window.innerHeight}px`;
		context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
	};
	canvas.className = "confetti-canvas";
	canvas.setAttribute("aria-hidden", "true");
	resizeCanvas();
	document.body.append(canvas);
	window.addEventListener("resize", resizeCanvas);

	const colors = ["#50bd66", "#9adc83", "#f4ce65", "#f28c68", "#73b8e8"];
	const particles = Array.from({ length: 100 }, () => ({
		x: Math.random() * window.innerWidth,
		y: -Math.random() * window.innerHeight * 0.35,
		vx: (Math.random() - 0.5) * 5,
		vy: Math.random() * 3 + 2,
		width: Math.random() * 7 + 4,
		height: Math.random() * 5 + 3,
		rotation: Math.random() * Math.PI * 2,
		spin: (Math.random() - 0.5) * 0.18,
		color: colors[Math.floor(Math.random() * colors.length)],
	}));
	const startedAt = performance.now();

	function drawConfetti(now) {
		context.clearRect(0, 0, window.innerWidth, window.innerHeight);
		for (const particle of particles) {
			particle.x += particle.vx;
			particle.y += particle.vy;
			particle.vy += 0.045;
			particle.rotation += particle.spin;
			context.save();
			context.translate(particle.x, particle.y);
			context.rotate(particle.rotation);
			context.fillStyle = particle.color;
			context.fillRect(-particle.width / 2, -particle.height / 2, particle.width, particle.height);
			context.restore();
		}

		if (now - startedAt < 1800) {
			window.requestAnimationFrame(drawConfetti);
		} else {
			window.removeEventListener("resize", resizeCanvas);
			canvas.remove();
		}
	}

	window.requestAnimationFrame(drawConfetti);
}

function renderCalendar() {
	const year = displayedMonth.getFullYear();
	const month = displayedMonth.getMonth();
	const monthLabel = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(displayedMonth);
	calendarMonth.textContent = `${monthLabel[0].toLocaleUpperCase("ru-RU")}${monthLabel.slice(1)}`;
	calendarGrid.replaceChildren();

	const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
	const daysInMonth = new Date(year, month + 1, 0).getDate();
	const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
	const today = getLocalDateString(new Date());
	const tasksByDate = new Map();

	for (const task of tasks) {
		if (!tasksByDate.has(task.date)) tasksByDate.set(task.date, []);
		tasksByDate.get(task.date).push(task);
	}

	for (let index = 0; index < cellCount; index += 1) {
		const date = new Date(year, month, 1 - firstWeekday + index);
		const dateString = getLocalDateString(date);
		const dayTasks = tasksByDate.get(dateString) ?? [];
		const dayButton = document.createElement("button");
		dayButton.type = "button";
		dayButton.className = "calendar__day";
		dayButton.textContent = String(date.getDate());
		dayButton.setAttribute("aria-pressed", String(dateString === selectedDate));

		if (dateString === selectedDate) dayButton.classList.add("is-selected");
		if (dateString === today) dayButton.classList.add("is-today");
		if (date.getMonth() !== month) dayButton.classList.add("is-outside-month");

		const formattedDate = new Intl.DateTimeFormat("ru-RU", {
			weekday: "long",
			day: "numeric",
			month: "long",
			year: "numeric",
		}).format(date);
		const taskCountLabel = dayTasks.length ? `, задач: ${dayTasks.length}` : "";
		dayButton.setAttribute("aria-label", `${formattedDate}${taskCountLabel}`);

		const hasImportantTasks = dayTasks.some((task) => task.isImportant);
		const hasRegularTasks = dayTasks.some((task) => !task.isImportant);
		if (hasImportantTasks || hasRegularTasks) {
			const markers = document.createElement("span");
			markers.className = "calendar__markers";
			markers.setAttribute("aria-hidden", "true");
			if (hasImportantTasks) {
				const marker = document.createElement("i");
				marker.className = "calendar__dot calendar__dot--important";
				markers.append(marker);
			}
			if (hasRegularTasks) {
				const marker = document.createElement("i");
				marker.className = "calendar__dot calendar__dot--regular";
				markers.append(marker);
			}
			dayButton.append(markers);
		}

		dayButton.addEventListener("click", () => {
			selectedDate = dateString;
			displayedMonth = new Date(date.getFullYear(), date.getMonth(), 1);
			renderCalendar();
			setTaskFilter("day");
		});
		calendarGrid.append(dayButton);
	}
}

function changeMonth(offset) {
	const selectedDay = parseLocalDateString(selectedDate).getDate();
	displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + offset, 1);
	const year = displayedMonth.getFullYear();
	const month = displayedMonth.getMonth();
	const day = Math.min(selectedDay, new Date(year, month + 1, 0).getDate());
	selectedDate = getLocalDateString(new Date(year, month, day));
	renderCalendar();
	renderTasks();
}

function setTaskFilter(filter) {
	activeTaskFilter = filter;
	for (const button of taskFilterButtons) {
		button.setAttribute("aria-pressed", String(button.dataset.taskFilter === filter));
	}

	if (filter === "today" || filter === "week") {
		const today = new Date();
		selectedDate = getLocalDateString(today);
		displayedMonth = new Date(today.getFullYear(), today.getMonth(), 1);
		renderCalendar();
	}

	renderTasks();
}

function updateTaskStatistics() {
	const today = getLocalDateString(new Date());
	const completedTasks = tasks.filter((task) => task.isCompleted);
	const overdueTasks = tasks.filter((task) => !task.isCompleted && task.date < today);
	const upcomingTasks = tasks
		.filter((task) => !task.isCompleted && task.date >= today)
		.sort((first, second) => first.date.localeCompare(second.date));

	taskStatistics.total.textContent = String(tasks.length);
	taskStatistics.completed.textContent = String(completedTasks.length);
	taskStatistics.overdue.textContent = String(overdueTasks.length);
	taskStatistics.deadline.textContent = upcomingTasks.length
		? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(parseLocalDateString(upcomingTasks[0].date))
		: "Нет";
}

function renderTasks() {
	taskList.replaceChildren();
	for (const column of taskBoardColumns) column.replaceChildren();
	updateTaskStatistics();
	updateSubjectSelectors();
	updateTaskTagFilter();
	updateTimerTargetOptions();
	const todayDate = new Date();
	const today = getLocalDateString(todayDate);
	const weekEndDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() + 6);
	const weekEnd = getLocalDateString(weekEndDate);
	const searchTerm = taskSearchInput.value.trim().toLocaleLowerCase("ru-RU");
	const selectedSubject = taskSubjectFilter.value;
	const selectedTag = taskTagFilter.value;
	const visibleTasks = tasks.filter((task) => {
		if (selectedSubject && task.subject.trim() !== selectedSubject) return false;
		if (selectedTag && !task.tags.some((tag) => tag.name.toLocaleLowerCase("ru-RU") === selectedTag.toLocaleLowerCase("ru-RU"))) return false;
		if (searchTerm && !`${task.title} ${task.description}`.toLocaleLowerCase("ru-RU").includes(searchTerm)) return false;

		switch (activeTaskFilter) {
			case "day": return task.date === selectedDate;
			case "today": return task.date === today;
			case "week": return task.date >= today && task.date <= weekEnd;
			case "important": return task.isImportant;
			case "completed": return task.isCompleted;
			case "overdue": return !task.isCompleted && task.date < today;
			default: return true;
		}
	});
	const selectedDateLabel = new Intl.DateTimeFormat("ru-RU", {
		day: "numeric",
		month: "long",
		year: "numeric",
	}).format(parseLocalDateString(selectedDate));
	const headings = {
		all: "Все задачи",
		today: "Задачи на сегодня",
		week: "Задачи на неделю",
		important: "Важные задачи",
		completed: "Выполненные задачи",
		overdue: "Просроченные задачи",
		day: `Задачи на ${selectedDateLabel}`,
	};
	tasksTitle.textContent = headings[activeTaskFilter];

	if (visibleTasks.length === 0) {
		const emptyState = document.createElement("li");
		emptyState.className = "empty-state";
		const message = document.createElement("p");
		message.textContent = tasks.length
			? "По выбранным условиям задач нет."
			: "Задач пока нет. Добавьте первую, чтобы ничего не забыть.";
		emptyState.append(message);

		if (tasks.length === 0) {
			const emptyAddButton = document.createElement("button");
			emptyAddButton.type = "button";
			emptyAddButton.className = "empty-state__button";
			emptyAddButton.textContent = "Добавить задачу";
			emptyAddButton.addEventListener("click", () => openTaskDialog());
			emptyState.append(emptyAddButton);
		} else {
			const resetButton = document.createElement("button");
			resetButton.type = "button";
			resetButton.className = "empty-state__button";
			resetButton.textContent = "Сбросить фильтры";
			resetButton.addEventListener("click", () => {
				taskSearchInput.value = "";
				taskSubjectFilter.value = "";
				taskTagFilter.value = "";
				setTaskFilter("all");
			});
			emptyState.append(resetButton);
		}

		if (activeTaskView !== "board") {
			taskList.append(emptyState);
			return;
		}
		taskBoardColumns[0].append(emptyState);
	}

	// Сначала показываем активные задачи, затем выполненные.
	const sortedTasks = [...visibleTasks].sort((first, second) => Number(first.isCompleted) - Number(second.isCompleted) || first.date.localeCompare(second.date));
	const taskElements = sortedTasks.map(createTaskElement);
	if (activeTaskView === "board") {
		const tasksById = new Map(tasks.map((task) => [task.id, task]));
		for (const column of taskBoardColumns) {
			const status = column.dataset.taskStatus;
			const columnTasks = taskElements.filter((element) => {
				const task = tasksById.get(element.dataset.taskId);
				return task && (task.isCompleted ? "done" : task.status) === status;
			});
			if (columnTasks.length) column.append(...columnTasks);
			if (visibleTasks.length > 0 && columnTasks.length === 0) {
				const emptyColumn = document.createElement("li");
				emptyColumn.className = "task-board__empty";
				emptyColumn.textContent = "Нет задач";
				column.append(emptyColumn);
			}
			taskBoard.querySelector(`[data-task-count="${status}"]`).textContent = String(columnTasks.length);
		}
	} else {
		taskList.append(...taskElements);
	}
}

function openTaskDialog(taskId = null) {
	taskForm.reset();
	touchedFields.clear();
	const task = tasks.find((item) => item.id === taskId);
	editingTaskId = task?.id ?? null;
	taskDialogTitle.textContent = task ? "Редактировать задачу" : "Новая задача";

	if (task) {
		taskForm.elements.title.value = task.title;
		taskForm.elements.date.value = task.date;
		taskForm.elements.subject.value = task.subject;
		taskForm.elements.description.value = task.description;
		taskForm.elements.important.checked = task.isImportant;
		selectedTaskTags = task.tags.map((tag) => ({ ...tag }));
	} else {
		taskForm.elements.date.value = selectedDate;
		selectedTaskTags = [];
	}

	renderTaskTagOptions();
	updateTaskFormValidation();
	taskDialog.showModal();
}

addTaskButton.addEventListener("click", () => openTaskDialog());
previousMonthButton.addEventListener("click", () => changeMonth(-1));
nextMonthButton.addEventListener("click", () => changeMonth(1));
todayButton.addEventListener("click", () => {
	const today = new Date();
	selectedDate = getLocalDateString(today);
	displayedMonth = new Date(today.getFullYear(), today.getMonth(), 1);
	renderCalendar();
	setTaskFilter("day");
});

taskDialogCancel.addEventListener("click", () => {
	taskDialog.close();
});

taskDialog.addEventListener("close", () => {
	taskForm.reset();
	selectedTaskTags = [];
	renderTaskTagOptions();
	editingTaskId = null;
	taskDialogTitle.textContent = "Новая задача";
	touchedFields.clear();
	updateTaskFormValidation();
});

taskForm.addEventListener("submit", (event) => {
	event.preventDefault();
	for (const field of taskFields) touchedFields.add(field);
	if (!updateTaskFormValidation()) {
		taskFields.find((field) => !validateTaskField(field, true))?.focus();
		return;
	}

	const formData = new FormData(taskForm);
	const taskData = {
		title: String(formData.get("title") ?? "").trim(),
		date: String(formData.get("date") ?? ""),
		subject: String(formData.get("subject") ?? "").trim(),
		description: String(formData.get("description") ?? "").trim(),
		isImportant: formData.get("important") === "on",
		tags: normalizeTaskTags(selectedTaskTags),
	};

	const isEditing = Boolean(editingTaskId);
	let savedTaskId = editingTaskId;
	if (editingTaskId) {
		const existingTask = tasks.find((task) => task.id === editingTaskId);
		if (!existingTask) return;
		Object.assign(existingTask, taskData);
	} else {
		const newTask = new Task(taskData);
		tasks.push(newTask);
		savedTaskId = newTask.id;
	}

	selectedDate = taskData.date;
	const taskDate = parseLocalDateString(selectedDate);
	displayedMonth = new Date(taskDate.getFullYear(), taskDate.getMonth(), 1);
	saveTasks();
	taskDialog.close();
	renderCalendar();
	setTaskFilter("day");
	renderReminder(false);
	renderSubjectList();
	if (!isEditing) {
		const newTaskElement = [...taskList.querySelectorAll(".task-item"), ...taskBoard.querySelectorAll(".task-item")]
			.find((item) => item.dataset.taskId === savedTaskId);
		newTaskElement?.classList.add("is-entering");
	}
	showToast(isEditing ? "Задача обновлена" : "Задача добавлена");
});

updateSubjectSelectors();
updateTaskFormValidation();
renderSubjectList();
renderSchedule();
renderCalendar();
renderTasks();
renderReminder();
updateTimerDurationInputs();
timerCompletionStatus.value = timerState.completionStatus;
if (timerState.isRunning) {
	timerState.remainingSeconds = Math.max(0, Math.ceil((timerState.targetTimestamp - Date.now()) / 1000));
	if (timerState.remainingSeconds === 0) {
		finishTimer();
	} else {
		renderTimer();
		timerInterval = window.setInterval(() => {
			renderTimer();
			if (timerState.remainingSeconds === 0) finishTimer();
		}, 250);
	}
} else {
	renderTimer();
}
