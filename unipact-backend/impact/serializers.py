from rest_framework import serializers

from .models import B40Record, ImpactBaseline, Workshop


class WorkshopSerializer(serializers.ModelSerializer):
    kind_label = serializers.CharField(source='get_kind_display', read_only=True)

    class Meta:
        model = Workshop
        fields = ['id', 'title', 'kind', 'kind_label', 'held_on', 'location', 'attendees', 'notes', 'created_at']
        read_only_fields = ['id', 'kind_label', 'created_at']


class ImpactBaselineSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImpactBaseline
        fields = ['b40_students_paid', 'b40_amount_paid', 'projects_delivered', 'note', 'show_on_homepage', 'updated_at']
        read_only_fields = ['updated_at']

    def validate_b40_amount_paid(self, value):
        if value < 0:
            raise serializers.ValidationError('The amount cannot be negative.')
        return value


class B40RecordSerializer(serializers.ModelSerializer):
    student_id = serializers.IntegerField(source='student.id', read_only=True)
    full_name = serializers.CharField(source='student.full_name', read_only=True)
    university = serializers.CharField(source='student.university', read_only=True)
    amount_paid = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = B40Record
        fields = ['id', 'student_id', 'full_name', 'university', 'evidence_note', 'verified_at', 'amount_paid']
