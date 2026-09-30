from django.db import migrations, models


def trust_existing_accounts(apps, schema_editor):
    """
    Everyone who signed up before confirmation existed never had a link to click, so treat their
    address as confirmed. Without this, live accounts would be locked out of posting and accepting
    the moment this ships.
    """
    apps.get_model('users', 'User').objects.update(email_verified=True)


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0009_clubprofile_logo_companyprofile_logo_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='email_verified',
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(trust_existing_accounts, migrations.RunPython.noop),
    ]
