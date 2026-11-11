from django.urls import path

from .views import (
    AdminB40DetailView, AdminB40ListView, AdminImpactView, AdminModuleDetailView, AdminModuleItemCreateView,
    AdminModuleItemDetailView, AdminModuleListView, AdminWorkshopDetailView, AdminWorkshopListView, LibraryDetailView,
    LibraryListView, PublicImpactView,
)

urlpatterns = [
    path('', PublicImpactView.as_view(), name='impact_public'),
    path('admin/', AdminImpactView.as_view(), name='impact_admin'),
    path('admin/workshops/', AdminWorkshopListView.as_view(), name='impact_workshops'),
    path('admin/workshops/<int:pk>/', AdminWorkshopDetailView.as_view(), name='impact_workshop_detail'),
    path('admin/b40/', AdminB40ListView.as_view(), name='impact_b40'),
    path('admin/b40/<int:pk>/', AdminB40DetailView.as_view(), name='impact_b40_detail'),

    # Learning library
    path('learning/', LibraryListView.as_view(), name='library'),
    path('learning/<int:pk>/', LibraryDetailView.as_view(), name='library_detail'),
    path('admin/modules/', AdminModuleListView.as_view(), name='admin_modules'),
    path('admin/modules/<int:pk>/', AdminModuleDetailView.as_view(), name='admin_module_detail'),
    path('admin/modules/<int:module_id>/items/', AdminModuleItemCreateView.as_view(), name='admin_module_items'),
    path('admin/items/<int:pk>/', AdminModuleItemDetailView.as_view(), name='admin_module_item_detail'),
]
