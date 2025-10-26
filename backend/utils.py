import os
from PIL import Image as PILImage
from flask import current_app
import uuid

def allowed_file(filename):
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def save_image(file):
    if not allowed_file(file.filename):
        return None
    
    # Generate unique filename
    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = f"{uuid.uuid4()}.{ext}"
    
    # Ensure upload directory exists
    os.makedirs(current_app.config['UPLOAD_FOLDER'], exist_ok=True)
    filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
    
    # Open and process image
    image = PILImage.open(file)
    
    # Convert to RGB if necessary
    if image.mode in ('RGBA', 'P'):
        image = image.convert('RGB')
    
    # Resize if too large (max 2000px on longest side)
    max_size = (2000, 2000)
    image.thumbnail(max_size, PILImage.Resampling.LANCZOS)
    
    # Save processed image
    image.save(filepath, 'JPEG', quality=85)
    
    return filename

def send_notification_email(user_email, notification_type, source_username, image_id=None):
    # This is a placeholder for email functionality
    # In production, integrate with services like SendGrid, Mailgun, etc.
    print(f"Notification email to {user_email}: {notification_type} from {source_username}")
    # Implementation would go here for actual email sending
    pass