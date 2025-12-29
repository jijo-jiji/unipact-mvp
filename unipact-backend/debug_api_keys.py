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

def check_keys():
    print("--- Checking API keys ---")
    factory = APIRequestFactory()
    admin = User.objects.filter(role=User.Role.ADMIN).first()
    if not admin:
        print("No admin found")
        return

    view = AdminEntityListView.as_view()
    request = factory.get('/users/admin/entities/')
    force_authenticate(request, user=admin)
    response = view(request)
    
    if response.status_code == 200:
        print(f"Response Data Type: {type(response.data)}")
        print(f"Response Keys: {response.data.keys() if hasattr(response.data, 'keys') else 'No keys (List?)'}")
        
        results = response.data.get('results', []) if hasattr(response.data, 'get') else response.data
        if len(results) > 0:
            print(f"First item keys: {results[0].keys()}")
        else:
            print("No results found.")
    else:
        print(f"Failed: {response.status_code}")

if __name__ == '__main__':
    check_keys()
