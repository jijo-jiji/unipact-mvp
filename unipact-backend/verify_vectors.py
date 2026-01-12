import os
import django
import json
import uuid

# Setup Django Environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'unipact_backend.settings')
django.setup()

from users.models import User, ClubProfile, ShadowUser
from rest_framework.test import APIClient

def run_verification():
    print("--- Verifying Vector 1 & 2: Club Transfer & Shadow Claim ---")
    
    client = APIClient()
    
    # 1. Setup Test Data
    print("\n1. Setting up initial state...")
    # Cleanup
    User.objects.filter(email__in=['president@test.com', 'successor@test.com', 'successor_claimed@test.com']).delete()
    
    # Create President
    pres_user = User.objects.create_user(username='president', email='president@test.com', password='password123', role='CLUB')
    club = ClubProfile.objects.create(user=pres_user, club_name='Vector Test Club', university='Test Uni')
    print(f"   - Created Club: {club.club_name} (Owner: {pres_user.email})")

    # 2. Vector 2: Shadow Invite & Claim
    print("\n2. Testing Vector 2: Shadow Invitation & Claiming...")
    
    from django.urls import reverse
    
    from users.views import get_tokens_for_user
     
    # A. Invite
    # Use Real Auth (Cookies)
    tokens = get_tokens_for_user(pres_user)
    client.cookies['access_token'] = tokens['access']
    client.cookies['refresh_token'] = tokens['refresh']
    
    invite_url = reverse('club_invite')
    print(f"   - Invite URL: {invite_url}")
    
    invite_data = {'email': 'successor@test.com', 'role': 'Vice President'}
    response = client.post(invite_url, invite_data, follow=True)
    
    if response.status_code == 201:
        print("   ✅ Invite Sent (API 201)")
    else:
        print(f"   ❌ Invite Failed: {response.status_code}")
        try:
             # Try to print simple error from JSON or fallback to title
             print(response.json())
        except:
             pass
        return

    # Get Token (Simulating Email Link)
    shadow = ShadowUser.objects.get(email='successor@test.com')
    token = shadow.token
    print(f"   - Captured Invite Token: {token}")

    # B. Claim
    client.logout() # Simulate new user session
    claim_url = reverse('user_claim_profile')
    print(f"   - Claim URL: {claim_url}")
    claim_data = {
        'token': token,
        'password': 'newpassword123',
        'first_name': 'John',
        'last_name': 'Successor'
    }
    response = client.post(claim_url, claim_data, follow=True)
    
    if response.status_code == 201:
        print("   ✅ Profile Claimed (API 201)")
        new_user = User.objects.get(email='successor@test.com')
        print(f"   - New User Created: {new_user.email} (ID: {new_user.id})")
    else:
        print(f"   ❌ Claim Failed: {response.status_code}")
        print(response.content.decode('utf-8')[:500])
        return

    # 3. Vector 1: Succession Crisis (Transfer Ownership)
    print("\n3. Testing Vector 1: Transfer Ownership...")
    
    # Login as President again
    client.force_authenticate(user=pres_user)
    
    transfer_url = reverse('club_transfer_ownership')
    print(f"   - Transfer URL: {transfer_url}")
    transfer_data = {'new_owner_email': 'successor@test.com'}
    response = client.post(transfer_url, transfer_data)
    
    if response.status_code == 200:
        print("   ✅ Ownership Transferred (API 200)")
    else:
        print(f"   ❌ Transfer Failed: {response.content}")
        return

    # Verify DB State
    club.refresh_from_db()
    if club.user.email == 'successor@test.com':
        print(f"   ✅ SUCCESS: Club Owner is now {club.user.email}")
    else:
        print(f"   ❌ FAIL: Club Owner is still {club.user.email}")

if __name__ == '__main__':
    run_verification()
