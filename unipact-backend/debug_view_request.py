import os
import sys

# Setup Path & Settings BEFORE Django imports
sys.path.append('c:\\Users\\User\\Documents\\unipact-mvp\\unipact-backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'unipact_backend.settings')

import django
django.setup()

from rest_framework.test import APIRequestFactory, force_authenticate
from users.views import AdminEntityListView
from users.models import User

def debug_view():
    print("--- Debugging View Request ---")
    factory = APIRequestFactory()
    admin = User.objects.filter(role=User.Role.ADMIN).first()
    
    # Simulate: ?role=COMPANY&company_profile__tier=PRO
    url = '/users/admin/entities/?role=COMPANY&company_profile__tier=PRO'
    print(f"Requesting: {url}")
    
    request = factory.get(url)
    force_authenticate(request, user=admin)
    view = AdminEntityListView.as_view()
    
    try:
        response = view(request)
        print(f"Status: {response.status_code}")
        print(f"Count: {response.data.get('count')}")
        results = response.data.get('results', [])
        for r in results:
             print(f" - {r['email']} ({r.get('details')})")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    debug_view()
