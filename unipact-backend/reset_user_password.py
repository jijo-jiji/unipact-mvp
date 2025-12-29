import os
import sys
import django

sys.path.append('c:\\Users\\User\\Documents\\unipact-mvp\\unipact-backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'unipact_backend.settings')
django.setup()

from users.models import User

def check_and_reset_user():
    email = 'club@unipact.com'
    print(f"--- Checking User: {email} ---")
    
    try:
        user = User.objects.get(email=email)
        print(f"User ID: {user.id}")
        print(f"Role: {user.role}")
        print(f"Is Active: {user.is_active}")
        
        if not user.is_active:
            print("User is BLOCKED (is_active=False). Unblocking...")
            user.is_active = True
            user.save()
            print("User unblocked.")
            
        print("Resetting password to 'password123'...")
        user.set_password('password123')
        user.save()
        print("Password reset successful.")
        
    except User.DoesNotExist:
        print("User does not exist!")

if __name__ == '__main__':
    check_and_reset_user()
