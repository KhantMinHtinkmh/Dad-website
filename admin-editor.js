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
    blockDiv.className = "summary-block-item";
    blockDiv.dataset.type = type;

    // Controls row
    const controls = document.createElement("div");
    controls.className = "summary-block-controls";

    const typeSelect = document.createElement("select");
    typeSelect.className = "block-type-select";
    const optHeading = document.createElement("option"); optHeading.value = "heading"; optHeading.text = "Sub-heading";
    const optParagraph = document.createElement("option"); optParagraph.value = "paragraph"; optParagraph.text = "Paragraph";
    typeSelect.append(optHeading, optParagraph);
    typeSelect.value = type;

    const moveUpBtn = document.createElement("button"); moveUpBtn.className = "move-block-up"; moveUpBtn.title = "Move up"; moveUpBtn.textContent = "▲";
    const moveDownBtn = document.createElement("button"); moveDownBtn.className = "move-block-down"; moveDownBtn.title = "Move down"; moveDownBtn.textContent = "▼";
    const removeButton = document.createElement("button"); removeButton.className = "remove-block-btn"; removeButton.title = "Remove block"; removeButton.textContent = "×";

    controls.append(typeSelect, moveUpBtn, moveDownBtn, removeButton);

    const textarea = document.createElement("textarea");
    textarea.className = "admin-textarea block-textarea";
    textarea.placeholder = type === "heading" ? "Sub-heading text..." : "Paragraph content...";
    textarea.rows = type === "heading" ? 1 : 3;
    textarea.value = text || "";

    const hint = document.createElement("p");
    hint.className = "form-hint";
    hint.style.marginTop = "0.5rem";
    hint.innerHTML = 'Tip: Use <code>**text**</code> to make text bold. Example: <code>This is **important**.</code>';

    blockDiv.append(controls, textarea, hint);
    return blockDiv;
}

function addSummaryBlock(type = "paragraph", text = "") {
    const newBlock = createSummaryBlockElement(type, text);
    summaryBlocksContainer.appendChild(newBlock);
    // focus textarea
    const ta = newBlock.querySelector("textarea");
    if (ta) ta.focus();
    updateNoBlocksMessage();
}

function updateNoBlocksMessage() {
    if (!noBlocksMessage) return;
    noBlocksMessage.classList.toggle("hidden", summaryBlocksContainer.children.length > 0);
}

function collectSummaryBlocks() {
    const blocks = [];
    Array.from(summaryBlocksContainer.children).forEach((blockEl) => {
        const typeSelect = blockEl.querySelector(".block-type-select");
        const textarea = blockEl.querySelector("textarea");
        const type = typeSelect ? typeSelect.value : (blockEl.dataset.type || "paragraph");
        const text = textarea ? textarea.value.trim() : "";
        if (text) blocks.push({ type, text });
    });
    return blocks;
}

function populateSummaryBlocks(summaryBlocks) {
    summaryBlocksContainer.innerHTML = "";
    if (!Array.isArray(summaryBlocks) || summaryBlocks.length === 0) {
        updateNoBlocksMessage();
        return;
    }
    summaryBlocks.forEach(b => addSummaryBlock(b.type || "paragraph", b.text || ""));
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
    if (ta) {
        ta.placeholder = type === "heading" ? "Sub-heading text..." : "Paragraph content...";
        ta.rows = type === "heading" ? 1 : 3;
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
    summaryBlocksContainer.innerHTML = "";
    editingBookSlug = null;
    saveBookBtnText.textContent = "Save Book";
    loadBookSlugInput.value = "";
    hideAdminMessage();
    updateNoBlocksMessage();
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
cancelEditBtn.addEventListener("click", resetForm);

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

// Initial setup
updateNoBlocksMessage();
