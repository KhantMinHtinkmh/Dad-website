// This script will fetch book data from Firebase and populate the summary.html page.

// Helper function to convert markdown-style bold to HTML
function convertMarkdownBold(text) {
    if (!text) return text;
    // Replace **text** with <strong>text</strong>
    return text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

// Cache management functions
function getCachedBook(bookId) {
    try {
        const cached = localStorage.getItem(`book_${bookId}`);
        const timestamp = localStorage.getItem(`book_${bookId}_ts`);
        if (cached && timestamp) {
            const age = Date.now() - parseInt(timestamp);
            if (age < 86400000) { // 24 hours in milliseconds
                console.log("Loaded book from cache");
                return JSON.parse(cached);
            }
        }
    } catch (e) {
        console.warn("Cache read error:", e);
    }
    return null;
}

function cacheBook(bookId, bookData) {
    try {
        localStorage.setItem(`book_${bookId}`, JSON.stringify(bookData));
        localStorage.setItem(`book_${bookId}_ts`, Date.now().toString());
    } catch (e) {
        console.warn("Cache write error:", e);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Show loading state immediately
    const bookCover = document.getElementById('bookCover');
    bookCover.classList.add('loading');
    
    // Firebase and Firestore imports
    const { db, doc, getDoc, collection, getDocs, query, where } = await import('./firebase-init.js');

    // Get the book ID from the URL query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const bookId = urlParams.get('id');

    console.log('Book ID from URL:', bookId);

    if (!bookId) {
        document.getElementById('bookTitle').textContent = "Book Not Found";
        document.getElementById('summaryContent').innerHTML = "<p>No book ID was provided in the URL. Please go back to the library and select a book.</p>";
        bookCover.classList.remove('loading');
        return;
    }

    try {
        // Check cache first
        let book = getCachedBook(bookId);
        
        if (!book) {
            // Try to fetch from Firebase
            let docSnap = null;

            // Attempt 1: Try direct ID match
            const docRef = doc(db, "books", bookId);
            docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                book = docSnap.data();
                console.log('Book found with ID:', bookId, book);
            } else {
                // Attempt 2: Try searching by title (in case ID is a slug variation)
                console.log('Direct ID not found, searching by title in collection...');
                const booksCol = collection(db, "books");
                const q = query(booksCol, where("title", "==", decodeURIComponent(bookId)));
                const querySnapshot = await getDocs(q);
                
                if (!querySnapshot.empty) {
                    book = querySnapshot.docs[0].data();
                    console.log('Book found by title search:', book);
                }
            }
            
            // Cache the book data
            if (book) {
                cacheBook(bookId, book);
            }
        }

        if (book) {
            // Populate the page with the fetched data
            document.title = `${book.title} | Phat Hmat Tway`;
            
            // Handle cover image (check multiple fields for fallback)
            const coverUrl = book.coverUrl || book.coverImageUrl || book.img || '/assets/default-book-cover.svg';
            bookCover.src = coverUrl;
            bookCover.alt = `${book.title} summary cover`;
            
            // Add error handling for image loading
            bookCover.onerror = () => {
                console.warn("Failed to load image:", coverUrl);
                bookCover.src = '/assets/default-book-cover.svg';
            };
            
            // Remove loading state when image loads
            bookCover.onload = () => {
                bookCover.classList.remove('loading');
            };
            
            // Timeout fallback (remove loading state if image takes too long)
            setTimeout(() => {
                bookCover.classList.remove('loading');
            }, 5000);
            
            document.getElementById('bookTitle').textContent = book.title || 'Untitled';
            document.getElementById('bookAuthor').textContent = book.author || 'Unknown Author';
            
            // Handle description with markdown bold conversion
            const description = book.description || '';
            console.log('Description found:', description);
            const descriptionElement = document.getElementById('bookDescription');
            const descriptionWrapper = document.getElementById('bookDescriptionWrapper');
            
            if (descriptionElement) {
                if (description && description.trim()) {
                    descriptionElement.innerHTML = convertMarkdownBold(description);
                    descriptionElement.style.display = 'block';
                    console.log('Description element populated');
                } else {
                    // Hide the wrapper if no description exists
                    if (descriptionWrapper) {
                        descriptionWrapper.style.display = 'none';
                    }
                    console.log('No description available, wrapper hidden');
                }
            } else {
                console.error('bookDescription element not found in DOM');
            }
            
            // Display summary heading
            const summaryHeadingElement = document.getElementById('summaryHeading');
            if (book.summaryHeading) {
                // Convert markdown bold and check if it contains HTML tags
                const convertedHeading = convertMarkdownBold(book.summaryHeading);
                if (convertedHeading.includes('<')) {
                    summaryHeadingElement.innerHTML = convertedHeading;
                } else {
                    summaryHeadingElement.textContent = convertedHeading;
                }
            } else {
                summaryHeadingElement.textContent = 'Key Insights';
            }
            
            // Convert summaryBlocks to HTML content
            const summaryContent = document.getElementById('summaryContent');
            summaryContent.innerHTML = ''; // Clear placeholder
            
            if (book.summaryBlocks && Array.isArray(book.summaryBlocks) && book.summaryBlocks.length > 0) {
                book.summaryBlocks.forEach(block => {
                    const blockText = block.text || '';
                    
                    if (block.type === 'heading') {
                        // Create heading block (h3)
                        const convertedText = convertMarkdownBold(blockText);
                        const headingElement = document.createElement('h3');
                        if (convertedText.includes('<')) {
                            headingElement.innerHTML = convertedText;
                        } else {
                            headingElement.textContent = convertedText;
                        }
                        summaryContent.appendChild(headingElement);
                    } else if (block.type === 'paragraph') {
                        // Split paragraph text by newlines to create individual <p> elements
                        // This handles both saved split data and any residual newlines
                        const subParagraphs = blockText
                            .split(/\n\s*\n|\n/)  // split on double or single newlines
                            .map(p => p.trim())
                            .filter(p => p.length > 0);

                        subParagraphs.forEach(paraText => {
                            const convertedText = convertMarkdownBold(paraText);
                            const paragraphElement = document.createElement('p');
                            if (convertedText.includes('<')) {
                                paragraphElement.innerHTML = convertedText;
                            } else {
                                paragraphElement.textContent = convertedText;
                            }
                            summaryContent.appendChild(paragraphElement);
                        });
                    }
                });
            } else if (book.summaryParagraphs && Array.isArray(book.summaryParagraphs)) {
                // Fallback for hardcoded books with summaryParagraphs array
                book.summaryParagraphs.forEach(para => {
                    const p = document.createElement('p');
                    p.innerHTML = convertMarkdownBold(para);
                    summaryContent.appendChild(p);
                });
            } else {
                summaryContent.innerHTML = '<p>No summary available for this book.</p>';
            }

            // --- Audio Player Logic ---
            const audioPlayer = document.getElementById('bookAudio');
            const playPauseBtn = document.getElementById('playPauseBtn');
            const progressValue = document.getElementById('progressValue');
            const durationText = document.getElementById('durationText');
            const audioStatus = document.getElementById('audioStatus');

            const audioUrl = book.audioUrl || book.audio;
            if (audioUrl && audioPlayer) {
                audioPlayer.src = audioUrl;

                audioPlayer.addEventListener('loadedmetadata', () => {
                    const duration = Math.floor(audioPlayer.duration / 60);
                    durationText.textContent = `${duration} min`;
                });

                playPauseBtn.addEventListener('click', () => {
                    if (audioPlayer.paused) {
                        audioPlayer.play();
                        playPauseBtn.textContent = '❚❚'; // Pause symbol
                        audioStatus.textContent = "Playing...";
                        audioStatus.classList.remove('hidden');
                    } else {
                        audioPlayer.pause();
                        playPauseBtn.textContent = '▶'; // Play symbol
                        audioStatus.textContent = "Paused";
                    }
                });

                audioPlayer.addEventListener('timeupdate', () => {
                    const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
                    progressValue.style.width = `${progress}%`;
                });

                audioPlayer.addEventListener('ended', () => {
                    playPauseBtn.textContent = '▶';
                    progressValue.style.width = '0%';
                    audioStatus.textContent = "Finished. Click to play again.";
                });

                document.querySelector('.audio-player').style.display = 'block';
            } else {
                // Hide audio player if no audio URL is available
                document.querySelector('.audio-player').style.display = 'none';
            }

        } else {
            // Book not found
            console.error("Book not found in database");
            document.getElementById('bookTitle').textContent = "Book Not Found";
            document.getElementById('summaryContent').innerHTML = "<p>The book you are looking for does not exist. Please check the ID and try again.</p>";
            bookCover.classList.remove('loading');
        }
    } catch (error) {
        console.error("Error getting document:", error);
        document.getElementById('bookTitle').textContent = "Error";
        document.getElementById('summaryContent').innerHTML = "<p>There was an error retrieving the book data. Please try again later.</p>";
        bookCover.classList.remove('loading');
    }

    // Reading mode toggle logic (remains the same)
    const readingModeToggle = document.getElementById('readingModeToggle');
    const summaryArticle = document.getElementById('summaryContent');
    readingModeToggle.addEventListener('change', () => {
        summaryArticle.classList.toggle('reading-mode-active', readingModeToggle.checked);
    });
});
