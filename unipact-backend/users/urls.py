from django.urls import path
from django.urls import path
from .views import RegisterCompanyView, RegisterClubView, LoginView, LogoutView, InviteMemberView, UserView

urlpatterns = [
    path('register/company/', RegisterCompanyView.as_view(), name='register_company'),
    path('register/club/', RegisterClubView.as_view(), name='register_club'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('invite/', InviteMemberView.as_view(), name='invite_member'),
    path('me/', UserView.as_view(), name='user_details'),
]
