import os
import sys
from dotenv import load_dotenv

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from models import User

load_dotenv()

def create_admin_user():
    with app.app_context():
        # Check if admin already exists
        admin = User.query.filter_by(username=os.environ.get('ADMIN_USERNAME', 'admin')).first()
        if admin:
            print("Admin user already exists")
            return
        
        admin = User(
            username=os.environ.get('ADMIN_USERNAME', 'admin'),
            email=os.environ.get('ADMIN_EMAIL', 'admin@kapcha.com'),
            phone=os.environ.get('ADMIN_PHONE', '+1234567890'),
            role='admin'
        )
        admin.set_password(os.environ.get('ADMIN_PASSWORD', 'admin123'))
        
        db.session.add(admin)
        db.session.commit()
        print("Admin user created successfully")

if __name__ == '__main__':
    create_admin_user()