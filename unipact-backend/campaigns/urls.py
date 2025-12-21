from django.urls import path
from .views import CampaignListCreateView, CampaignDetailView, ApplicationCreateView, AwardApplicationView, DeliverableCreateView, MarkCampaignCompletedView, MyApplicationsView

urlpatterns = [
    path('', CampaignListCreateView.as_view(), name='campaign_list_create'),
    path('<int:pk>/', CampaignDetailView.as_view(), name='campaign_detail'),
    path('<int:campaign_id>/apply/', ApplicationCreateView.as_view(), name='application_create'),
    path('applications/me/', MyApplicationsView.as_view(), name='my_applications'),
    path('application/<int:application_id>/award/', AwardApplicationView.as_view(), name='award_application'),
    path('application/<int:application_id>/deliverable/', DeliverableCreateView.as_view(), name='deliverable_create'),
    path('<int:campaign_id>/complete/', MarkCampaignCompletedView.as_view(), name='campaign_complete'),
]
