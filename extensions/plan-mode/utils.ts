/**
 * Pure utility functions for plan mode.
 * Extracted for testability.
 *
 * Bash command safety lives in ./tool-policy.ts (a real tokenizer, not regexes) — moved
 * out when ported from github.com/narumiruna/pi-extensions.
 */

export interface TodoItem {
	step: number;
	text: string;
	completed: boolean;
}

export function cleanStepText(text: string): string {
	let cleaned = text
		.replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1") // Remove bold/italic
		.replace(/`([^`]+)`/g, "$1") // Remove code
		.replace(
			/^(Use|Run|Execute|Create|Write|Read|Check|Verify|Update|Modify|Add|Remove|Delete|Install)\s+(the\s+)?/i,
			"",
		)
		.replace(/\s+/g, " ")
		.trim();

	if (cleaned.length > 0) {
		cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
	}
	if (cleaned.length > 50) {
		cleaned = `${cleaned.slice(0, 47)}...`;
	}
	return cleaned;
}

export function extractTodoItems(message: string): TodoItem[] {
	const items: TodoItem[] = [];
	const headerMatch = message.match(/\*{0,2}Plan:\*{0,2}\s*\n/i);
	if (!headerMatch) return items;

	const planSection = message.slice(message.indexOf(headerMatch[0]) + headerMatch[0].length);
	const numberedPattern = /^\s*(\d+)[.)]\s+\*{0,2}([^*\n]+)/gm;

	for (const match of planSection.matchAll(numberedPattern)) {
		const text = match[2]
			.trim()
			.replace(/\*{1,2}$/, "")
			.trim();
		if (text.length > 5 && !text.startsWith("`") && !text.startsWith("/") && !text.startsWith("-")) {
			const cleaned = cleanStepText(text);
			if (cleaned.length > 3) {
				items.push({ step: items.length + 1, text: cleaned, completed: false });
			}
		}
	}
	return items;
}

export function extractDoneSteps(message: string): number[] {
	const steps: number[] = [];
	for (const match of message.matchAll(/\[DONE:(\d+)\]/gi)) {
		const step = Number(match[1]);
		if (Number.isFinite(step)) steps.push(step);
	}
	return steps;
}

export function markCompletedSteps(text: string, items: TodoItem[]): number {
	const doneSteps = extractDoneSteps(text);
	for (const step of doneSteps) {
		const item = items.find((t) => t.step === step);
		if (item) item.completed = true;
	}
	return doneSteps.length;
}

export interface PlanModeState {
	enabled: boolean;
	todos: TodoItem[];
	executing: boolean;
	toolsBeforePlanMode?: string[];
}

function isTodoItem(value: unknown): value is TodoItem {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as TodoItem).step === "number" &&
		typeof (value as TodoItem).text === "string" &&
		typeof (value as TodoItem).completed === "boolean"
	);
}

function isTodoItemArray(value: unknown): value is TodoItem[] {
	return Array.isArray(value) && value.every(isTodoItem);
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/**
 * Validate persisted plan-mode state before trusting it, instead of a blind cast with
 * `??` fallbacks. A corrupted or hand-edited session entry falls back to safe per-field
 * defaults rather than poisoning the whole restore with garbage.
 */
export function restorePlanModeState(data: unknown): PlanModeState {
	if (typeof data !== "object" || data === null) {
		return { enabled: false, todos: [], executing: false };
	}
	const record = data as Record<string, unknown>;
	return {
		enabled: record.enabled === true,
		todos: isTodoItemArray(record.todos) ? record.todos : [],
		executing: record.executing === true,
		toolsBeforePlanMode: isStringArray(record.toolsBeforePlanMode) ? record.toolsBeforePlanMode : undefined,
	};
}
