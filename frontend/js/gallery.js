class Gallery {
    constructor() {
        this.currentPage = 1;
        this.hasMore = true;
        this.loading = false;
        this.init();
    }

    init() {
        this.loadImages();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Infinite scroll
        window.addEventListener('scroll', () => {
            if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 1000) {
                this.loadMore();
            }
        });

        // User filter
        const userFilter = document.getElementById('userFilter');
        if (userFilter) {
            userFilter.addEventListener('change', (e) => {
                this.currentPage = 1;
                this.hasMore = true;
                this.loadImages(e.target.value);
            });
        }
    }

    async loadImages(userId = null) {
        if (this.loading) return;
        
        this.loading = true;
        const gallery = document.getElementById('gallery');
        
        if (this.currentPage === 1) {
            gallery.innerHTML = '<div class="text-center">Loading...</div>';
        }

        try {
            const params = new URLSearchParams({
                page: this.currentPage,
                limit: 12
            });
            
            if (userId) {
                params.append('user_id', userId);
            }

            const response = await fetch(`/api/images?${params}`, {
                headers: {
                    ...auth.getAuthHeader(),
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load images');
            }

            const result = await response.json();

            if (this.currentPage === 1) {
                gallery.innerHTML = '';
            }

            if (result.images.length === 0 && this.currentPage === 1) {
                gallery.innerHTML = '<div class="text-center">No images found</div>';
                return;
            }

            result.images.forEach(image => this.renderImage(image));
            
            this.hasMore = this.currentPage < result.pages;
            this.currentPage++;

        } catch (error) {
            console.error('Error loading images:', error);
            if (this.currentPage === 1) {
                gallery.innerHTML = '<div class="error text-center">Failed to load images</div>';
            }
        } finally {
            this.loading = false;
        }
    }

    renderImage(image) {
        const gallery = document.getElementById('gallery');
        
        const imageCard = document.createElement('div');
        imageCard.className = 'image-card';
        imageCard.innerHTML = `
            <div class="image-info">
                <strong>@${image.user.username}</strong>
                ${image.caption ? `<p>${this.escapeHtml(image.caption)}</p>` : ''}
            </div>
            <div class="image-container">
                <img src="/uploads/${image.filename}" alt="${this.escapeHtml(image.caption || 'Image')}" loading="lazy">
            </div>
            <div class="image-actions">
                <button class="like-btn ${image.user_has_liked ? 'liked' : ''}" 
                        onclick="gallery.toggleLike('${image.id}', this)">
                    ♥ ${image.likes_count}
                </button>
                <button class="comment-btn" onclick="gallery.showComments('${image.id}')">
                    💬 ${image.comments_count}
                </button>
            </div>
            <div class="comments-section" id="comments-${image.id}"></div>
        `;
        
        gallery.appendChild(imageCard);
    }

    async toggleLike(imageId, button) {
        if (!auth.isAuthenticated()) {
            alert('Please login to like images');
            return;
        }

        const isLiked = button.classList.contains('liked');
        
        try {
            const response = await fetch(`/api/images/${imageId}/like`, {
                method: isLiked ? 'DELETE' : 'POST',
                headers: auth.getAuthHeader()
            });

            if (response.ok) {
                const likeCount = parseInt(button.textContent.match(/\d+/)[0]);
                if (isLiked) {
                    button.classList.remove('liked');
                    button.textContent = `♥ ${likeCount - 1}`;
                } else {
                    button.classList.add('liked');
                    button.textContent = `♥ ${likeCount + 1}`;
                }
            } else {
                const result = await response.json();
                alert(result.error || 'Failed to toggle like');
            }
        } catch (error) {
            console.error('Error toggling like:', error);
            alert('Failed to toggle like');
        }
    }

    async showComments(imageId) {
        const commentsSection = document.getElementById(`comments-${imageId}`);
        
        if (commentsSection.innerHTML) {
            commentsSection.innerHTML = '';
            return;
        }

        try {
            const response = await fetch(`/api/images/${imageId}/comments`, {
                headers: auth.getAuthHeader()
            });

            if (!response.ok) {
                throw new Error('Failed to load comments');
            }

            const result = await response.json();
            
            let commentsHtml = '<div class="comments-list">';
            result.comments.forEach(comment => {
                commentsHtml += `
                    <div class="comment">
                        <strong>@${comment.user.username}</strong>
                        <p>${this.escapeHtml(comment.content)}</p>
                        <small>${new Date(comment.created_at).toLocaleDateString()}</small>
                    </div>
                `;
            });
            commentsHtml += '</div>';
            
            commentsHtml += `
                <div class="comment-form">
                    <textarea id="comment-${imageId}" placeholder="Add a comment..." rows="2"></textarea>
                    <button class="btn" onclick="gallery.addComment('${imageId}')">Post Comment</button>
                </div>
            `;
            
            commentsSection.innerHTML = commentsHtml;
        } catch (error) {
            console.error('Error loading comments:', error);
            commentsSection.innerHTML = '<div class="error">Failed to load comments</div>';
        }
    }

    async addComment(imageId) {
        if (!auth.isAuthenticated()) {
            alert('Please login to comment');
            return;
        }

        const textarea = document.getElementById(`comment-${imageId}`);
        const content = textarea.value.trim();
        
        if (!content) {
            alert('Please enter a comment');
            return;
        }

        try {
            const response = await fetch(`/api/images/${imageId}/comments`, {
                method: 'POST',
                headers: {
                    ...auth.getAuthHeader(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content })
            });

            if (response.ok) {
                textarea.value = '';
                this.showComments(imageId); // Reload comments
                
                // Update comment count
                const commentBtn = document.querySelector(`[onclick="gallery.showComments('${imageId}')"]`);
                const count = parseInt(commentBtn.textContent.match(/\d+/)[0]) || 0;
                commentBtn.textContent = `💬 ${count + 1}`;
            } else {
                const result = await response.json();
                alert(result.error || 'Failed to add comment');
            }
        } catch (error) {
            console.error('Error adding comment:', error);
            alert('Failed to add comment');
        }
    }

    loadMore() {
        if (this.hasMore && !this.loading) {
            this.loadImages();
        }
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// Initialize gallery when page loads
let gallery;
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('gallery')) {
        gallery = new Gallery();
    }
});