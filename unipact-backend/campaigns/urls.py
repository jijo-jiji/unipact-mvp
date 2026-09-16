from django.urls import path
from .views import (
    CampaignListCreateView, CampaignDetailView, ApplicationCreateView, 
    AwardApplicationView, DeliverableCreateView, MarkCampaignCompletedView, MyApplicationsView,
    AdminMatchmakingAssignView, FinalizeMatchView, StudentAssignedJobsView,
    StudentSubmitDeliverableView, ClientAssetView, RespondMatchOfferView,
    ProjectTeamInviteView, ProjectTeamListView, MyTeamInvitationsView, RespondTeamInvitationView
)

urlpatterns = [
    path('', CampaignListCreateView.as_view(), name='campaign_list_create'),
    path('<int:pk>/', CampaignDetailView.as_view(), name='campaign_detail'),
    path('<int:campaign_id>/apply/', ApplicationCreateView.as_view(), name='application_create'),
    path('applications/me/', MyApplicationsView.as_view(), name='my_applications'),
    path('application/<int:application_id>/award/', AwardApplicationView.as_view(), name='award_application'),
    path('application/<int:application_id>/deliverable/', DeliverableCreateView.as_view(), name='deliverable_create'),
    path('<int:campaign_id>/complete/', MarkCampaignCompletedView.as_view(), name='campaign_complete'),
    
    # V3.0 Endpoints
    path('<int:campaign_id>/match/', AdminMatchmakingAssignView.as_view(), name='admin_matchmaking_assign'),
    path('<int:campaign_id>/offer/respond/', RespondMatchOfferView.as_view(), name='respond_match_offer'),
    path('<int:campaign_id>/finalize/', FinalizeMatchView.as_view(), name='finalize_match'),
    path('student/assigned/', StudentAssignedJobsView.as_view(), name='student_assigned_jobs'),
    path('<int:campaign_id>/student-deliverable/', StudentSubmitDeliverableView.as_view(), name='student_submit_deliverable'),
    path('<int:campaign_id>/assets/', ClientAssetView.as_view(), name='client_assets'),

    # V3.0 Team Collaboration Endpoints
    path('<int:campaign_id>/team/invite/', ProjectTeamInviteView.as_view(), name='project_team_invite'),
    path('<int:campaign_id>/team/', ProjectTeamListView.as_view(), name='project_team_list'),
    path('team/invitations/me/', MyTeamInvitationsView.as_view(), name='my_team_invitations'),
    path('team/invitations/<int:invitation_id>/respond/', RespondTeamInvitationView.as_view(), name='respond_team_invitation'),
]

