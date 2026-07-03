import {
    auth,
    db,
    storage,
    onAuthStateChanged,
    collection,
    doc,
    setDoc,
    getDoc,
    deleteDoc,
    serverTimestamp,
    ref,
    uploadBytes,
    getDownloadURL,
} from "./firebase-init.js";

// --- DOM Elements ---
const bookForm = document.getElementById("bookForm");
const bookTitleInput = document.getElementById("bookTitle");
const bookAuthorInput = document.getElementById("bookAuthor");
const bookDescriptionTextarea = document.getElementById("bookDescription");
const summaryMainHeadingInput = document.getElementById("summaryMainHeading");
const bookCoverFileInput = document.getElementById("bookCoverFile");
const bookCoverUrlInput = document.getElementById("bookCoverUrl");
const bookAudioFileInput = document.getElementById("bookAudioFile");
const bookAudioUrlInput = document.getElementById("bookAudioUrl");
const bookCategorySelect = document.getElementById("bookCategory");
const summaryBlocksContainer = document.getElementById("summaryBlocksContainer");
const noBlocksMessage = document.getElementById("noBlocksMessage");
const addHeadingBlockBtn = document.getElementById("addHeadingBlockBtn");
const addParagraphBlockBtn = document.getElementById("addParagraphBlockBtn");
const loadBookSlugInput = document.getElementById("loadBookSlug");
const loadBookBtn = document.getElementById("loadBookBtn");
const loadBookBtnText = document.getElementById("loadBookBtnText");
const adminMessageDiv = document.getElementById("adminMessage");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const saveBookBtn = document.getElementById("saveBookBtn");
const saveBookBtnText = document.getElementById("saveBookBtnText");
const bulkPasteBtn = document.getElementById("bulkPasteBtn");
const bulkPasteOverlay = document.getElementById("bulkPasteOverlay");
const bulkPasteTextarea = document.getElementById("bulkPasteTextarea");
const bulkPreview = document.getElementById("bulkPreview");
const bulkCancelBtn = document.getElementById("bulkCancelBtn");
const bulkConfirmBtn = document.getElementById("bulkConfirmBtn");
const deleteBookBtn = document.getElementById("deleteBookBtn");

// --- Globals ---
const ADMIN_UID = "iOeLZw42zpdvx966peaBHSJ8Fdr2"; // Replace with your actual admin UID
let currentAuthUser = null;
let editingBookSlug = null; // Stores the slug of the book currently being edited

// --- Helper Functions ---

function generateSlug(title) {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "") // Remove non-alphanumeric chars (except spaces and hyphens)
        .replace(/\s+/g, "-") // Replace spaces with hyphens
        .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}

function showAdminMessage(message, isError = false) {
    adminMessageDiv.textContent = message;
    adminMessageDiv.classList.remove("hidden");
    adminMessageDiv.classList.toggle("admin-message--error", isError);
    adminMessageDiv.classList.toggle("admin-message--success", !isError);
}

function hideAdminMessage() {
    adminMessageDiv.classList.add("hidden");
}

// --- Dynamic Block System ---
// Dynamic summary block UI with delegated events, reordering and type changes

function createSummaryBlockElement(type = "paragraph", text = "") {
    const blockDiv = document.createElement("div");
    blockDiv.className = `summary-block-item ${type === 'heading' ? 'heading-block' : 'paragraph-block'}`;
    blockDiv.dataset.type = type;

    // Controls row
    const controls = document.createElement("div");
    controls.className = "summary-block-controls";

    const typeSelect = document.createElement("select");
    typeSelect.className = "block-type-select";
    const optHeading = document.createElement("option"); optHeading.value = "heading"; optHeading.text = "Sub-heading";
    const optParagraph = document.createElement("option"); optParagraph.value = "paragraph"; optParagraph.text = "Paragraphs";
    typeSelect.append(optHeading, optParagraph);
    typeSelect.value = type;

    const moveUpBtn = document.createElement("button"); moveUpBtn.className = "move-block-up"; moveUpBtn.title = "Move up"; moveUpBtn.textContent = "▲";
    const moveDownBtn = document.createElement("button"); moveDownBtn.className = "move-block-down"; moveDownBtn.title = "Move down"; moveDownBtn.textContent = "▼";
    const removeButton = document.createElement("button"); removeButton.className = "remove-block-btn"; removeButton.title = "Remove block"; removeButton.textContent = "×";

    controls.append(typeSelect, moveUpBtn, moveDownBtn, removeButton);

    const textarea = document.createElement("textarea");
    textarea.className = "admin-textarea block-textarea";
    if (type === "heading") {
        textarea.placeholder = "Sub-heading text...";
        textarea.rows = 1;
    } else {
        textarea.placeholder = "Write multiple paragraphs here...\n\nSeparate each paragraph with a blank line (press Enter twice).\n\nEach separated block will render as its own <p> tag.";
        textarea.rows = 8;
    }
    textarea.value = text || "";

    const hint = document.createElement("p");
    hint.className = "form-hint";
    hint.style.marginTop = "0.5rem";
    hint.innerHTML = 'Tip: Use <code>**text**</code> to make text bold. Example: <code>This is **important**.</code>';

    // Add multi-paragraph hint for paragraph blocks
    if (type === "paragraph") {
        const multiHint = document.createElement("p");
        multiHint.className = "multi-para-hint";
        multiHint.textContent = "💡 Separate paragraphs with a blank line (double Enter). Each will become its own paragraph on the page.";
        blockDiv.append(controls, textarea, hint, multiHint);
    } else {
        blockDiv.append(controls, textarea, hint);
    }

    return blockDiv;
}

function addSummaryBlock(type = "paragraph", text = "", autoFocus = true) {
    const newBlock = createSummaryBlockElement(type, text);
    summaryBlocksContainer.appendChild(newBlock);
    // focus textarea only when manually adding (not during bulk pre-population)
    if (autoFocus) {
        const ta = newBlock.querySelector("textarea");
        if (ta) ta.focus();
    }
    updateNoBlocksMessage();
}

function updateNoBlocksMessage() {
    // Always query the DOM since addDefaultBlocks may recreate this element
    const msg = summaryBlocksContainer.querySelector('.no-blocks-message') || document.getElementById('noBlocksMessage');
    if (!msg) return;
    // Count only actual block items, not the no-blocks message itself
    const blockCount = summaryBlocksContainer.querySelectorAll('.summary-block-item').length;
    msg.classList.toggle("hidden", blockCount > 0);
}

/**
 * Pre-populate the summary blocks area with the standard
 * Myanmar subheadings, each followed by an empty multi-paragraph
 * block ready for the admin to paste content into.
 */
const DEFAULT_SUBHEADINGS = [
    'မိတ်ဆက်နှင့် အဓိကပြဿနာ',
    'စာအုပ်၏ အနှစ်သာရနှင့် အတွေးအခေါ်များ',
    '၃ မျိုးသော လက်တွေ့ကျင့်သုံးနိုင်သည့် အလေ့အကျင့်ငယ်များ',
    'လူသိနည်းသော ခြားနားသည့် အတွေးအခေါ် ၃ ရပ်',
    'လက်တွေ့ဘဝနှင့် လုပ်ငန်းခွင်တွင် အသုံးချခြင်း',
    'နိဂုံးနှင့် ရှေ့ဆက်ရန် အကြံပြုချက်',
];

function addDefaultBlocks() {
    // Clear existing blocks first
    summaryBlocksContainer.innerHTML = '';
    // Re-add the no-blocks message element (hidden)
    const msg = document.createElement('p');
    msg.className = 'no-blocks-message hidden';
    msg.id = 'noBlocksMessage';
    msg.textContent = 'No content blocks yet. Click the buttons below to add one.';
    summaryBlocksContainer.appendChild(msg);

    DEFAULT_SUBHEADINGS.forEach((heading) => {
        // Add a pre-filled sub-heading block
        addSummaryBlock('heading', heading, false);
        // Add an empty multi-paragraph block for pasting content
        addSummaryBlock('paragraph', '', false);
    });
    updateNoBlocksMessage();
}

function collectSummaryBlocks() {
    const blocks = [];
    Array.from(summaryBlocksContainer.children).forEach((blockEl) => {
        const typeSelect = blockEl.querySelector(".block-type-select");
        const textarea = blockEl.querySelector("textarea");
        const type = typeSelect ? typeSelect.value : (blockEl.dataset.type || "paragraph");
        const rawText = textarea ? textarea.value.trim() : "";
        if (!rawText) return;

        if (type === "paragraph") {
            // Parse the paragraph text to detect ## headings and ***** underlined headings
            const lines = rawText.split(/\n/);
            const isAsterisksLine = (line) => /^\*{3,}$/.test(line.trim());
            const isMarkdownHeading = (line) => /^#{2,}\s+/.test(line.trim());

            // Identify asterisk-underlined heading lines
            const headingLineIndices = new Set();
            const separatorLineIndices = new Set();

            for (let i = 0; i < lines.length; i++) {
                if (isAsterisksLine(lines[i])) {
                    separatorLineIndices.add(i);
                    for (let j = i - 1; j >= 0; j--) {
                        if (lines[j].trim().length > 0) {
                            headingLineIndices.add(j);
                            break;
                        }
                    }
                }
            }

            let currentParagraphLines = [];

            function flushParagraph() {
                if (currentParagraphLines.length > 0) {
                    const text = currentParagraphLines.join("\n").trim();
                    if (text) {
                        const subParas = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
                        subParas.forEach(p => {
                            blocks.push({ type: "paragraph", text: p });
                        });
                    }
                    currentParagraphLines = [];
                }
            }

            for (let i = 0; i < lines.length; i++) {
                if (separatorLineIndices.has(i)) {
                    continue;
                }
                if (headingLineIndices.has(i)) {
                    flushParagraph();
                    blocks.push({ type: "heading", text: lines[i].trim() });
                } else if (isMarkdownHeading(lines[i])) {
                    flushParagraph();
                    const headingText = lines[i].trim().replace(/^#+\s+/, "");
                    blocks.push({ type: "heading", text: headingText });
                } else {
                    currentParagraphLines.push(lines[i]);
                }
            }

            flushParagraph();
        } else {
            // Headings stay as-is (single value)
            blocks.push({ type, text: rawText });
        }
    });
    return blocks;
}

function populateSummaryBlocks(summaryBlocks) {
    summaryBlocksContainer.innerHTML = "";
    if (!Array.isArray(summaryBlocks) || summaryBlocks.length === 0) {
        updateNoBlocksMessage();
        return;
    }

    // Merge consecutive paragraph blocks into a single textarea
    // so editing is as convenient as creating
    const merged = [];
    summaryBlocks.forEach(b => {
        const type = b.type || "paragraph";
        const text = b.text || "";
        if (type === "paragraph" && merged.length > 0 && merged[merged.length - 1].type === "paragraph") {
            // Append to previous paragraph block with double newline separator
            merged[merged.length - 1].text += "\n\n" + text;
        } else {
            merged.push({ type, text });
        }
    });

    merged.forEach(b => addSummaryBlock(b.type, b.text));
    updateNoBlocksMessage();
}

// Event delegation for block controls
summaryBlocksContainer.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const blockEl = btn.closest(".summary-block-item");
    if (!blockEl) return;

    if (btn.classList.contains("remove-block-btn")) {
        blockEl.remove();
        updateNoBlocksMessage();
        return;
    }

    if (btn.classList.contains("move-block-up")) {
        const prev = blockEl.previousElementSibling;
        if (prev) blockEl.parentNode.insertBefore(blockEl, prev);
        return;
    }

    if (btn.classList.contains("move-block-down")) {
        const next = blockEl.nextElementSibling;
        if (next) blockEl.parentNode.insertBefore(next, blockEl);
        return;
    }
});

// Update placeholder/rows when type changes
summaryBlocksContainer.addEventListener("change", (e) => {
    const sel = e.target.closest(".block-type-select");
    if (!sel) return;
    const blockEl = sel.closest(".summary-block-item");
    const ta = blockEl.querySelector("textarea");
    const type = sel.value;
    blockEl.dataset.type = type;

    // Update visual distinction class
    blockEl.classList.remove('heading-block', 'paragraph-block');
    blockEl.classList.add(type === 'heading' ? 'heading-block' : 'paragraph-block');

    // Add or remove multi-paragraph hint based on type
    const existingHint = blockEl.querySelector(".multi-para-hint");
    if (type === "paragraph" && !existingHint) {
        const multiHint = document.createElement("p");
        multiHint.className = "multi-para-hint";
        multiHint.textContent = "💡 Separate paragraphs with a blank line (double Enter). Each will become its own paragraph on the page.";
        blockEl.appendChild(multiHint);
    } else if (type !== "paragraph" && existingHint) {
        existingHint.remove();
    }

    if (ta) {
        if (type === "heading") {
            ta.placeholder = "Sub-heading text...";
            ta.rows = 1;
        } else {
            ta.placeholder = "Write multiple paragraphs here...\n\nSeparate each paragraph with a blank line (press Enter twice).";
            ta.rows = 8;
        }
        ta.focus();
    }
});

// Simple autosize for textareas (delegated)
summaryBlocksContainer.addEventListener("input", (e) => {
    const ta = e.target.closest("textarea");
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = (ta.scrollHeight) + "px";
});

// --- Form Management ---

function resetForm() {
    bookForm.reset();
    bookCoverUrlInput.value = "";
    bookAudioUrlInput.value = "";
    editingBookSlug = null;
    saveBookBtnText.textContent = "Save Book";
    loadBookSlugInput.value = "";
    hideAdminMessage();
    // Re-populate with default blocks so the admin always has a ready template
    addDefaultBlocks();
}

async function populateFormForEdit(bookSlug) {
    hideAdminMessage();
    loadBookBtn.disabled = true;
    loadBookBtn.classList.add("btn-loading");
    loadBookBtnText.style.opacity = "0";
    
    try {
        const bookRef = doc(db, "books", bookSlug);
        const bookSnap = await getDoc(bookRef);

        if (bookSnap.exists()) {
            const data = bookSnap.data();
            editingBookSlug = bookSnap.id;

            bookTitleInput.value = data.title || "";
            bookAuthorInput.value = data.author || "";
            if (bookCategorySelect) bookCategorySelect.value = data.category || "growth";
            bookDescriptionTextarea.value = data.description || "";
            summaryMainHeadingInput.value = data.summaryHeading || "";
            bookCoverUrlInput.value = data.coverUrl || "";
            bookAudioUrlInput.value = data.audioUrl || "";
            bookCoverFileInput.value = ""; // Clear file input
            bookAudioFileInput.value = ""; // Clear file input

            populateSummaryBlocks(data.summaryBlocks || []);
            saveBookBtnText.textContent = "Update Book";
            showAdminMessage(`Book '${data.title}' loaded for editing.`, false);
        } else {
            showAdminMessage(`No book found with slug: ${bookSlug}`, true);
            resetForm();
        }
    } catch (error) {
        console.error("Error loading book for edit:", error);
        showAdminMessage("Error loading book: " + error.message, true);
    } finally {
        loadBookBtn.disabled = false;
        loadBookBtn.classList.remove("btn-loading");
        loadBookBtnText.style.opacity = "1";
    }
}

// --- Firebase Storage Upload ---

async function uploadFile(fileInput, pathPrefix) {
    const file = fileInput.files[0];
    if (!file) return null; // No file selected

    // File size validation (max 10MB for images, 50MB for audio)
    const maxSize = pathPrefix === "covers" ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
    const maxLabel = pathPrefix === "covers" ? "10MB" : "50MB";
    if (file.size > maxSize) {
        throw new Error(`File "${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum allowed is ${maxLabel}.`);
    }

    // File type validation
    const allowedTypes = pathPrefix === "covers"
        ? ["image/jpeg", "image/png", "image/webp", "image/gif"]
        : ["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/m4a", "audio/x-m4a"];
    if (!allowedTypes.includes(file.type)) {
        throw new Error(`File "${file.name}" has an unsupported type (${file.type || "unknown"}). Allowed: ${allowedTypes.join(", ")}.`);
    }

    const filePath = `${pathPrefix}/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
    const fileRef = ref(storage, filePath);
    await uploadBytes(fileRef, file);
    return getDownloadURL(fileRef);
}

// --- Event Listeners ---

// Authentication state observer
onAuthStateChanged(auth, (user) => {
    currentAuthUser = user;
    if (user && user.uid === ADMIN_UID) {
        // Admin is logged in, enable editor features
        console.log("Admin user logged in.");
        saveBookBtn.disabled = false;
        loadBookBtn.disabled = false;
        hideAdminMessage();
    } else {
        // Not admin or logged out, show message and disable save
        console.log("Non-admin or logged out.");
        saveBookBtn.disabled = true;
        loadBookBtn.disabled = true;
        showAdminMessage("You must be logged in as an administrator to save books. Please login first.", true);
    }
});

addHeadingBlockBtn.addEventListener("click", (e) => { e.preventDefault(); addSummaryBlock("heading"); });
addParagraphBlockBtn.addEventListener("click", (e) => { e.preventDefault(); addSummaryBlock("paragraph"); });

// New "Add Section" button: adds a heading + paragraph pair in one click
const addSectionPairBtn = document.getElementById("addSectionPairBtn");
if (addSectionPairBtn) {
    addSectionPairBtn.addEventListener("click", (e) => {
        e.preventDefault();
        addSummaryBlock("heading");
        addSummaryBlock("paragraph");
    });
}

cancelEditBtn.addEventListener("click", resetForm);

// --- Bulk Paste System ---

/**
 * Parses raw bulk text into an array of { type, text } blocks.
 * Headings are detected by:
 *   1. An underline of asterisks (***...) on the next line:
 *        Chapter Title Here
 *        *********************
 *   2. A line starting with ## (markdown-style heading):
 *        ## Chapter Title Here
 * Everything else is grouped into paragraph blocks (split by blank lines).
 */
function parseBulkContent(rawText) {
    const blocks = [];
    const lines = rawText.split(/\n/);

    // First pass: identify which lines are heading text and which are *** separator lines
    const isAsterisksLine = (line) => /^\*{3,}$/.test(line.trim());
    const isMarkdownHeading = (line) => /^#{2,}\s+/.test(line.trim());

    // Collect heading line indices (a line is a heading if the NEXT non-empty line is all asterisks)
    const headingLineIndices = new Set();
    const separatorLineIndices = new Set();
    const markdownHeadingIndices = new Set();

    for (let i = 0; i < lines.length; i++) {
        if (isAsterisksLine(lines[i])) {
            separatorLineIndices.add(i);
            // The line directly above this (skipping empty lines) is the heading
            for (let j = i - 1; j >= 0; j--) {
                if (lines[j].trim().length > 0) {
                    headingLineIndices.add(j);
                    break;
                }
            }
        } else if (isMarkdownHeading(lines[i])) {
            // Lines starting with ## are also headings
            markdownHeadingIndices.add(i);
        }
    }

    // Second pass: build blocks
    let currentParagraphLines = [];

    function flushParagraph() {
        if (currentParagraphLines.length > 0) {
            const text = currentParagraphLines.join("\n").trim();
            if (text) {
                // Split by blank lines within the accumulated text to create separate paragraphs
                const subParas = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
                subParas.forEach(p => {
                    blocks.push({ type: "paragraph", text: p });
                });
            }
            currentParagraphLines = [];
        }
    }

    for (let i = 0; i < lines.length; i++) {
        // Skip asterisk separator lines entirely
        if (separatorLineIndices.has(i)) {
            continue;
        }

        if (headingLineIndices.has(i)) {
            // Flush any accumulated paragraphs before the heading
            flushParagraph();
            blocks.push({ type: "heading", text: lines[i].trim() });
        } else if (markdownHeadingIndices.has(i)) {
            // Flush any accumulated paragraphs before the ## heading
            flushParagraph();
            // Strip the leading ## (and any extra #s) and whitespace
            const headingText = lines[i].trim().replace(/^#+\s+/, "");
            blocks.push({ type: "heading", text: headingText });
        } else {
            currentParagraphLines.push(lines[i]);
        }
    }

    // Flush any remaining paragraph text
    flushParagraph();

    return blocks;
}

// Open bulk paste modal
bulkPasteBtn.addEventListener("click", (e) => {
    e.preventDefault();
    bulkPasteTextarea.value = "";
    bulkPreview.textContent = "";
    bulkPasteOverlay.classList.add("active");
    bulkPasteTextarea.focus();
});

// Close modal
bulkCancelBtn.addEventListener("click", () => {
    bulkPasteOverlay.classList.remove("active");
});

// Close on overlay click (outside modal)
bulkPasteOverlay.addEventListener("click", (e) => {
    if (e.target === bulkPasteOverlay) {
        bulkPasteOverlay.classList.remove("active");
    }
});

// Live preview: show block count as user types
bulkPasteTextarea.addEventListener("input", () => {
    const raw = bulkPasteTextarea.value.trim();
    if (!raw) {
        bulkPreview.textContent = "";
        return;
    }
    const parsed = parseBulkContent(raw);
    const headings = parsed.filter(b => b.type === "heading").length;
    const paragraphs = parsed.filter(b => b.type === "paragraph").length;
    bulkPreview.textContent = `Preview: ${headings} sub-heading(s) + ${paragraphs} paragraph block(s) detected`;
});

// Confirm: parse and add blocks
bulkConfirmBtn.addEventListener("click", () => {
    const raw = bulkPasteTextarea.value.trim();
    if (!raw) {
        bulkPreview.textContent = "⚠️ Nothing to parse. Paste your content first.";
        return;
    }

    const parsed = parseBulkContent(raw);
    if (parsed.length === 0) {
        bulkPreview.textContent = "⚠️ Could not detect any blocks. Check your formatting.";
        return;
    }

    // Clear all existing blocks (including pre-filled defaults) before adding parsed ones
    summaryBlocksContainer.innerHTML = '';
    const msg = document.createElement('p');
    msg.className = 'no-blocks-message hidden';
    msg.id = 'noBlocksMessage';
    msg.textContent = 'No content blocks yet. Click the buttons below to add one.';
    summaryBlocksContainer.appendChild(msg);

    // Add each parsed block to the editor
    parsed.forEach(block => {
        addSummaryBlock(block.type, block.text, false);
    });

    bulkPasteOverlay.classList.remove("active");
    showAdminMessage(`Bulk paste: replaced with ${parsed.length} block(s) (${parsed.filter(b => b.type === "heading").length} headings, ${parsed.filter(b => b.type === "paragraph").length} paragraphs).`, false);
});

// Delete book functionality
if (deleteBookBtn) {
    deleteBookBtn.addEventListener("click", async () => {
        if (!editingBookSlug) {
            showAdminMessage("No book is currently loaded for editing. Load a book first to delete it.", true);
            return;
        }

        if (!currentAuthUser || currentAuthUser.uid !== ADMIN_UID) {
            showAdminMessage("You do not have admin permissions to delete books.", true);
            return;
        }

        const confirmDelete = confirm(`Are you sure you want to delete the book "${bookTitleInput.value || editingBookSlug}"? This action cannot be undone.`);
        if (!confirmDelete) return;

        deleteBookBtn.disabled = true;
        deleteBookBtn.textContent = "Deleting...";

        try {
            const bookRef = doc(db, "books", editingBookSlug);
            await deleteDoc(bookRef);
            showAdminMessage(`Book "${bookTitleInput.value || editingBookSlug}" has been deleted successfully.`, false);
            resetForm();
        } catch (error) {
            console.error("Error deleting book:", error);
            showAdminMessage("Error deleting book: " + error.message, true);
        } finally {
            deleteBookBtn.disabled = false;
            deleteBookBtn.textContent = "🗑 Delete Book";
        }
    });
}

loadBookBtn.addEventListener("click", () => {
    const slug = loadBookSlugInput.value.trim();
    if (slug) {
        populateFormForEdit(slug);
    } else {
        showAdminMessage("Please enter a book slug to load.", true);
    }
});

bookForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideAdminMessage();

    if (!currentAuthUser || currentAuthUser.uid !== ADMIN_UID) {
        showAdminMessage("You do not have admin permissions to save books.", true);
        return;
    }

    const title = bookTitleInput.value.trim();
    const author = bookAuthorInput.value.trim();
    const category = (bookCategorySelect && bookCategorySelect.value) ? bookCategorySelect.value : "growth";
    const description = bookDescriptionTextarea.value.trim();
    const summaryHeading = summaryMainHeadingInput.value.trim();
    const summaryBlocks = collectSummaryBlocks();

    if (!title || !author || !description || !summaryHeading || summaryBlocks.length === 0) {
        showAdminMessage("Please fill in all required book details and add at least one summary block.", true);
        return;
    }

    // Set loading state
    saveBookBtn.disabled = true;
    saveBookBtn.classList.add("btn-loading");
    saveBookBtnText.style.opacity = "0";

    try {
        // Determine the slug (new book or existing)
        const bookSlug = editingBookSlug || generateSlug(title);

        // Slug collision check for new books
        if (!editingBookSlug) {
            const existingRef = doc(db, "books", bookSlug);
            const existingSnap = await getDoc(existingRef);
            if (existingSnap.exists()) {
                const overwrite = confirm(`A book with the slug "${bookSlug}" already exists ("${existingSnap.data().title}"). Do you want to overwrite it?`);
                if (!overwrite) {
                    saveBookBtn.disabled = false;
                    saveBookBtn.classList.remove("btn-loading");
                    saveBookBtnText.style.opacity = "1";
                    return;
                }
            }
        }

        // Upload files to Storage and get URLs
        const coverUrl = await uploadFile(bookCoverFileInput, "covers") || bookCoverUrlInput.value.trim();
        const audioUrl = await uploadFile(bookAudioFileInput, "audio") || bookAudioUrlInput.value.trim();

        const bookData = {
            title,
            author,
            category,
            description,
            coverUrl,
            audioUrl,
            summaryHeading,
            summaryBlocks,
            updatedAt: serverTimestamp(),
        };

        const bookRef = doc(db, "books", bookSlug);

        if (!editingBookSlug) {
            // Only set createdAt for new documents
            bookData.createdAt = serverTimestamp();
        }

        await setDoc(bookRef, bookData, { merge: true });

        showAdminMessage(`Book '${title}' saved successfully!`, false);
        resetForm();
        // After saving, consider loading the newly saved book or updating a list.
        // For now, we just reset the form.
    } catch (error) {
        console.error("Error saving book:", error);
        showAdminMessage("Error saving book: " + error.message, true);
    } finally {
        saveBookBtn.disabled = false;
        saveBookBtn.classList.remove("btn-loading");
        saveBookBtnText.style.opacity = "1";
    }
});

// Initial setup: pre-populate with default sub-heading + paragraph blocks
addDefaultBlocks();
