const tasks = [];

class Task {
	constructor({
		id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
		title = "",
		date = "",
		subject = "",
		description = "",
		isCompleted = false,
		isImportant = false,
	} = {}) {
		this.id = id;
		this.title = title;
		this.date = date;
		this.subject = subject;
		this.description = description;
		this.isCompleted = isCompleted;
		this.isImportant = isImportant;
	}
}

function filterTasksByDate(selectedDate) {
	return tasks.filter((task) => task.date === selectedDate);
}

function getLocalDateString(date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

const taskForm = document.querySelector(".task-form");
const taskDialog = document.querySelector(".task-dialog");
const taskList = document.querySelector(".task-list");
const addTaskButton = document.querySelector(".add-task-button");
const cancelTaskButton = taskForm.querySelector('button[type="button"]');
const saveTaskButton = taskForm.querySelector('button[type="submit"]');
const taskFields = ["title", "date", "subject", "description"].map((name) => taskForm.elements.namedItem(name));
const touchedFields = new Set();
let selectedDate = getLocalDateString(new Date());

function validateTaskField(field, showError) {
	const value = field.value.trim();
	let message = "";

	if (!value) {
		const labels = {
			title: "Введите название.",
			date: "Выберите дату.",
			subject: "Введите предмет.",
			description: "Введите описание.",
		};
		message = labels[field.name];
	} else if (field.name === "description" && value.length < 12) {
		message = "Введите не менее 12 символов.";
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
		if (showError) {
			field.removeAttribute("aria-invalid");
		} else {
			field.removeAttribute("aria-invalid");
		}
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

function createTaskElement(task) {
	const item = document.createElement("li");
	item.className = "task-item";
	if (task.isCompleted) item.classList.add("is-completed");

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

	if (task.isImportant) {
		const importance = document.createElement("span");
		importance.className = "task-item__importance";
		importance.textContent = "Важная";
		item.append(importance);
	}

	return item;
}

function renderTasks(date = selectedDate) {
	selectedDate = date;
	const dayTasks = filterTasksByDate(selectedDate);
	taskList.replaceChildren();

	if (dayTasks.length === 0) {
		const emptyState = document.createElement("li");
		emptyState.className = "empty-state";
		emptyState.textContent = "Сегодня отдыхаем";
		taskList.append(emptyState);
		return;
	}

	const taskElements = dayTasks.map(createTaskElement);
	taskList.append(...taskElements);
}

addTaskButton.addEventListener("click", () => {
	taskForm.elements.date.value = selectedDate;
	taskDialog.showModal();
});

cancelTaskButton.addEventListener("click", () => {
	taskDialog.close();
});

taskDialog.addEventListener("close", () => {
	taskForm.reset();
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
	const task = new Task({
		title: String(formData.get("title") ?? "").trim(),
		date: String(formData.get("date") ?? ""),
		subject: String(formData.get("subject") ?? "").trim(),
		description: String(formData.get("description") ?? "").trim(),
		isImportant: formData.get("important") === "on",
	});

	tasks.push(task);
	selectedDate = task.date;
	taskDialog.close();
	taskForm.reset();
	touchedFields.clear();
	renderTasks();
});

updateTaskFormValidation();
renderTasks();
