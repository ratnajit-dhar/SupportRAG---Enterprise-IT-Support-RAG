const chat = document.getElementById('chat');
const form = document.getElementById('chatForm');
const question = document.getElementById('question');
const trace = document.getElementById('trace');
const sourceUsed = document.getElementById('sourceUsed');

const modal = document.getElementById('uploadModal');
const openUpload = document.getElementById('openUpload');
const closeUpload = document.getElementById('closeUpload');
const uploadBtn = document.getElementById('uploadBtn');

let isProcessing = false;


// ==================================================
// UTILITIES
// ==================================================

function escapeHtml(s = '') {
    return String(s).replace(/[&<>'"]/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[c]));
}

function formatText(s = '') {
    return escapeHtml(s).replace(/\n/g, '<br>');
}

function scrollToBottom() {
    chat.scrollTop = chat.scrollHeight;
}


// ==================================================
// CHAT MESSAGES
// ==================================================

function addMessage(role, text, source = '', citations = []) {

    const wrap = document.createElement('div');
    wrap.className = `message ${role}`;

    setMessageContent(wrap, text, source, citations);

    chat.appendChild(wrap);

    scrollToBottom();

    return wrap;
}

function setMessageContent(wrap, text, source = '', citations = []) {
    const citeHtml = citations.length
        ? `
            <div class="citations">
                <strong>Sources</strong><br>
                ${citations.map(c =>
                    c.url
                        ? `<a href="${escapeHtml(c.url)}"
                              target="_blank"
                              rel="noopener noreferrer">
                              ${escapeHtml(c.title)}
                           </a>`
                        : escapeHtml(c.title)
                ).join('<br>')}
            </div>
        `
        : '';

    wrap.innerHTML = `
        <div class="avatar">AI</div>

        <div class="bubble">
            ${formatText(text)}

            ${source
                ? `<div class="answer-source">
                       Source: ${escapeHtml(source)}
                   </div>`
                : ''
                }

                ${citeHtml}
        </div>
    `;
    scrollToBottom();
}


// ==================================================
// TYPING INDICATOR
// ==================================================

function showTypingIndicator(message = 'Starting your request...') {

    const wrap = document.createElement('div');

    wrap.className = 'message assistant';
    wrap.id = 'typingIndicator';

    wrap.innerHTML = `
        <div class="avatar">AI</div>

        <div class="bubble typing-bubble" role="status" aria-live="polite">
            <span class="progress-spinner" aria-hidden="true"></span>
            <span class="typing-status-text">${escapeHtml(message)}</span>
        </div>
    `;

    chat.appendChild(wrap);

    scrollToBottom();
}

function updateTypingIndicator(message) {
    const status = document.querySelector('#typingIndicator .typing-status-text');
    if (status) {
        status.textContent = message;
    }
}

function removeTypingIndicator() {

    const indicator = document.getElementById('typingIndicator');

    if (indicator) {
        indicator.remove();
    }
}


// ==================================================
// AGENT TRACE
// ==================================================

function renderTrace(items = []) {

    if (!items.length) {
        trace.innerHTML = '<div class="empty">No trace.</div>';
        return;
    }

    trace.innerHTML = items.map((item, index) => `
        <div class="trace-item">
            <span class="trace-number">
                ${String(index + 1).padStart(2, '0')}
            </span>

            <span>${escapeHtml(item)}</span>
        </div>
    `).join('');
}


// ==================================================
// ASK AGENT
// ==================================================

async function askAgent(q) {

    if (isProcessing || !q.trim()) {
        return;
    }

    isProcessing = true;

    const btn = form.querySelector('button[type="submit"]');

    btn.disabled = true;
    btn.textContent = 'Thinking...';

    addMessage('user', q);

    question.value = '';

    renderTrace(['Running LangGraph workflow...']);

    sourceUsed.textContent = 'Running';

    showTypingIndicator();

    try {

        const res = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                question: q
            })
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.detail || 'Request failed');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let streamedAnswer = '';
        let completed = false;
        let assistantMessage = null;

        const handleEvent = (event) => {
            if (event.type === 'progress') {
                updateTypingIndicator(event.message);
                return;
            }

            if (event.type === 'token') {
                if (!assistantMessage) {
                    removeTypingIndicator();
                    assistantMessage = addMessage('assistant', '');
                }
                streamedAnswer += event.content;
                setMessageContent(assistantMessage, streamedAnswer);
                return;
            }

            if (event.type === 'error') {
                throw new Error(event.detail || 'Streaming request failed');
            }

            if (event.type === 'done') {
                completed = true;
                streamedAnswer = streamedAnswer || event.answer || '';
                if (assistantMessage) {
                    setMessageContent(
                        assistantMessage,
                        streamedAnswer,
                        event.source_used,
                        event.citations || []
                    );
                } else {
                    removeTypingIndicator();
                    addMessage(
                        'assistant',
                        streamedAnswer,
                        event.source_used,
                        event.citations || []
                    );
                }
                renderTrace(event.trace || []);
                sourceUsed.textContent = event.source_used || 'Unknown';
            }
        };

        while (true) {
            const { value, done } = await reader.read();
            buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (line.trim()) {
                    handleEvent(JSON.parse(line));
                }
            }

            if (done) {
                break;
            }
        }

        if (buffer.trim()) {
            handleEvent(JSON.parse(buffer));
        }
        if (!completed) {
            throw new Error('The stream ended before the response was complete');
        }

    } catch (error) {

        removeTypingIndicator();

        addMessage(
            'assistant',
            `Error: ${error.message}`
        );

        renderTrace(['Request failed']);

        sourceUsed.textContent = 'Error';

    } finally {

        isProcessing = false;

        btn.disabled = false;
        btn.textContent = 'Ask Agent';

        question.focus();
    }
}


// ==================================================
// FORM SUBMISSION
// ==================================================

form.addEventListener('submit', (event) => {

    event.preventDefault();

    const q = question.value.trim();

    if (q) {
        askAgent(q);
    }
});


// ==================================================
// ENTER TO SEND
// ==================================================

question.addEventListener('keydown', (event) => {

    if (
        event.key === 'Enter' &&
        !event.shiftKey &&
        !event.isComposing
    ) {

        event.preventDefault();

        if (!isProcessing) {
            form.requestSubmit();
        }
    }
});


// ==================================================
// EXAMPLE QUESTIONS
// ==================================================

document.querySelectorAll('.example').forEach(button => {

    button.addEventListener('click', () => {

        if (isProcessing) {
            return;
        }

        askAgent(button.textContent.trim());
    });
});


// ==================================================
// UPLOAD MODAL
// ==================================================

function showUploadModal() {

    modal.classList.remove('hidden');

    document.getElementById('uploadStatus').textContent = '';

    document.getElementById('adminKey').focus();
}

function hideUploadModal() {

    modal.classList.add('hidden');
}

openUpload.addEventListener('click', showUploadModal);

closeUpload.addEventListener('click', hideUploadModal);


// Close when clicking outside the modal card.
modal.addEventListener('click', (event) => {

    if (event.target === modal) {
        hideUploadModal();
    }
});


// Close with Escape.
document.addEventListener('keydown', (event) => {

    if (
        event.key === 'Escape' &&
        !modal.classList.contains('hidden')
    ) {
        hideUploadModal();
    }
});


// ==================================================
// DOCUMENT INGESTION
// ==================================================

uploadBtn.addEventListener('click', async () => {

    const fileInput = document.getElementById('fileInput');
    const adminKey = document.getElementById('adminKey');
    const status = document.getElementById('uploadStatus');

    const file = fileInput.files[0];
    const key = adminKey.value;

    if (!file) {
        status.textContent = 'Choose a file first.';
        return;
    }

    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Indexing...';

    status.textContent = 'Processing and indexing document...';

    const formData = new FormData();
    formData.append('file', file);

    try {

        const response = await fetch('/api/ingest', {
            method: 'POST',
            headers: {
                'X-Admin-Key': key
            },
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || 'Upload failed');
        }

        if (data.status === 'skipped') {

            status.textContent =
                `${data.file || file.name} is already indexed and unchanged.`;

        } else {

            status.textContent =
                `Successfully indexed ${data.file || file.name}: ${data.chunks} chunks.`;
        }

        fileInput.value = '';

    } catch (error) {

        status.textContent = `Error: ${error.message}`;

    } finally {

        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Index Document';
    }
});