import os
import sys

sys.path.append('c:\\Users\\User\\Documents\\unipact-mvp\\unipact-backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'unipact_backend.settings')

import django
django.setup()

from rest_framework.test import APIRequestFactory, force_authenticate
from users.views import AdminEntityListView
from users.models import User

def verify_pagination():
    print("--- Verifying Pagination ---")
    factory = APIRequestFactory()
    admin = User.objects.filter(role=User.Role.ADMIN).first()
    
    request = factory.get('/users/admin/entities/')
    force_authenticate(request, user=admin)
    view = AdminEntityListView.as_view()
    
    response = view(request)
    data = response.data
    
    print(f"Data Type: {type(data)}")
    if isinstance(data, dict):
        print(f"Has 'count': {'count' in data}")
        print(f"Has 'results': {'results' in data}")
        if 'results' in data:
            print(f"Results length: {len(data['results'])}")
    elif isinstance(data, list):
        print("Data is a List (Pagination NOT active)")
    else:
        print("Unknown data type")

if __name__ == '__main__':
    verify_pagination()
