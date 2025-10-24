interface FormattingState {
    lines: string[];
    currentLine: string;
    indentLevel: number;
    isFirstLine: boolean;
    marker: number;
}

function createTab(indentLevel: number): string {
    return indentLevel < 0 ? '' : '\t'.repeat(indentLevel);
}

function handleQuote(
    content: string,
    state: FormattingState,
    quote: string
): void {
    state.currentLine += quote;
    state.marker++;

    while (state.marker < content.length) {
        const char = content[state.marker];
        if (char === undefined) {
            break;
        }

        state.currentLine += char;

        if (char === quote && content[state.marker - 1] !== '\\') {
            break;
        }

        state.marker++;
    }
}

function handleBrace(
    state: FormattingState,
    isOpening: boolean
): void {
    if (isOpening) {
        state.lines.push(createTab(state.indentLevel) + state.currentLine.trim() + ' {');
        state.isFirstLine = true;
        state.indentLevel++;
        state.currentLine = '';
    } else {
        if (state.currentLine.trim().length > 0) {
            state.lines.push(createTab(state.indentLevel) + state.currentLine.trim());
            state.currentLine = '';
        }
        state.indentLevel--;
        state.isFirstLine = true;
        state.lines.push(createTab(state.indentLevel) + '}');
    }
}

function handleSemicolon(state: FormattingState): void {
    if (state.currentLine.trim().length > 0) {
        state.lines.push(
            createTab(state.isFirstLine ? state.indentLevel : state.indentLevel + 1) +
            state.currentLine.trim() + ';'
        );
        state.currentLine = '';
    } else {
        state.lines[state.lines.length - 1] += ';';
    }
    state.isFirstLine = true;
}

function handleNewline(state: FormattingState): void {
    if (state.currentLine.trim().length > 0) {
        state.lines.push(
            createTab(state.isFirstLine ? state.indentLevel : state.indentLevel + 1) +
            state.currentLine.trim()
        );
        if (state.isFirstLine) {
            state.isFirstLine = false;
        }
        state.currentLine = '';
    } else {
        state.isFirstLine = true;
    }
}

export default function formatBlock(content: string, intent = ""): string {
    if (!content) {
        return '';
    }

    try {
        const state: FormattingState = {
            lines: [],
            currentLine: '',
            indentLevel: 0,
            isFirstLine: true,
            marker: 0
        };

        while (state.marker < content.length) {
            const char = content[state.marker];

            if (char === '"' || char === "'" || char === '`') {
                handleQuote(content, state, char);
            } else {
                switch (char) {
                    case '{': handleBrace(state, true); break;
                    case '}': handleBrace(state, false); break;
                    case ';': handleSemicolon(state); break;
                    case '\n': handleNewline(state); break;
                    default: state.currentLine += char;
                }
            }
            state.marker++;
        }

        if (state.currentLine.trim().length > 0) {
            state.lines.push(createTab(state.indentLevel) + state.currentLine.trim());
        }

        const breakTab = intent + createTab(1);
        const begin = (state.lines.length > 1) ? breakTab: "";
        const end = (state.lines.length > 1) ? intent: "";
        return begin + state.lines.join(breakTab) + end;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Error formatting block:', errorMessage);
        return content;
    }
}
