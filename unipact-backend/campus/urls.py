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

from . import views_clubs as c  # noqa: E402

urlpatterns += [
    path('campuses/', c.CampusListView.as_view(), name='campus_campuses'),
    path('sessions/', c.SessionListView.as_view(), name='campus_sessions'),
    path('clubs/', c.ClubListView.as_view(), name='campus_clubs'),
    path('clubs/mine/', c.MyClubsView.as_view(), name='campus_my_clubs'),
    path('clubs/<int:pk>/', c.ClubDetailView.as_view(), name='campus_club'),
    path('clubs/<int:pk>/members/', c.ClubMembersView.as_view(), name='campus_club_members'),
    path('clubs/<int:pk>/members/<int:assignment_id>/', c.ClubMemberDetailView.as_view(),
         name='campus_club_member'),
    path('clubs/<int:pk>/leave/', c.LeaveClubView.as_view(), name='campus_club_leave'),
    path('clubs/<int:pk>/join/', c.JoinView.as_view(), name='campus_club_join'),
    path('clubs/<int:pk>/requests/', c.JoinRequestListView.as_view(), name='campus_club_requests'),
    path('clubs/<int:pk>/requests/<int:request_id>/decide/', c.JoinRequestDecideView.as_view(),
         name='campus_club_request_decide'),
    path('clubs/<int:pk>/announcements/', c.AnnouncementListView.as_view(), name='campus_announcements'),
    path('clubs/<int:pk>/announcements/<int:announcement_id>/', c.AnnouncementDetailView.as_view(),
         name='campus_announcement'),
    path('clubs/<int:pk>/announcements/<int:announcement_id>/comments/', c.CommentListView.as_view(),
         name='campus_comments'),
    path('clubs/<int:pk>/comments/<int:comment_id>/hide/', c.CommentHideView.as_view(), name='campus_comment_hide'),
    path('club-proposals/', c.ClubProposalListView.as_view(), name='campus_club_proposals'),
    path('club-proposals/<int:pk>/', c.ClubProposalDetailView.as_view(), name='campus_club_proposal'),
    path('news/', c.NewsListView.as_view(), name='campus_news'),
    path('news/mine/', c.MyNewsView.as_view(), name='campus_my_news'),
    path('news/<int:pk>/', c.NewsDetailView.as_view(), name='campus_news_detail'),
    path('approvals/', c.ApprovalListView.as_view(), name='campus_approvals'),
    path('approvals/<int:pk>/', c.ApprovalDetailView.as_view(), name='campus_approval'),
    path('approvals/<int:pk>/decide/', c.ApprovalDecideView.as_view(), name='campus_approval_decide'),
    path('approvals/<int:pk>/withdraw/', c.ApprovalWithdrawView.as_view(), name='campus_approval_withdraw'),
    path('pilot/', c.PilotListView.as_view(), name='campus_pilot'),
    path('pilot/<int:pk>/', c.PilotDetailView.as_view(), name='campus_pilot_detail'),
]
