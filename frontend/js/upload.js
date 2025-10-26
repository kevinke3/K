class ImageUpload {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        const form = document.getElementById('uploadForm');
        const fileInput = document.getElementById('imageFile');
        const preview = document.getElementById('imagePreview');

        if (form) {
            form.addEventListener('submit', (e) => this.handleUpload(e));
        }

        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        const preview = document.getElementById('imagePreview');
        
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.src = e.target.result;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    }

    async handleUpload(e) {
        e.preventDefault();
        
        if (!auth.isAuthenticated()) {
            alert('Please login to upload images');
            return;
        }

        const formData = new FormData(e.target);
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;

        submitBtn.textContent = 'Uploading...';
        submitBtn.disabled = true;

        try {
            const response = await fetch('/api/images', {
                method: 'POST',
                headers: auth.getAuthHeader(),
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                alert('Image uploaded successfully!');
                e.target.reset();
                document.getElementById('imagePreview').style.display = 'none';
                window.location.href = 'gallery.html';
            } else {
                alert(result.error || 'Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert('Upload failed. Please try again.');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }
}

// Initialize upload when page loads
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('uploadForm')) {
        new ImageUpload();
    }
});