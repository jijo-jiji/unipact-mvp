from django.urls import path
from django.urls import path
from .views import (
    RegisterCompanyView, RegisterClubView, LoginView, LogoutView, InviteMemberView, UserView,
    AdminDashboardStatsView, AdminVerificationQueueView, AdminVerifyEntityView, AdminSystemLogsView
)

urlpatterns = [
    path('register/company/', RegisterCompanyView.as_view(), name='register_company'),
    path('register/club/', RegisterClubView.as_view(), name='register_club'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('invite/', InviteMemberView.as_view(), name='invite_member'),
    path('me/', UserView.as_view(), name='user_details'),
    
    # Admin Enpoints
    path('admin/stats/', AdminDashboardStatsView.as_view(), name='admin_stats'),
    path('admin/queue/', AdminVerificationQueueView.as_view(), name='admin_queue'),
    path('admin/verify/<str:entity_type>/<int:entity_id>/', AdminVerifyEntityView.as_view(), name='admin_verify'),
    path('admin/logs/', AdminSystemLogsView.as_view(), name='admin_logs'),
]
