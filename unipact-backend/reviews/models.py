from django.db import models
from django.conf import settings
from campaigns.models import Campaign
from users.models import ClubProfile, CompanyProfile

class Review(models.Model):
    reviewer = models.ForeignKey(CompanyProfile, on_delete=models.CASCADE, related_name='given_reviews')
    reviewee = models.ForeignKey(ClubProfile, on_delete=models.CASCADE, related_name='received_reviews')
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name='reviews')
    
    rating = models.IntegerField(choices=[(i, str(i)) for i in range(1, 6)])
    comment = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('reviewer', 'campaign') # One review per campaign per company

    def __str__(self):
        return f"{self.reviewer} -> {self.reviewee} ({self.rating}★)"
