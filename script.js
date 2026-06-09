import { db, collection, getDocs, query, orderBy } from "./firebase-init.js";

// Helper to generate a slug from a title
function generateSlug(title) {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "") // Remove non-alphanumeric chars (except spaces and hyphens)
        .replace(/\s+/g, "-") // Replace spaces with hyphens
        .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}

async function fetchAndRenderBooks() {
    const allBooksContainer = document.getElementById("allBooksContainer");
    if (!allBooksContainer) return;

    allBooksContainer.innerHTML = ''; // Clear existing content

    try {
        const booksCol = collection(db, "books");
        const q = query(booksCol, orderBy("timestamp", "desc")); // Order by timestamp, newest first
        const bookSnapshot = await getDocs(q);

        if (bookSnapshot.empty) {
            allBooksContainer.innerHTML = "<p>No books found.</p>";
            return;
        }

        bookSnapshot.forEach((doc) => {
            const book = doc.data();
            const bookId = doc.id;
            const bookCard = `
                <a href="summary.html?id=${bookId}" class="block bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 ease-in-out overflow-hidden transform hover:-translate-y-1">
                    <div class="flex items-center p-4">
                        <img src="${book.coverImageUrl || '/assets/default-book-cover.jpg'}" alt="${book.title} cover" class="w-20 h-28 object-cover rounded-md mr-4 shadow-sm">
                        <div>
                            <h3 class="text-lg font-semibold text-slate-800">${book.title}</h3>
                            <p class="text-sm text-slate-500">${book.author}</p>
                            ${book.description ? `<p class="text-xs text-slate-600 mt-1">${book.description}</p>` : ''}
                        </div>
                    </div>
                </a>
            `;
            allBooksContainer.innerHTML += bookCard;
        });

    } catch (error) {
        console.error("Error fetching books: ", error);
        allBooksContainer.innerHTML = "<p class='text-rose-600'>Error loading books. Please try again later.</p>";
    }
}

// Initial fetch and render when the page loads
document.addEventListener("DOMContentLoaded", fetchAndRenderBooks);

// --- Category Filtering (re-implement if needed, currently not used from Firebase) ---
// Note: This part assumes categories are still somewhat client-side or fetched separately.
// For now, it will simply fetch all books. If actual category filtering is needed,
// a more complex query would be required using 'where' clauses.
const categoryButtons = document.querySelectorAll('.cat-pill');
categoryButtons.forEach(button => {
    button.addEventListener('click', (e) => {
        // Here you would typically filter books based on category.
        // For simplicity, we'll refetch all books for now, but a real implementation
        // would pass the category to fetchAndRenderBooks or filter the existing array.
        console.log("Category clicked:", e.target.dataset.category);
        // If categories are to filter Firebase data, you'd call something like:
        // fetchAndRenderBooks(e.target.dataset.category);
        // Or if data is already loaded, filter the displayed elements.
    });
});
