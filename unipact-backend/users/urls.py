from django.urls import path
from django.urls import path
from .views import (
    RegisterCompanyView, RegisterClubView, LoginView, LogoutView, InviteMemberView, UserView,
    AdminDashboardStatsView, AdminVerificationQueueView, AdminVerifyEntityView, AdminSystemLogsView,
    ClubPublicProfileView, ClubRosterView
)

urlpatterns = [
    path('register/company/', RegisterCompanyView.as_view(), name='register_company'),
    path('register/club/', RegisterClubView.as_view(), name='register_club'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('invite/', InviteMemberView.as_view(), name='invite_member'),
    path('me/', UserView.as_view(), name='user_details'),
    
    # Public Club Profile & Roster
    path('club/<int:user_id>/', ClubPublicProfileView.as_view(), name='club_public_profile'),
    path('club/<int:user_id>/roster/', ClubRosterView.as_view(), name='club_roster'),
    
    # Admin Enpoints
    path('admin/stats/', AdminDashboardStatsView.as_view(), name='admin_stats'),
    path('admin/queue/', AdminVerificationQueueView.as_view(), name='admin_queue'),
    path('admin/verify/<str:entity_type>/<int:entity_id>/', AdminVerifyEntityView.as_view(), name='admin_verify'),
    path('admin/logs/', AdminSystemLogsView.as_view(), name='admin_logs'),
]
