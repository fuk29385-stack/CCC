const STORAGE_KEY = "college-control-center.tasks";

class Task {
	constructor({
		id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
		title = "",
		date = "",
		subject = "",
		description = "",
		isCompleted = false,
		isImportant = false,
		createdAt = new Date().toISOString(),
	} = {}) {
		this.id = id;
		this.title = title;
		this.date = date;
		this.subject = subject;
		this.description = description;
		this.isCompleted = isCompleted;
		this.isImportant = isImportant;
		this.createdAt = createdAt;
	}
}

function loadTasks() {
	try {
		const storedTasks = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
		if (!Array.isArray(storedTasks)) return [];

		// Восстанавливаем значения по умолчанию для неполных записей в хранилище.
		return storedTasks
			.filter((task) => task && typeof task === "object")
			.map((task) => new Task({
				id: typeof task.id === "string" ? task.id : undefined,
				title: typeof task.title === "string" ? task.title : "",
				date: typeof task.date === "string" ? task.date : "",
				subject: typeof task.subject === "string" ? task.subject : "",
				description: typeof task.description === "string" ? task.description : "",
				isCompleted: task.isCompleted === true,
				isImportant: task.isImportant === true,
				createdAt: typeof task.createdAt === "string" ? task.createdAt : undefined,
			}));
	} catch (error) {
		console.error("Не удалось загрузить задачи из localStorage.", error);
		return [];
	}
}

function saveTasks() {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
	} catch (error) {
		console.error("Не удалось сохранить задачи в localStorage.", error);
	}
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
const calendarGrid = document.querySelector("#calendar-grid");
const calendarMonth = document.querySelector("#calendar-month");
const previousMonthButton = document.querySelector("#calendar-previous");
const nextMonthButton = document.querySelector("#calendar-next");
const todayButton = document.querySelector("#calendar-today");
const taskForm = document.querySelector(".task-form");
const taskDialog = document.querySelector(".task-dialog");
const taskDialogTitle = document.querySelector("#task-dialog-title");
const taskList = document.querySelector(".task-list");
const tasksTitle = document.querySelector("#tasks-title");
const taskSearchInput = document.querySelector("#task-search");
const taskSubjectFilter = document.querySelector("#task-subject-filter");
const taskFilterButtons = [...document.querySelectorAll("[data-task-filter]")];
const taskStatistics = {
	total: document.querySelector("#stats-total"),
	completed: document.querySelector("#stats-completed"),
	overdue: document.querySelector("#stats-overdue"),
	deadline: document.querySelector("#stats-deadline"),
};
const addTaskButton = document.querySelector(".add-task-button");
const cancelTaskButton = taskForm.querySelector('button[type="button"]');
const saveTaskButton = taskForm.querySelector('button[type="submit"]');
const taskFields = ["title", "date", "subject"].map((name) => taskForm.elements.namedItem(name));
const touchedFields = new Set();
const initialDate = new Date();
let selectedDate = getLocalDateString(initialDate);
let displayedMonth = new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
let activeTaskFilter = "all";
let editingTaskId = null;

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
for (const button of taskFilterButtons) {
	button.addEventListener("click", () => setTaskFilter(button.dataset.taskFilter));
}

function createTaskElement(task) {
	const item = document.createElement("li");
	item.className = "task-item";
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
	meta.textContent = `${task.subject} · ${task.date}`;

	content.append(title, meta);

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
	const completeButton = createTaskAction(
		task.isCompleted ? "Не выполнено" : "Выполнено",
		"",
		() => {
			task.isCompleted = !task.isCompleted;
			saveTasks();
			renderTasks();
		},
	);
	completeButton.setAttribute("aria-pressed", String(task.isCompleted));
	actions.append(completeButton);
	actions.append(createTaskAction("Редактировать", "", () => openTaskDialog(task.id)));
	actions.append(createTaskAction("Удалить", "task-item__action--delete", () => {
		if (!window.confirm(`Удалить задачу «${task.title}»?`)) return;
		const taskIndex = tasks.findIndex((itemTask) => itemTask.id === task.id);
		if (taskIndex === -1) return;
		tasks.splice(taskIndex, 1);
		saveTasks();
		renderCalendar();
		renderTasks();
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

function updateSubjectOptions() {
	const selectedSubject = taskSubjectFilter.value;
	const subjects = [...new Set(tasks.map((task) => task.subject.trim()).filter(Boolean))]
		.sort((first, second) => first.localeCompare(second, "ru"));
	taskSubjectFilter.replaceChildren(new Option("Все предметы", ""));

	for (const subject of subjects) {
		taskSubjectFilter.append(new Option(subject, subject));
	}

	if (subjects.includes(selectedSubject)) {
		taskSubjectFilter.value = selectedSubject;
	}
}

function renderTasks() {
	taskList.replaceChildren();
	updateTaskStatistics();
	updateSubjectOptions();
	const todayDate = new Date();
	const today = getLocalDateString(todayDate);
	const weekEndDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() + 6);
	const weekEnd = getLocalDateString(weekEndDate);
	const searchTerm = taskSearchInput.value.trim().toLocaleLowerCase("ru-RU");
	const selectedSubject = taskSubjectFilter.value;
	const visibleTasks = tasks.filter((task) => {
		if (selectedSubject && task.subject.trim() !== selectedSubject) return false;
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
				setTaskFilter("all");
			});
			emptyState.append(resetButton);
		}

		taskList.append(emptyState);
		return;
	}

	// Сначала показываем активные задачи, затем выполненные.
	const sortedTasks = [...visibleTasks].sort((first, second) => Number(first.isCompleted) - Number(second.isCompleted) || first.date.localeCompare(second.date));
	const taskElements = sortedTasks.map(createTaskElement);
	taskList.append(...taskElements);
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
	} else {
		taskForm.elements.date.value = selectedDate;
	}

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

cancelTaskButton.addEventListener("click", () => {
	taskDialog.close();
});

taskDialog.addEventListener("close", () => {
	taskForm.reset();
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
	};

	if (editingTaskId) {
		const existingTask = tasks.find((task) => task.id === editingTaskId);
		if (!existingTask) return;
		Object.assign(existingTask, taskData);
	} else {
		tasks.push(new Task(taskData));
	}

	selectedDate = taskData.date;
	const taskDate = parseLocalDateString(selectedDate);
	displayedMonth = new Date(taskDate.getFullYear(), taskDate.getMonth(), 1);
	saveTasks();
	taskDialog.close();
	renderCalendar();
	setTaskFilter("day");
});

updateTaskFormValidation();
renderCalendar();
renderTasks();
