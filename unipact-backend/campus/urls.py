from django.urls import path

from . import views

urlpatterns = [
    path('me/', views.MeView.as_view(), name='campus_me'),
    path('roles/', views.RoleListView.as_view(), name='campus_roles'),
    path('units/', views.UnitListView.as_view(), name='campus_units'),
    path('units/<int:pk>/', views.UnitDetailView.as_view(), name='campus_unit_detail'),
    path('assignments/', views.AssignmentListView.as_view(), name='campus_assignments'),
    path('assignments/<int:pk>/end/', views.AssignmentEndView.as_view(), name='campus_assignment_end'),
    path('staff/', views.StaffListView.as_view(), name='campus_staff'),
    path('staff/<int:pk>/', views.StaffDetailView.as_view(), name='campus_staff_detail'),
    path('staff/<int:pk>/resend/', views.StaffResendInviteView.as_view(), name='campus_staff_resend'),
]
