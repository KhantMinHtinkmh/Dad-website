
        import {
            auth,
            db,
            storage,
            onAuthStateChanged,
            createUserWithEmailAndPassword,
            signInWithEmailAndPassword,
            signOut,
            collection,
            addDoc,
            getDocs,
            updateDoc,
            deleteDoc,
            doc,
            serverTimestamp,
            ref,
            uploadBytes,
            getDownloadURL,
            query,
            where,
        } from "./firebase-init.js";



        const categoryViewEl = document.getElementById("categoryView");
        const allBooksContainerEl = document.getElementById("allBooksContainer");

        // Drag-to-scroll for category grid
        (function initDragScroll() {
            const grid = document.querySelector('.cat-grid');
            if (!grid) return;
            let isDown = false, startX, scrollLeft;

            grid.addEventListener('mousedown', (e) => {
                isDown = true;
                grid.classList.add('dragging');
                startX = e.pageX - grid.offsetLeft;
                scrollLeft = grid.scrollLeft;
            });
            grid.addEventListener('mouseleave', () => { isDown = false; grid.classList.remove('dragging'); });
            grid.addEventListener('mouseup', () => { isDown = false; grid.classList.remove('dragging'); });
            grid.addEventListener('mousemove', (e) => {
                if (!isDown) return;
                e.preventDefault();
                const x = e.pageX - grid.offsetLeft;
                grid.scrollLeft = scrollLeft - (x - startX) * 1.5;
            });
        })();

        // Category definitions for display
        const CATEGORIES_CONFIG = [
            { id: "personal-growth", heading: "🌱 Personal Growth", coverShadowClass: "shadow-orange-100" },
            { id: "psychology-self-help", heading: "✨ Psychology & Self-Help", coverShadowClass: "shadow-rose-100" },
            { id: "digital-ai", heading: "📱 Digital Lifestyle & AI", coverShadowClass: "shadow-cyan-100" },
            { id: "techpreneurship", heading: "🚀 Techpreneurship & Startups", coverShadowClass: "shadow-green-100" },
            { id: "coaching-nlp", heading: "🎯 Coaching & NLP", coverShadowClass: "shadow-blue-100" },
            { id: "mindfulness-health", heading: "🧘 Mindfulness & Holistic Health", coverShadowClass: "shadow-purple-100" },
            { id: "business-economics", heading: "📈 Business & Economics", coverShadowClass: "shadow-amber-100" },
            { id: "society-politics", heading: "🏛️ Society, Politics & Philosophy", coverShadowClass: "shadow-indigo-100" },
            { id: "family-parenting", heading: "👨‍👩‍👧 Family & Parenting", coverShadowClass: "shadow-teal-100" },
            { id: "copywriting", heading: "✍️ Copywriting & Content Writing", coverShadowClass: "shadow-pink-100" },
            { id: "career-productivity", heading: "💼 Career & Productivity", coverShadowClass: "shadow-sky-100" },
        ];

        // Fetch ALL books from Firestore in a single query, then group by category
        async function fetchBooksFromFirestore() {
            // Mapping of old/legacy category values → current category ID
            const normalizeCategoryMap = {
                "growth": "personal-growth",
                "self-help": "psychology-self-help",
                "digital": "digital-ai",
                "coaching": "coaching-nlp",
                "emotional-healing": "mindfulness-health",
                "sales": "business-economics",
                "psychology": "society-politics",
                "parenting": "family-parenting",
            };

            // Valid current category IDs (from CATEGORIES_CONFIG)
            const validCategoryIds = new Set(CATEGORIES_CONFIG.map(c => c.id));

            try {
                // Single query: fetch ALL books from the collection (no limit, no cache)
                const booksCol = collection(db, "books");
                const querySnapshot = await getDocs(booksCol);

                console.log(`Fetched ${querySnapshot.docs.length} books from Firestore`);

                // Group books by their (normalized) category
                const categoryBooksMap = {}; // categoryId → [book, book, ...]

                querySnapshot.docs.forEach(docSnap => {
                    const data = docSnap.data();
                    let category = data.category || "";

                    // Normalize old category values to current ones
                    if (normalizeCategoryMap[category]) {
                        category = normalizeCategoryMap[category];
                    }

                    // If category still doesn't match any known category, put in first matching or skip
                    if (!validCategoryIds.has(category)) {
                        console.warn(`Book "${data.title}" (${docSnap.id}) has unknown category "${data.category}". Placing in "personal-growth".`);
                        category = "personal-growth"; // fallback
                    }

                    if (!categoryBooksMap[category]) {
                        categoryBooksMap[category] = [];
                    }

                    categoryBooksMap[category].push({
                        id: docSnap.id,
                        title: data.title || "",
                        author: data.author || "",
                        img: data.coverUrl || data.coverImageUrl || data.img || "/assets/default-book-cover.svg",
                        href: `summary.html?id=${encodeURIComponent(docSnap.id)}`
                    });
                });

                // Build the result array in the same format as before (matching CATEGORIES_CONFIG order)
                // Include ALL categories — those with books get their books, empty ones get an empty array
                const categoriesWithBooks = CATEGORIES_CONFIG.map(category => ({
                    ...category,
                    books: categoryBooksMap[category.id] || []
                }));

                return categoriesWithBooks;

            } catch (error) {
                console.error("Error fetching all books:", error);
                return [];
            }
        }

        function escapeHtml(value) {
            return String(value)
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;")
                .replaceAll('"', "&quot;")
                .replaceAll("'", "&#039;");
        }

        function renderBookTile(book, coverShadowClass) {
            return `
                <a class="book-tile" href="${escapeHtml(book.href)}">
                    <div class="tile-cover ${escapeHtml(coverShadowClass)}">
                        <img src="${escapeHtml(book.img)}" alt="${escapeHtml(book.title)} cover" loading="lazy" decoding="async" onerror="this.src='/assets/default-book-cover.svg'">
                    </div>
                    <div class="tile-title">${escapeHtml(book.title)}</div>
                    <div class="tile-author">${escapeHtml(book.author)}</div>
                </a>
            `;
        }

        let allCategoriesWithBooksCache = null;

        async function getOrFetchBooks() {
            if (allCategoriesWithBooksCache) return allCategoriesWithBooksCache;
            allCategoriesWithBooksCache = await fetchBooksFromFirestore();
            return allCategoriesWithBooksCache;
        }

        async function renderBooksForCategory(categoryId) {
            if (!allBooksContainerEl) return;

            // Show loading state immediately
            allBooksContainerEl.innerHTML = '<div class="text-center py-12"><p class="text-slate-500">Loading books...</p></div>';

            // Fetch books from Firestore or cache
            const categoriesWithBooks = await getOrFetchBooks();
            const category = categoriesWithBooks.find(cat => cat.id === categoryId);

            if (!category) {
                allBooksContainerEl.innerHTML = '<div class="text-center py-12"><p class="text-slate-500">Category not found.</p></div>';
                return;
            }

            const booksSectionTitle = document.getElementById("booksSectionTitle");
            if (booksSectionTitle) {
                booksSectionTitle.textContent = "Books in Category";
            }

            if (!category.books || category.books.length === 0) {
                allBooksContainerEl.innerHTML = '<div class="text-center py-12"><p class="text-slate-500">No books found in this category.</p></div>';
                return;
            }

            const booksHtml = category.books
                .map((book) => renderBookTile(book, category.coverShadowClass))
                .join("");

            const stripClass =
                category.books.length > 3
                    ? "category-books-strip"
                    : "category-books-strip category-books-strip--compact";

            allBooksContainerEl.innerHTML = `
                <section id="cat-${escapeHtml(category.id)}">
                    <h3 class="text-2xl font-800 mb-5">${escapeHtml(category.heading)}</h3>
                    <div class="category-books-strip-shell">
                        <div
                            class="${stripClass}"
                            role="region"
                            aria-label="${escapeHtml(category.heading)} — scroll sideways for more books"
                        >
                            <div class="category-books-strip__track">
                                ${booksHtml}
                            </div>
                        </div>
                        <button
                            type="button"
                            class="category-books-strip__next"
                            aria-label="Show more books in this category"
                            hidden
                        >
                            <svg class="category-books-strip__next-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="m10 7 5 5-5 5" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </section>
            `;

            initCategoryBookStrips();
        }

        categoryViewEl.addEventListener("click", (event) => {
            const btn = event.target && event.target.closest ? event.target.closest("[data-category]") : null;
            if (!btn) return;
            
            // Highlight active button
            document.querySelectorAll(".cat-pill").forEach(pill => pill.classList.remove("is-active"));
            btn.classList.add("is-active");

            const categoryId = btn.dataset.category;
            renderBooksForCategory(categoryId).catch(error => {
                console.error("Error rendering category books:", error);
                allBooksContainerEl.innerHTML = `<p class="text-center text-slate-500">Unable to load books. Please try again later.</p>`;
            });
        });

        // Pre-fetch books on load, but do not display them automatically
        getOrFetchBooks().catch(error => console.error("Error pre-fetching books:", error));

        function initCategoryBookStrips() {
            document.querySelectorAll(".category-books-strip-shell").forEach((shell) => {
                const strip = shell.querySelector(".category-books-strip");
                const btn = shell.querySelector(".category-books-strip__next");
                if (!strip || !btn) return;

                function updateStripChrome() {
                    const canScrollX = strip.scrollWidth > strip.clientWidth + 2;
                    const atEnd = strip.scrollLeft >= strip.scrollWidth - strip.clientWidth - 2;
                    const showNext = canScrollX && !atEnd;
                    btn.hidden = !showNext;
                    shell.classList.toggle("category-books-strip-shell--at-end", canScrollX && atEnd);
                }

                strip.addEventListener("scroll", updateStripChrome, { passive: true });
                window.addEventListener("resize", updateStripChrome);
                btn.addEventListener("click", function () {
                    strip.scrollBy({ left: Math.max(120, strip.clientWidth * 0.72), behavior: "smooth" });
                });

                if ("ResizeObserver" in window) {
                    const ro = new ResizeObserver(updateStripChrome);
                    ro.observe(strip);
                }

                updateStripChrome();
            });
        }

        initCategoryBookStrips();

        if (!window.location.hash) {
            window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        }

        const openAuthModalBtn = document.getElementById("openAuthModal");
        const mobileOpenAuthModalBtn = document.getElementById("mobileOpenAuthModal");
        const openAdminEditorBtn = document.getElementById("openAdminEditorBtn");
        const mobileOpenAdminEditor = document.getElementById("mobileOpenAdminEditor");
        const logoutBtn = document.getElementById("logoutBtn");
        const mobileLogoutBtn = document.getElementById("mobileLogoutBtn");
        const heroCtaBtn = document.getElementById("heroCtaBtn");
        const authModal = document.getElementById("authModal");
        const closeAuthModalBtn = document.getElementById("closeAuthModal");
        const loginTabBtn = document.getElementById("loginTabBtn");
        const signupTabBtn = document.getElementById("signupTabBtn");
        const loginForm = document.getElementById("loginForm");
        const signupForm = document.getElementById("signupForm");
        const loginErrorEl = document.getElementById("loginError");
        const signupErrorEl = document.getElementById("signupError");
        const adminEditorMenu = document.getElementById("adminEditorMenu");
        const adminMenuToggle = document.getElementById("adminMenuToggle");
        const adminMenuPanel = document.getElementById("adminMenuPanel");
        const adminMenuSignOut = document.getElementById("adminMenuSignOut");
        const adminBookForm = document.getElementById("adminBookForm");
        const adminBookTitle = document.getElementById("adminBookTitle");
        const adminBookAuthor = document.getElementById("adminBookAuthor");
        const adminBookSummary = document.getElementById("adminBookSummary");
        const adminBookImageFile = document.getElementById("adminBookImageFile");
        const adminBookImageUrl = document.getElementById("adminBookImageUrl");
        const adminBookSubmitBtn = document.getElementById("adminBookSubmitBtn");
        const adminBookCancelEditBtn = document.getElementById("adminBookCancelEditBtn");
        const adminBookFormMsg = document.getElementById("adminBookFormMsg");
        const adminBooksList = document.getElementById("adminBooksList");
        const ADMIN_UID = "iOeLZw42zpdvx966peaBHSJ8Fdr2";
        // Admin emails (lowercase). Add one or more admin emails here.
        const ADMIN_EMAILS = ["admin@youremail.com"];
        // Admin nav button behavior
        if (openAdminEditorBtn) {
            openAdminEditorBtn.addEventListener("click", function () {
                window.location.href = "admin-editor.html";
            });
        }
        if (mobileOpenAdminEditor) {
            mobileOpenAdminEditor.addEventListener("click", function () {
                window.location.href = "admin-editor.html";
            });
        }
        let currentAuthUser = null;
        let editingBookId = null;

        function getAuthErrorMessage(error, mode) {
            const code = error && error.code ? error.code : "";
            if (mode === "login") {
                if (code === "auth/invalid-credential") return "Email or password is incorrect.";
                if (code === "auth/user-not-found") return "No account found for this email.";
                if (code === "auth/wrong-password") return "Password is incorrect.";
                if (code === "auth/too-many-requests") return "Too many attempts. Please wait and try again.";
                if (code === "auth/user-disabled") return "This account has been disabled.";
            }
            if (mode === "signup") {
                if (code === "auth/email-already-in-use") return "This email is already in use. Try logging in instead.";
                if (code === "auth/weak-password") return "Password should be at least 6 characters.";
            }
            if (code === "auth/network-request-failed") return "Network issue. Check internet connection and try again.";
            if (code === "auth/invalid-email") return "Please enter a valid email address.";
            if (code === "auth/unauthorized-domain") return "This website domain is not authorized in Firebase Auth settings.";
            if (code === "auth/operation-not-allowed") return "Email/password sign-in is not enabled in Firebase.";
            return (mode === "signup" ? "Signup failed. " : "Login failed. ") + (error && error.message ? error.message : "Please try again.");
        }

        function showLoginTab() {
            loginTabBtn.classList.add("active");
            signupTabBtn.classList.remove("active");
            loginForm.classList.remove("hidden");
            signupForm.classList.add("hidden");
        }

        function showSignupTab() {
            signupTabBtn.classList.add("active");
            loginTabBtn.classList.remove("active");
            signupForm.classList.remove("hidden");
            loginForm.classList.add("hidden");
        }

        function openModal() {
            authModal.classList.remove("hidden");
            authModal.setAttribute("aria-hidden", "false");
            document.body.style.overflow = "hidden";
            if (loginErrorEl) {
                loginErrorEl.textContent = "";
                loginErrorEl.classList.add("hidden");
            }
            if (signupErrorEl) {
                signupErrorEl.textContent = "";
                signupErrorEl.classList.add("hidden");
            }
        }

        function closeModal() {
            authModal.classList.add("hidden");
            authModal.setAttribute("aria-hidden", "true");
            document.body.style.overflow = "";
        }

        if (openAuthModalBtn) {
            openAuthModalBtn.addEventListener("click", openModal);
        }
        if (mobileOpenAuthModalBtn) {
            mobileOpenAuthModalBtn.addEventListener("click", function () {
                openModal();
                closeMobileNav();
            });
        }
        if (heroCtaBtn) {
            heroCtaBtn.addEventListener("click", function (event) {
                event.preventDefault();
                openModal();
            });
        }
        closeAuthModalBtn.addEventListener("click", closeModal);
        loginTabBtn.addEventListener("click", showLoginTab);
        signupTabBtn.addEventListener("click", showSignupTab);

        authModal.addEventListener("click", function (event) {
            if (event.target && event.target.dataset && event.target.dataset.closeModal === "true") {
                closeModal();
            }
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && !authModal.classList.contains("hidden")) {
                closeModal();
            }
        });

        loginForm.addEventListener("submit", async function (event) {
            event.preventDefault();
            if (loginErrorEl) {
                loginErrorEl.textContent = "";
                loginErrorEl.classList.add("hidden");
            }

            const email = document.getElementById("loginEmail").value.trim();
            const password = document.getElementById("loginPassword").value;

            try {
                await signInWithEmailAndPassword(auth, email, password);
                loginForm.reset();
                closeModal();
            } catch (error) {
                if (loginErrorEl) {
                    loginErrorEl.textContent = getAuthErrorMessage(error, "login");
                    loginErrorEl.classList.remove("hidden");
                }
                console.error(error);
            }
        });

        signupForm.addEventListener("submit", async function (event) {
            event.preventDefault();
            if (signupErrorEl) {
                signupErrorEl.textContent = "";
                signupErrorEl.classList.add("hidden");
            }

            const name = document.getElementById("signupName").value.trim();
            const email = document.getElementById("signupEmail").value.trim();
            const password = document.getElementById("signupPassword").value;

            try {
                await createUserWithEmailAndPassword(auth, email, password);
                signupForm.reset();
                closeModal();
                if (name) {
                    console.log("Signed up user:", name);
                }
            } catch (error) {
                if (signupErrorEl) {
                    signupErrorEl.textContent = getAuthErrorMessage(error, "signup");
                    signupErrorEl.classList.remove("hidden");
                }
                console.error(error);
            }
        });

        async function handleLogout() {
            try {
                await signOut(auth);
            } catch (error) {
                console.error(error);
            }
        }

        function resetAdminBookForm() {
            editingBookId = null;
            if (adminBookForm) adminBookForm.reset();
            if (adminBookSubmitBtn) adminBookSubmitBtn.textContent = "Add Book";
            if (adminBookCancelEditBtn) adminBookCancelEditBtn.classList.add("hidden");
        }

        function showAdminBookMessage(message, isError) {
            if (!adminBookFormMsg) return;
            adminBookFormMsg.textContent = message;
            adminBookFormMsg.classList.remove("hidden");
            adminBookFormMsg.classList.toggle("admin-editor-message--error", !!isError);
        }

        function hideAdminBookMessage() {
            if (!adminBookFormMsg) return;
            adminBookFormMsg.textContent = "";
            adminBookFormMsg.classList.add("hidden");
            adminBookFormMsg.classList.remove("admin-editor-message--error");
        }

        function renderAdminBooks(books) {
            if (!adminBooksList) return;
            if (!books.length) {
                adminBooksList.innerHTML = '<p class="admin-editor-empty">No books yet.</p>';
                return;
            }
            adminBooksList.innerHTML = books
                .map(function (book) {
                    return `
                        <article class="admin-editor-item">
                            <div class="admin-editor-item__head">
                                <h4>${escapeHtml(book.title || "Untitled")}</h4>
                                <p>${escapeHtml(book.author || "Unknown author")}</p>
                            </div>
                            <div class="admin-editor-item__actions">
                                <button type="button" class="admin-editor-btn" data-admin-action="edit" data-book-id="${escapeHtml(book.id)}">Edit</button>
                                <button type="button" class="admin-editor-btn admin-editor-btn--danger" data-admin-action="delete" data-book-id="${escapeHtml(book.id)}">Delete</button>
                            </div>
                        </article>
                    `;
                })
                .join("");
        }

        async function fetchBooksForAdmin() {
            if (!currentAuthUser || currentAuthUser.uid !== ADMIN_UID) return;
            try {
                const snap = await getDocs(collection(db, "books"));
                const books = snap.docs.map(function (docSnap) {
                    return { id: docSnap.id, ...docSnap.data() };
                });
                books.sort(function (a, b) {
                    return (a.title || "").localeCompare(b.title || "");
                });
                renderAdminBooks(books);
            } catch (error) {
                console.error(error);
                showAdminBookMessage("Could not load books. " + (error.message || ""), true);
            }
        }

        async function resolveAdminBookImageUrl() {
            const file = adminBookImageFile && adminBookImageFile.files ? adminBookImageFile.files[0] : null;
            const directUrl = adminBookImageUrl ? adminBookImageUrl.value.trim() : "";
            if (file) {
                const path = "bookcovers/" + Date.now() + "-" + file.name.replace(/\s+/g, "-");
                const fileRef = ref(storage, path);
                await uploadBytes(fileRef, file);
                return getDownloadURL(fileRef);
            }
            return directUrl;
        }

        if (logoutBtn) {
            logoutBtn.addEventListener("click", handleLogout);
        }
        if (mobileLogoutBtn) {
            mobileLogoutBtn.addEventListener("click", async function () {
                await handleLogout();
                closeMobileNav();
            });
        }
        if (adminMenuToggle && adminMenuPanel) {
            adminMenuToggle.addEventListener("click", function () {
                const isOpen = !adminMenuPanel.classList.contains("hidden");
                adminMenuPanel.classList.toggle("hidden", isOpen);
                adminMenuToggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
            });
        }
        if (adminMenuSignOut) {
            adminMenuSignOut.addEventListener("click", handleLogout);
        }
        if (adminBookCancelEditBtn) {
            adminBookCancelEditBtn.addEventListener("click", function () {
                hideAdminBookMessage();
                resetAdminBookForm();
            });
        }
        if (adminBookForm) {
            adminBookForm.addEventListener("submit", async function (event) {
                event.preventDefault();
                hideAdminBookMessage();
                if (!currentAuthUser || currentAuthUser.uid !== ADMIN_UID) {
                    showAdminBookMessage("You do not have admin permission.", true);
                    return;
                }

                const title = adminBookTitle.value.trim();
                const author = adminBookAuthor.value.trim();
                const summary = adminBookSummary.value.trim();
                if (!title || !author || !summary) {
                    showAdminBookMessage("Title, author, and summary are required.", true);
                    return;
                }

                try {
                    const imageUrl = await resolveAdminBookImageUrl();
                    const payload = {
                        title: title,
                        author: author,
                        summary: summary,
                        img: imageUrl || "",
                        updatedAt: serverTimestamp(),
                    };
                    if (editingBookId) {
                        await updateDoc(doc(db, "books", editingBookId), payload);
                        showAdminBookMessage("Book updated.");
                    } else {
                        payload.createdAt = serverTimestamp();
                        await addDoc(collection(db, "books"), payload);
                        showAdminBookMessage("Book added.");
                    }
                    resetAdminBookForm();
                    await fetchBooksForAdmin();
                } catch (error) {
                    console.error(error);
                    showAdminBookMessage("Save failed. " + (error.message || ""), true);
                }
            });
        }
        if (adminBooksList) {
            adminBooksList.addEventListener("click", async function (event) {
                const button = event.target && event.target.closest ? event.target.closest("[data-admin-action]") : null;
                if (!button) return;
                if (!currentAuthUser || currentAuthUser.uid !== ADMIN_UID) return;
                const action = button.getAttribute("data-admin-action");
                const bookId = button.getAttribute("data-book-id");
                if (!action || !bookId) return;

                if (action === "delete") {
                    const ok = window.confirm("Delete this book?");
                    if (!ok) return;
                    try {
                        await deleteDoc(doc(db, "books", bookId));
                        if (editingBookId === bookId) resetAdminBookForm();
                        await fetchBooksForAdmin();
                    } catch (error) {
                        console.error(error);
                        showAdminBookMessage("Delete failed. " + (error.message || ""), true);
                    }
                    return;
                }

                if (action === "edit") {
                    try {
                        const snap = await getDocs(collection(db, "books"));
                        const found = snap.docs.find(function (d) { return d.id === bookId; });
                        if (!found) return;
                        const data = found.data();
                        editingBookId = bookId;
                        adminBookTitle.value = data.title || "";
                        adminBookAuthor.value = data.author || "";
                        adminBookSummary.value = data.summary || "";
                        adminBookImageUrl.value = data.img || "";
                        if (adminBookImageFile) adminBookImageFile.value = "";
                        adminBookSubmitBtn.textContent = "Update Book";
                        adminBookCancelEditBtn.classList.remove("hidden");
                    } catch (error) {
                        console.error(error);
                        showAdminBookMessage("Could not open this book for edit.", true);
                    }
                }
            });
        }

        onAuthStateChanged(auth, function (user) {
            const isLoggedIn = !!user;
            const userEmail = isLoggedIn && user.email ? user.email.toLowerCase() : "";
            const isAdmin = isLoggedIn && (user.uid === ADMIN_UID || ADMIN_EMAILS.includes(userEmail));
            if (isAdmin) console.log("Admin detected:", userEmail || user.uid);
            currentAuthUser = user || null;
            if (openAuthModalBtn) openAuthModalBtn.classList.toggle("hidden", isLoggedIn);
            if (mobileOpenAuthModalBtn) mobileOpenAuthModalBtn.classList.toggle("hidden", isLoggedIn);
            if (openAdminEditorBtn) openAdminEditorBtn.classList.toggle("hidden", !isAdmin);
            if (mobileOpenAdminEditor) mobileOpenAdminEditor.classList.toggle("hidden", !isAdmin);
            if (logoutBtn) logoutBtn.classList.toggle("hidden", !isLoggedIn);
            if (mobileLogoutBtn) mobileLogoutBtn.classList.toggle("hidden", !isLoggedIn);
            if (adminEditorMenu) adminEditorMenu.classList.toggle("hidden", !isAdmin);
            if (adminMenuPanel && !isAdmin) adminMenuPanel.classList.add("hidden");
            if (adminMenuToggle && !isAdmin) adminMenuToggle.setAttribute("aria-expanded", "false");
            if (isAdmin) {
                fetchBooksForAdmin();
            } else {
                renderAdminBooks([]);
                resetAdminBookForm();
                hideAdminBookMessage();
            }
        });

        // Mobile nav dropdown
        const mobileNavBtn = document.getElementById("mobileNavBtn");
        const mobileNavPanel = document.getElementById("mobileNavPanel");
        const mobileCategoriesBtn = document.getElementById("mobileCategoriesBtn");
        const mobileCategoriesMenu = document.getElementById("mobileCategoriesMenu");

        function closeMobileNav() {
            if (!mobileNavPanel || !mobileNavBtn) return;
            mobileNavPanel.classList.add("hidden");
            mobileNavBtn.setAttribute("aria-expanded", "false");
        }

        function setMobileCategoriesOpen(open) {
            if (!mobileCategoriesBtn || !mobileCategoriesMenu) return;
            mobileCategoriesMenu.classList.toggle("hidden", !open);
            mobileCategoriesBtn.setAttribute("aria-expanded", open ? "true" : "false");
        }

        function toggleMobileNav() {
            if (!mobileNavPanel || !mobileNavBtn) return;
            const isHidden = mobileNavPanel.classList.contains("hidden");
            mobileNavPanel.classList.toggle("hidden", !isHidden);
            mobileNavBtn.setAttribute("aria-expanded", isHidden ? "true" : "false");
            if (!isHidden) {
                setMobileCategoriesOpen(false);
            }
        }

        if (mobileNavBtn && mobileNavPanel) {
            mobileNavBtn.addEventListener("click", function (event) {
                event.stopPropagation();
                toggleMobileNav();
            });

            if (mobileCategoriesBtn) {
                mobileCategoriesBtn.addEventListener("click", function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    const isOpen = mobileCategoriesBtn.getAttribute("aria-expanded") === "true";
                    setMobileCategoriesOpen(!isOpen);
                });
            }

            mobileNavPanel.addEventListener("click", function (event) {
                const link = event.target && event.target.closest ? event.target.closest("a") : null;
                if (link) {
                    closeMobileNav();
                    setMobileCategoriesOpen(false);
                }
            });

            document.addEventListener("click", function (event) {
                if (mobileNavPanel.classList.contains("hidden")) return;
                if (event.target === mobileNavBtn || mobileNavBtn.contains(event.target)) return;
                if (mobileNavPanel.contains(event.target)) return;
                closeMobileNav();
            });

            document.addEventListener("keydown", function (event) {
                if (event.key === "Escape") {
                    closeMobileNav();
                }
            });
        }

    