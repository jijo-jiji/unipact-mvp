from django.urls import path
from django.urls import path
from .views import (
    RegisterCompanyView, RegisterClubView, LoginView, LogoutView, InviteMemberView, UserView,
    AdminDashboardStatsView, AdminVerificationQueueView, AdminVerifyEntityView, AdminSystemLogsView,
    ClubPublicProfileView, ClubRosterView,
    AdminEntityListView, AdminBlockUserView,
    ClaimProfileView, TransferOwnershipView
)

urlpatterns = [
    path('register/company/', RegisterCompanyView.as_view(), name='register_company'),
    path('register/club/', RegisterClubView.as_view(), name='register_club'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('me/', UserView.as_view(), name='me'),
    
    # Club Specific
    path('club/invite/', InviteMemberView.as_view(), name='club_invite'),
    path('club/<int:user_id>/profile/', ClubPublicProfileView.as_view(), name='club_public_profile'),
    path('club/<int:user_id>/roster/', ClubRosterView.as_view(), name='club_roster'),

    # Admin
    path('admin/stats/', AdminDashboardStatsView.as_view(), name='admin_stats'),
    path('admin/queue/', AdminVerificationQueueView.as_view(), name='admin_queue'),
    path('admin/verify/<str:entity_type>/<int:entity_id>/', AdminVerifyEntityView.as_view(), name='admin_verify'),
    path('admin/logs/', AdminSystemLogsView.as_view(), name='admin_logs'),
    
    # Checkpoint 2 Additions
    path('admin/entities/', AdminEntityListView.as_view(), name='admin_entities'),
    path('club/transfer-ownership/', TransferOwnershipView.as_view(), name='club_transfer_ownership'),
    path('users/claim/', ClaimProfileView.as_view(), name='user_claim_profile'),
]
