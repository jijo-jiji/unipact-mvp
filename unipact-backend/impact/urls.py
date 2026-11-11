from django.urls import path

from .views import (
    AdminB40DetailView, AdminB40ListView, AdminImpactView, AdminWorkshopDetailView, AdminWorkshopListView,
    PublicImpactView,
)

urlpatterns = [
    path('', PublicImpactView.as_view(), name='impact_public'),
    path('admin/', AdminImpactView.as_view(), name='impact_admin'),
    path('admin/workshops/', AdminWorkshopListView.as_view(), name='impact_workshops'),
    path('admin/workshops/<int:pk>/', AdminWorkshopDetailView.as_view(), name='impact_workshop_detail'),
    path('admin/b40/', AdminB40ListView.as_view(), name='impact_b40'),
    path('admin/b40/<int:pk>/', AdminB40DetailView.as_view(), name='impact_b40_detail'),
]
