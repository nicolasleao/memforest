export const ANSI = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	underline: "\x1b[4m",
	inverse: "\x1b[7m",
	red: "\x1b[31m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	magenta: "\x1b[35m",
	cyan: "\x1b[36m",
	white: "\x1b[37m",
	bgBlue: "\x1b[44m",
	bgBlack: "\x1b[40m",
	clearScreen: "\x1b[2J",
	clearLine: "\x1b[2K",
	hideCursor: "\x1b[?25l",
	showCursor: "\x1b[?25h",
	saveCursor: "\x1b[s",
	restoreCursor: "\x1b[u",
} as const;

export function moveTo(row: number, col: number): void {
	process.stdout.write(`\x1b[${row};${col}H`);
}

export function writeAt(row: number, col: number, text: string): void {
	moveTo(row, col);
	process.stdout.write(text);
}

export function clearMainArea(startRow: number, endRow: number, _cols: number): void {
	for (let r = startRow; r <= endRow; r++) {
		moveTo(r, 1);
		process.stdout.write(ANSI.clearLine);
	}
}

export function drawHeader(forestName: string, activeView: string, cols: number): void {
	const title = ` memforest v0.1.0 | Forest: ${forestName} | View: ${activeView} `;
	const padded = title.padEnd(cols);
	writeAt(1, 1, `${ANSI.bgBlue}${ANSI.white}${ANSI.bold}${padded}${ANSI.reset}`);
	writeAt(2, 1, `${ANSI.dim}${"─".repeat(cols)}${ANSI.reset}`);
}

export function drawFooter(
	activeView: string,
	cols: number,
	rows: number,
	inputMode: boolean,
): void {
	const sep = `${ANSI.dim}${"─".repeat(cols)}${ANSI.reset}`;
	writeAt(rows - 1, 1, sep);

	const commonKeys = `${ANSI.dim}Tab${ANSI.reset}=cycle view  ${ANSI.dim}1-4${ANSI.reset}=jump  ${ANSI.dim}q${ANSI.reset}=quit`;

	let viewKeys = "";
	switch (activeView) {
		case "chat":
			viewKeys = inputMode
				? `${ANSI.dim}Enter${ANSI.reset}=send  ${ANSI.dim}Esc${ANSI.reset}=cancel`
				: `${ANSI.dim}/${ANSI.reset}=type query`;
			break;
		case "browse":
			viewKeys = `${ANSI.dim}\u2191\u2193${ANSI.reset}=navigate  ${ANSI.dim}Enter${ANSI.reset}=expand/select`;
			break;
		case "graph":
			viewKeys = `${ANSI.dim}\u2191\u2193${ANSI.reset}=navigate  ${ANSI.dim}Enter${ANSI.reset}=recenter  ${ANSI.dim}+/-${ANSI.reset}=depth`;
			break;
		case "health":
			viewKeys = `${ANSI.dim}r${ANSI.reset}=refresh`;
			break;
	}

	const footerText = ` ${commonKeys}  |  ${viewKeys} `;
	writeAt(rows, 1, `${ANSI.clearLine}${footerText}`);
}

export function getTerminalSize(): { rows: number; cols: number } {
	return {
		rows: process.stdout.rows ?? 24,
		cols: process.stdout.columns ?? 80,
	};
}
