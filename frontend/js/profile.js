class Profile {
    constructor() {
        this.init();
    }

    init() {
        this.loadUserProfile();
        this.setupEventListeners();
    }

    setupEventListeners() {
        const privateToggle = document.getElementById('privateToggle');
        if (privateToggle) {
            privateToggle.addEventListener('change', (e) => this.updatePrivacy(e.target.checked));
        }
    }

    async loadUserProfile() {
        if (!auth.isAuthenticated()) {
            return;
        }

        try {
            // Load user's images
            const response = await fetch('/api/images?user_id=' + auth.user.id, {
                headers: auth.getAuthHeader()
            });

            if (response.ok) {
                const result = await response.json();
                this.renderUserImages(result.images);
            }

            // Update privacy toggle
            const privateToggle = document.getElementById('privateToggle');
            if (privateToggle) {
                privateToggle.checked = auth.user.is_private;
            }

        } catch (error) {
            console.error('Error loading profile:', error);
        }
    }

    renderUserImages(images) {
        const gallery = document.getElementById('userGallery');
        
        if (images.length === 0) {
            gallery.innerHTML = '<div class="text-center">No images uploaded yet</div>';
            return;
        }

        gallery.innerHTML = '';
        images.forEach(image => {
            const imageCard = document.createElement('div');
            imageCard.className = 'image-card';
            imageCard.innerHTML = `
                <div class="image-container">
                    <img src="/uploads/${image.filename}" alt="${image.caption || 'Image'}">
                </div>
                <div class="image-info">
                    <p>${image.caption || ''}</p>
                    <small>${new Date(image.created_at).toLocaleDateString()}</small>
                </div>
                <div class="image-actions">
                    <span>♥ ${image.likes_count}</span>
                    <span>💬 ${image.comments_count}</span>
                </div>
            `;
            gallery.appendChild(imageCard);
        });
    }

    async updatePrivacy(isPrivate) {
        try {
            const response = await fetch('/api/profile', {
                method: 'PUT',
                headers: {
                    ...auth.getAuthHeader(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ is_private: isPrivate })
            });

            if (response.ok) {
                // Update local user data
                auth.user.is_private = isPrivate;
                localStorage.setItem('kapcha_user', JSON.stringify(auth.user));
                alert('Privacy settings updated');
            } else {
                const result = await response.json();
                alert(result.error || 'Failed to update privacy settings');
                // Revert toggle
                document.getElementById('privateToggle').checked = !isPrivate;
            }
        } catch (error) {
            console.error('Error updating privacy:', error);
            alert('Failed to update privacy settings');
            // Revert toggle
            document.getElementById('privateToggle').checked = !isPrivate;
        }
    }
}

// Initialize profile when page loads
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('userGallery')) {
        new Profile();
    }
});