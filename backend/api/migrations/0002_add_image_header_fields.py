from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('api', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='messagetemplate',
            name='header_type',
            field=models.CharField(blank=True, default='NONE', max_length=30, null=True),
        ),
        migrations.AddField(
            model_name='messagetemplate',
            name='header_text',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='messagetemplate',
            name='sample_image_url',
            field=models.CharField(blank=True, max_length=500, null=True),
        ),
        migrations.AddField(
            model_name='messagecampaign',
            name='header_image_url',
            field=models.CharField(blank=True, max_length=500, null=True),
        ),
    ]
