from rest_framework import serializers

from unipact_backend.validators import validate_project_file_upload

from .models import B40Record, ImpactSettings, LearningModule, ModuleItem, Workshop, WorkshopAttendee


class ModuleItemSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    file_name = serializers.SerializerMethodField()

    class Meta:
        model = ModuleItem
        fields = ['id', 'module', 'item_type', 'title', 'description', 'file', 'file_url', 'file_name', 'link_url', 'order', 'created_at']
        read_only_fields = ['id', 'module', 'file_url', 'file_name', 'created_at']
        extra_kwargs = {'file': {'write_only': True, 'required': False, 'allow_null': True}}

    def get_file_url(self, obj):
        if not obj.file:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(obj.file.url) if request else obj.file.url

    def get_file_name(self, obj):
        return obj.file.name.rsplit('/', 1)[-1] if obj.file else None

    def validate_file(self, value):
        return validate_project_file_upload(value, 'File') if value else value

    def validate(self, attrs):
        item_type = attrs.get('item_type', getattr(self.instance, 'item_type', ModuleItem.ItemType.MATERIAL))
        file = attrs.get('file', getattr(self.instance, 'file', None))
        link = attrs.get('link_url', getattr(self.instance, 'link_url', ''))
        description = attrs.get('description', getattr(self.instance, 'description', ''))
        if not file and not link and not (item_type == ModuleItem.ItemType.EXERCISE and description.strip()):
            raise serializers.ValidationError('Upload a file or add a link (an exercise can also be just written instructions).')
        return attrs


class LearningModuleSerializer(serializers.ModelSerializer):
    topic_label = serializers.CharField(source='get_topic_display', read_only=True)
    items = ModuleItemSerializer(many=True, read_only=True)

    class Meta:
        model = LearningModule
        fields = ['id', 'title', 'summary', 'topic', 'topic_label', 'order', 'is_published', 'items', 'created_at', 'updated_at']
        read_only_fields = ['id', 'topic_label', 'items', 'created_at', 'updated_at']


class WorkshopSerializer(serializers.ModelSerializer):
    kind_label = serializers.CharField(source='get_kind_display', read_only=True)
    module_ids = serializers.PrimaryKeyRelatedField(source='modules', many=True, queryset=LearningModule.objects.all(), required=False)
    module_titles = serializers.SerializerMethodField()
    checkin_count = serializers.IntegerField(source='checkins.count', read_only=True)

    class Meta:
        model = Workshop
        fields = ['id', 'title', 'kind', 'kind_label', 'held_on', 'location', 'attendees', 'notes', 'module_ids', 'module_titles',
                  'checkin_code', 'checkin_open', 'feedback_open', 'cost', 'checkin_count', 'created_at']
        read_only_fields = ['id', 'kind_label', 'module_titles', 'checkin_code', 'checkin_count', 'created_at']

    def get_module_titles(self, obj):
        return [m.title for m in obj.modules.all()]


class ImpactSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImpactSettings
        fields = ['counting_starts_on', 'show_on_homepage', 'updated_at']
        read_only_fields = ['updated_at']


class B40RecordSerializer(serializers.ModelSerializer):
    student_id = serializers.IntegerField(source='student.id', read_only=True)
    full_name = serializers.CharField(source='student.full_name', read_only=True)
    university = serializers.CharField(source='student.university', read_only=True)
    amount_paid = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = B40Record
        fields = ['id', 'student_id', 'full_name', 'university', 'evidence_note', 'verified_at', 'amount_paid']


class CheckinSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    university = serializers.CharField(max_length=255, required=False, allow_blank=True)
    b40_self_declared = serializers.ChoiceField(choices=WorkshopAttendee.B40.choices, default=WorkshopAttendee.B40.UNSAID)
    confidence_before = serializers.IntegerField(min_value=1, max_value=5)
    consent = serializers.BooleanField()

    def validate_email(self, value):
        return value.strip().lower()

    def validate_consent(self, value):
        if not value:
            raise serializers.ValidationError('Please agree so we can keep your check-in and follow up with you.')
        return value


class FeedbackSerializer(serializers.Serializer):
    email = serializers.EmailField()
    confidence_after = serializers.IntegerField(min_value=1, max_value=5)
    recommend_score = serializers.IntegerField(min_value=0, max_value=10)
    comment = serializers.CharField(required=False, allow_blank=True, max_length=2000)

    def validate_email(self, value):
        return value.strip().lower()
