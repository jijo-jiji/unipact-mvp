from django.urls import path
from .views import (
    RegisterCompanyView, RegisterClubView, RegisterStudentView, LoginView, LogoutView, CookieTokenRefreshView,
    InviteMemberView, UserView,
    AdminDashboardStatsView, AdminVerificationQueueView, AdminVerifyEntityView, AdminSystemLogsView,
    ClubPublicProfileView, ClubRosterView, StudentPublicProfileView,
    AdminEntityListView, AdminBlockUserView, AdminStudentPoolView,
    ClaimProfileView, TransferOwnershipView,
    AccountSettingsView, PasswordChangeView, PasswordResetRequestView, PasswordResetConfirmView,
)

urlpatterns = [
    path('register/company/', RegisterCompanyView.as_view(), name='register_company'),
    path('register/club/', RegisterClubView.as_view(), name='register_club'),
    path('register/student/', RegisterStudentView.as_view(), name='register_student'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('token/refresh/', CookieTokenRefreshView.as_view(), name='token_refresh'),
    path('me/', UserView.as_view(), name='me'),
    path('me/settings/', AccountSettingsView.as_view(), name='account_settings'),
    path('password/change/', PasswordChangeView.as_view(), name='password_change'),
    path('password/forgot/', PasswordResetRequestView.as_view(), name='password_reset_request'),
    path('password/reset/', PasswordResetConfirmView.as_view(), name='password_reset_confirm'),
    
    # Student Specific
    path('student/<int:user_id>/profile/', StudentPublicProfileView.as_view(), name='student_public_profile'),

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
    path('admin/users/<int:user_id>/block/', AdminBlockUserView.as_view(), name='admin_block_user'),
    path('admin/students/', AdminStudentPoolView.as_view(), name='admin_student_pool'),
    path('club/transfer-ownership/', TransferOwnershipView.as_view(), name='club_transfer_ownership'),
    path('users/claim/', ClaimProfileView.as_view(), name='user_claim_profile'),
]
