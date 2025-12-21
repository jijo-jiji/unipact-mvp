from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
import io
from .models import Report
from django.core.files.base import ContentFile

def generate_campaign_report(campaign):
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    
    # Title
    p.setFont("Helvetica-Bold", 16)
    p.drawString(100, 750, f"Campaign Report: {campaign.title}")
    
    # Details
    p.setFont("Helvetica", 12)
    p.drawString(100, 730, f"Company: {campaign.company.company_name}")
    p.drawString(100, 710, f"Budget: {campaign.budget}")
    
    # Awarded application
    awarded_app = campaign.applications.filter(status='AWARDED').first()
    if awarded_app:
        p.drawString(100, 690, f"Awarded Club: {awarded_app.club.club_name}")
        p.drawString(100, 670, f"University: {awarded_app.club.university}")
        
        # Deliverables
        p.drawString(100, 640, "Deliverables:")
        y = 620
        for deliverable in awarded_app.deliverables.all():
            p.drawString(120, y, f"- {deliverable.file.name}")
            y -= 20
    
    p.showPage()
    p.save()
    
    pdf_content = buffer.getvalue()
    buffer.close()
    
    # Save Report
    report, created = Report.objects.get_or_create(campaign=campaign)
    report.generated_pdf.save(f"report_{campaign.id}.pdf", ContentFile(pdf_content))
    return report
