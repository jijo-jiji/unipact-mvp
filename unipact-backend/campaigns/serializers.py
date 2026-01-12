from rest_framework import serializers
from .models import Campaign, Application, Deliverable

class CampaignSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source='company.company_name', read_only=True)
    guild = serializers.SerializerMethodField()
    applicants = serializers.IntegerField(source='applications.count', read_only=True)

    class Meta:
        model = Campaign
        fields = ['id', 'company', 'company_name', 'title', 'description', 'type', 'budget', 'requirements', 'deadline', 'status', 'created_at', 'guild', 'applicants']
        read_only_fields = ['company', 'status', 'created_at']

    def get_guild(self, obj):
        # Find the application that is AWARDED, SUBMITTED, or COMPLETED
        winning_app = obj.applications.filter(status__in=['AWARDED', 'SUBMITTED', 'COMPLETED']).first()
        return winning_app.club.club_name if winning_app else None

class CampaignDetailSerializer(CampaignSerializer):
    applications = serializers.SerializerMethodField()
    my_application = serializers.SerializerMethodField()

    class Meta(CampaignSerializer.Meta):
        fields = CampaignSerializer.Meta.fields + ['applications', 'my_application']
    
    def get_applications(self, obj):
        # Only show applications to the owner (Company)
        request = self.context.get('request')
        if request and request.user.role == 'COMPANY' and obj.company == request.user.company_profile:
             return ApplicationSerializer(obj.applications.all(), many=True).data
        return None

    def get_my_application(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated and request.user.role == 'CLUB':
             try:
                 app = obj.applications.get(club__user=request.user)
                 return {'id': app.id, 'status': app.status}
             except Application.DoesNotExist:
                 return None
        return None

class DeliverableSerializer(serializers.ModelSerializer):
    class Meta:
        model = Deliverable
        fields = ['id', 'application', 'file', 'uploaded_at']
        read_only_fields = ['application', 'uploaded_at']

class ApplicationSerializer(serializers.ModelSerializer):
    club_name = serializers.CharField(source='club.club_name', read_only=True)
    club_user_id = serializers.IntegerField(source='club.user.id', read_only=True)
    campaign_title = serializers.CharField(source='campaign.title', read_only=True)
    campaign_status = serializers.CharField(source='campaign.status', read_only=True)
    campaign_budget = serializers.DecimalField(source='campaign.budget', max_digits=10, decimal_places=2, read_only=True)
    deliverables = DeliverableSerializer(many=True, read_only=True)

    class Meta:
        model = Application
        fields = ['id', 'campaign', 'campaign_title', 'campaign_status', 'campaign_budget', 'club', 'club_name', 'club_user_id', 'message', 'status', 'submitted_at', 'deliverables']
        read_only_fields = ['campaign', 'club', 'status', 'submitted_at', 'deliverables']
