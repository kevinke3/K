from flask import Flask, request, jsonify, send_from_directory
from flask_jwt_extended import JWTManager, jwt_required, get_jwt_identity
from models import db, User, Image, Like, Comment, Notification
from auth import init_auth_routes
from utils import save_image, send_notification_email
import os
from config import Config

app = Flask(__name__)
app.config.from_object(Config)

# Initialize extensions
db.init_app(app)
jwt = JWTManager(app)

# Create tables
with app.app_context():
    db.create_all()

# Initialize auth routes
init_auth_routes(app)

# Serve uploaded files
@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# Image routes
@app.route('/api/images', methods=['POST'])
@jwt_required()
def upload_image():
    user_id = get_jwt_identity()
    
    if 'image' not in request.files:
        return jsonify({'error': 'No image file'}), 400
    
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    filename = save_image(file)
    if not filename:
        return jsonify({'error': 'Invalid file type'}), 400
    
    caption = request.form.get('caption', '')
    
    image = Image(
        filename=filename,
        original_filename=file.filename,
        caption=caption,
        user_id=user_id
    )
    
    db.session.add(image)
    db.session.commit()
    
    return jsonify({
        'message': 'Image uploaded successfully',
        'image': {
            'id': image.id,
            'filename': image.filename,
            'caption': image.caption,
            'created_at': image.created_at.isoformat()
        }
    }), 201

@app.route('/api/images', methods=['GET'])
@jwt_required()
def get_images():
    user_id = get_jwt_identity()
    current_user = User.query.get(user_id)
    
    # Get page and limit from query parameters
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)
    user_filter = request.args.get('user_id')
    
    query = Image.query
    
    if user_filter:
        target_user = User.query.get(user_filter)
        if not target_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Check if account is private and user is not owner
        if target_user.is_private and target_user.id != user_id and current_user.role != 'admin':
            return jsonify({'error': 'This account is private'}), 403
        
        query = query.filter_by(user_id=user_filter)
    
    images = query.order_by(Image.created_at.desc()).paginate(
        page=page, per_page=limit, error_out=False
    )
    
    result = []
    for image in images.items:
        # Check if current user has liked this image
        user_like = Like.query.filter_by(user_id=user_id, image_id=image.id).first()
        
        result.append({
            'id': image.id,
            'filename': image.filename,
            'caption': image.caption,
            'user': {
                'id': image.user.id,
                'username': image.user.username,
                'is_private': image.user.is_private
            },
            'likes_count': len(image.likes),
            'comments_count': len(image.comments),
            'user_has_liked': user_like is not None,
            'created_at': image.created_at.isoformat()
        })
    
    return jsonify({
        'images': result,
        'total': images.total,
        'pages': images.pages,
        'current_page': page
    })

# Like routes
@app.route('/api/images/<image_id>/like', methods=['POST'])
@jwt_required()
def like_image(image_id):
    user_id = get_jwt_identity()
    
    image = Image.query.get(image_id)
    if not image:
        return jsonify({'error': 'Image not found'}), 404
    
    # Check if user can view this image (private account check)
    if image.user.is_private and image.user.id != user_id:
        current_user = User.query.get(user_id)
        if current_user.role != 'admin':
            return jsonify({'error': 'Cannot like image from private account'}), 403
    
    existing_like = Like.query.filter_by(user_id=user_id, image_id=image_id).first()
    if existing_like:
        return jsonify({'error': 'Already liked'}), 400
    
    like = Like(user_id=user_id, image_id=image_id)
    db.session.add(like)
    
    # Create notification
    if image.user_id != user_id:  # Don't notify for own likes
        notification = Notification(
            user_id=image.user_id,
            type='like',
            source_user_id=user_id,
            image_id=image_id,
            message=f"liked your image"
        )
        db.session.add(notification)
        
        # Send email notification
        source_user = User.query.get(user_id)
        image_owner = User.query.get(image.user_id)
        send_notification_email(
            image_owner.email,
            'like',
            source_user.username,
            image_id
        )
    
    db.session.commit()
    
    return jsonify({'message': 'Image liked'}), 201

@app.route('/api/images/<image_id>/like', methods=['DELETE'])
@jwt_required()
def unlike_image(image_id):
    user_id = get_jwt_identity()
    
    like = Like.query.filter_by(user_id=user_id, image_id=image_id).first()
    if not like:
        return jsonify({'error': 'Like not found'}), 404
    
    db.session.delete(like)
    db.session.commit()
    
    return jsonify({'message': 'Like removed'}), 200

# Comment routes
@app.route('/api/images/<image_id>/comments', methods=['POST'])
@jwt_required()
def add_comment(image_id):
    user_id = get_jwt_identity()
    data = request.get_json()
    
    if not data or 'content' not in data:
        return jsonify({'error': 'Comment content required'}), 400
    
    image = Image.query.get(image_id)
    if not image:
        return jsonify({'error': 'Image not found'}), 404
    
    # Check if user can view this image (private account check)
    if image.user.is_private and image.user.id != user_id:
        current_user = User.query.get(user_id)
        if current_user.role != 'admin':
            return jsonify({'error': 'Cannot comment on private account'}), 403
    
    comment = Comment(
        content=data['content'],
        user_id=user_id,
        image_id=image_id
    )
    db.session.add(comment)
    
    # Create notification
    if image.user_id != user_id:  # Don't notify for own comments
        notification = Notification(
            user_id=image.user_id,
            type='comment',
            source_user_id=user_id,
            image_id=image_id,
            message=f"commented on your image"
        )
        db.session.add(notification)
        
        # Send email notification
        source_user = User.query.get(user_id)
        image_owner = User.query.get(image.user_id)
        send_notification_email(
            image_owner.email,
            'comment',
            source_user.username,
            image_id
        )
    
    db.session.commit()
    
    return jsonify({
        'message': 'Comment added',
        'comment': {
            'id': comment.id,
            'content': comment.content,
            'user': {
                'id': comment.user.id,
                'username': comment.user.username
            },
            'created_at': comment.created_at.isoformat()
        }
    }), 201

@app.route('/api/images/<image_id>/comments', methods=['GET'])
@jwt_required()
def get_comments(image_id):
    user_id = get_jwt_identity()
    
    image = Image.query.get(image_id)
    if not image:
        return jsonify({'error': 'Image not found'}), 404
    
    # Check if user can view this image (private account check)
    if image.user.is_private and image.user.id != user_id:
        current_user = User.query.get(user_id)
        if current_user.role != 'admin':
            return jsonify({'error': 'Cannot view comments on private account'}), 403
    
    comments = Comment.query.filter_by(image_id=image_id).order_by(Comment.created_at.asc()).all()
    
    result = []
    for comment in comments:
        result.append({
            'id': comment.id,
            'content': comment.content,
            'user': {
                'id': comment.user.id,
                'username': comment.user.username
            },
            'created_at': comment.created_at.isoformat()
        })
    
    return jsonify({'comments': result})

# Profile routes
@app.route('/api/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    data = request.get_json()
    
    if 'is_private' in data:
        user.is_private = data['is_private']
    
    db.session.commit()
    
    return jsonify({
        'message': 'Profile updated',
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'is_private': user.is_private,
            'role': user.role
        }
    })

# Admin routes
@app.route('/api/admin/images/<image_id>', methods=['DELETE'])
@jwt_required()
def admin_delete_image(image_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    
    image = Image.query.get(image_id)
    if not image:
        return jsonify({'error': 'Image not found'}), 404
    
    # Delete image file
    try:
        os.remove(os.path.join(app.config['UPLOAD_FOLDER'], image.filename))
    except OSError:
        pass  # File might not exist
    
    db.session.delete(image)
    db.session.commit()
    
    return jsonify({'message': 'Image deleted'}), 200

if __name__ == '__main__':
    app.run(debug=True)