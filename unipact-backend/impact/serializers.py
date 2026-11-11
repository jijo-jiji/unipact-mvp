from rest_framework import serializers

from .models import B40Record, ImpactSettings, Workshop


class WorkshopSerializer(serializers.ModelSerializer):
    kind_label = serializers.CharField(source='get_kind_display', read_only=True)

    class Meta:
        model = Workshop
        fields = ['id', 'title', 'kind', 'kind_label', 'held_on', 'location', 'attendees', 'notes', 'created_at']
        read_only_fields = ['id', 'kind_label', 'created_at']


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
