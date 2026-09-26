from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('api', '0002_add_image_header_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='student',
            name='fees_due',
            field=models.DecimalField(decimal_places=2, default=0.0, help_text='Pending fees dues for student', max_digits=10),
        ),
    ]
